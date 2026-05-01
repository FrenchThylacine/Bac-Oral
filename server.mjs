import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import http from "node:http";

import { createAnalysisDraft, detectALFromFilename, ensureCompleteEntry, fixWeakAnalyses, highlightKeyProcedures, simplifyAnalysisEntry, slugify, cleanOcrText, isOcrNoiseDetected, eliteQualityTransform } from "./lib/revision-engine.mjs";
import { exportWorkbook } from "./lib/export-workbook-stub.mjs";
import { applyV2Processing, generateV2Summary, exportV2Data } from "./lib/v2-backend.mjs";
import { extractFromImage } from "./lib/v3-extraction.mjs";
import { storeAL, getAL, getAllALs, getFlaggedItems, resolveFlaggedItem, getALStats, initializeDatabase } from "./lib/v3-storage.mjs";
import { completeMissingProcedures, calculateCompletionScore } from "./lib/v3-ai-completion.mjs";
import { calculateConfidenceScore, identifyFlaggedItems } from "./lib/v3-data-validator.mjs";
import { exportToExcel } from "./lib/v3-excel-exporter.mjs";
import { exportToJSON } from "./lib/v3-json-exporter.mjs";
import { exportToPDF } from "./lib/v3-pdf-exporter.mjs";
import { parseMultipartFormData } from "./lib/multipart-parser.mjs";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const WEB_DIR = path.join(ROOT, "web");
const OUTPUT_DIR = path.join(ROOT, "outputs");
const TMP_DIR = path.join(ROOT, "tmp");

// Auto-detect Python installation
function findPython() {
  for (const cmd of ["python3", "python", "py"]) {
    try {
      execSync(`${cmd} --version`, { stdio: "ignore" });
      return cmd;
    } catch {}
  }
  return "python";
}
const PYTHON = findPython();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found" });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 35_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    request.on("end", () => {
      resolve(body ? JSON.parse(body) : {});
    });
    request.on("error", reject);
  });
}

function spawnCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      windowsHide: true,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Command failed with exit code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function ensureDirectories() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });
}

async function writeTempFile(fileName, buffer) {
  const safeName = `${Date.now()}-${slugify(fileName || "upload")}${path.extname(fileName || "") || ".bin"}`;
  const filePath = path.join(TMP_DIR, safeName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

function dataUrlToBuffer(dataUrl) {
  const [, base64 = ""] = dataUrl.split(",");
  return Buffer.from(base64, "base64");
}

async function parseRecap(payload) {
  if (payload.manualText) {
    return {
      fileName: "Saisie manuelle",
      sequenceCount: 0,
      sequences: [],
      manualText: payload.manualText,
    };
  }

  const buffer = dataUrlToBuffer(payload.fileBase64);
  const tempPath = await writeTempFile(payload.fileName || "recap.pdf", buffer);
  const raw = await spawnCommand(PYTHON, [path.join(ROOT, "scripts", "extract_recap.py"), tempPath]);
  return JSON.parse(raw);
}

function sequenceLookupMap(project) {
  return new Map((project.sequences || []).map((sequence) => [sequence.id, sequence]));
}

async function performOcr(file) {
  if (file.ocrText) {
    return file.ocrText;
  }
  const extension = path.extname(file.name || ".png") || ".png";
  const tempPath = await writeTempFile(file.name || `capture${extension}`, dataUrlToBuffer(file.dataUrl));
  const raw = await spawnCommand("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(ROOT, "scripts", "ocr_image.ps1"),
    "-Path",
    tempPath,
  ]);
  return raw.trim();
}

async function processEntries(project, options = {}) {
  const sequences = sequenceLookupMap(project);
  const entries = [];

  for (const incoming of project.entries || []) {
    const sequence = sequences.get(incoming.sequenceId) || {};
    const sourceParts = [];
    const files = [];

    for (const file of incoming.files || []) {
      let ocrText = file.ocrText || "";
      if (options.runOcr !== false && file.dataUrl) {
        try {
          ocrText = await performOcr(file);
        } catch (error) {
          ocrText = file.ocrText || "";
        }
      }
      
      // CORRECTION: Nettoyer le texte OCR pour éliminer les bruits parasites
      const cleanedOcr = cleanOcrText(ocrText);
      const hasNoise = ocrText && isOcrNoiseDetected(ocrText);
      
      files.push({
        ...file,
        ocrText: cleanedOcr,
        rawOcrText: ocrText, // Garder l'original pour debug
        status: cleanedOcr ? "done" : hasNoise ? "noise-detected" : "missing",
        qualityNote: hasNoise ? "Texte à vérifier - bruit OCR détecté" : "",
      });
      
      if (cleanedOcr) {
        sourceParts.push(cleanedOcr);
      }
    }

    // CORRECTION: Créer le brouillon UNE SEULE FOIS avec le texte nettoyé
    let sourceText = [incoming.manualText || "", ...sourceParts].filter(Boolean).join("\n\n");
    
    // CORRECTION: Nettoyer AUSSI le texte extrait du PDF (corruptions OCR)
    sourceText = cleanOcrText(sourceText);
    
    const draft = createAnalysisDraft({
      sequence,
      al: {
        ...incoming,
        id: incoming.id || `AL-${Date.now()}`,
        label: incoming.label || incoming.id,
      },
      sourceText,
    });

    // ELITE QUALITY TRANSFORMATION: Apply pedagogical superiority algorithms
    const eliteDraft = eliteQualityTransform(draft);

    // CORRECTION: Ne pas réappeler ensureCompleteEntry - le draft l'a déjà fait
    const completed = {
      ...incoming,
      ...eliteDraft, // Use elite-transformed draft
      files,
      sequenceMeta: sequence,
      sequenceLabel: sequence.label,
      sourceText: eliteDraft.sourceText,
      id: eliteDraft.id, // Assurer que chaque AL a un ID unique
    };

    entries.push({
      ...completed,
      status: {
        ocr: files.some((file) => file.status === "done") ? "done" : files.some((file) => file.status === "noise-detected") ? "needs-review" : "waiting",
        structuring: completed.movements && completed.movements.length > 0 ? "done" : "waiting",
        analysis: completed.oralBullets && completed.oralBullets.length > 0 ? "done" : "waiting",
        export: "ready",
      },
    });
  }

  return {
    ...project,
    entries,
  };
}

async function applySmartAction(project, action) {
  return {
    ...project,
    entries: (project.entries || []).map((entry) => {
      // Créer une copie profonde pour éviter les mutations partagées
      const entryCopy = JSON.parse(JSON.stringify(entry));
      
      if (action === "simplify") {
        return simplifyAnalysisEntry(entryCopy);
      }
      if (action === "fix-weak") {
        return fixWeakAnalyses(entryCopy);
      }
      if (action === "highlight") {
        return highlightKeyProcedures(entryCopy);
      }
      return entryCopy;
    }),
  };
}

async function serveStaticAsset(request, response, filePath) {
  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    response.end(file);
  } catch (error) {
    notFound(response);
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    
    // Debug: Log API requests
    if (url.pathname.startsWith('/api/')) {
      console.log(`[Server] ${request.method} ${url.pathname}`);
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/recap/parse") {
      const payload = await readRequestBody(request);
      const recap = await parseRecap(payload);
      sendJson(response, 200, recap);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/process") {
      const payload = await readRequestBody(request);
      let project = await processEntries(payload.project || {}, payload.options || {});
      // V2 Enhancement: Apply V2 processing to all entries
      project = applyV2Processing(project);
      sendJson(response, 200, project);
      return;
    }

    // V2 Enhancement: New endpoint for V2 project summary
    if (request.method === "POST" && url.pathname === "/api/v2/summary") {
      const payload = await readRequestBody(request);
      const summary = generateV2Summary(payload.project || {});
      sendJson(response, 200, summary);
      return;
    }

    // V2 Enhancement: New endpoint for V2 data export
    if (request.method === "POST" && url.pathname === "/api/v2/export") {
      const payload = await readRequestBody(request);
      const format = payload.format || 'json';
      const data = exportV2Data(payload.project || {}, format);
      sendJson(response, 200, { data, format });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/action") {
      const payload = await readRequestBody(request);
      const project = await applySmartAction(payload.project || {}, payload.action || "");
      sendJson(response, 200, project);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/export") {
      const payload = await readRequestBody(request);
      const file = await exportWorkbook({
        project: payload.project || {},
        scope: payload.scope || { type: "full" },
        options: payload.options || {},
        outputDir: OUTPUT_DIR,
      });
      sendJson(response, 200, {
        ...file,
        downloadUrl: `/outputs/${file.fileName}`,
      });
      return;
    }

    // V3 Endpoints - AI-Powered AL Digitization

    if (request.method === "POST" && url.pathname === "/api/v3/upload") {
      try {
        const { fields } = await parseMultipartFormData(request, TMP_DIR);
        const uploadedFile = fields.file;
        
        if (!uploadedFile || !uploadedFile.filepath) {
          sendJson(response, 400, { error: "No file uploaded" });
          return;
        }

        const fileName = uploadedFile.filename || `upload_${Date.now()}`;
        const filePath = uploadedFile.filepath;

        // Extract from uploaded file
        const extraction = await extractFromImage(filePath);
        const stored = await storeAL(extraction);

        // Clean up temp file
        try {
          await fs.unlink(filePath);
        } catch (e) {
          console.warn(`Failed to clean up temp file: ${filePath}`);
        }

        sendJson(response, 200, {
          success: true,
          alId: extraction.id,
          title: extraction.title,
          stats: stored.stats,
        });
      } catch (err) {
        sendJson(response, 500, { error: err.message });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v3/process") {
      const payload = await readRequestBody(request);
      const alId = payload.id;
      
      try {
        const al = getAL(alId);
        if (!al) {
          sendJson(response, 404, { error: "AL not found" });
          return;
        }

        const { al: completed, flaggedItems } = await completeMissingProcedures(al);
        const confidence = calculateConfidenceScore(completed);
        const flags = identifyFlaggedItems(completed);

        sendJson(response, 200, {
          success: true,
          alId: completed.id,
          title: completed.title,
          completionScore: confidence.percentage,
          flagged: flags,
          flaggedCount: flags.length,
        });
      } catch (err) {
        sendJson(response, 500, { error: err.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/v3/review?")) {
      const alId = new URL(request.url, "http://localhost").searchParams.get("id");
      
      try {
        const flagged = getFlaggedItems(alId);
        sendJson(response, 200, {
          alId,
          flaggedItems: flagged,
        });
      } catch (err) {
        sendJson(response, 500, { error: err.message });
      }
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/v3/review?")) {
      const payload = await readRequestBody(request);
      
      try {
        for (const [flagId, resolution] of Object.entries(payload.decisions || {})) {
          resolveFlaggedItem(flagId, resolution);
        }
        sendJson(response, 200, { success: true, updated: Object.keys(payload.decisions || {}).length });
      } catch (err) {
        sendJson(response, 500, { error: err.message });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v3/export") {
      const payload = await readRequestBody(request);
      const alId = payload.id;
      const format = payload.format || "json";
      
      try {
        const al = getAL(alId);
        if (!al) {
          sendJson(response, 404, { error: "AL not found" });
          return;
        }

        let result;
        if (format === "excel") {
          result = await exportToExcel(al);
        } else if (format === "pdf") {
          result = await exportToPDF(al);
        } else {
          result = await exportToJSON(al);
        }

        sendJson(response, 200, {
          success: true,
          format,
          file: result.file,
          downloadUrl: `/outputs/${path.basename(result.file)}`,
        });
      } catch (err) {
        sendJson(response, 500, { error: err.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v3/als") {
      try {
        console.log('[Server] Fetching all ALs from storage...');
        const als = getAllALs();
        console.log(`[Server] Found ${als.length} ALs`);
        sendJson(response, 200, { als });
      } catch (err) {
        console.error('[Server] Error in /api/v3/als:', err.message, err.stack);
        sendJson(response, 500, { error: err.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/v3/als/")) {
      const alId = url.pathname.replace("/api/v3/als/", "");
      
      try {
        const stats = getALStats(alId);
        if (!stats) {
          sendJson(response, 404, { error: "AL not found" });
          return;
        }
        sendJson(response, 200, stats);
      } catch (err) {
        sendJson(response, 500, { error: err.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/outputs/")) {
      await serveStaticAsset(response.req, response, path.join(OUTPUT_DIR, decodeURIComponent(url.pathname.replace("/outputs/", ""))));
      return;
    }

    // Favicon handler
    if (url.pathname === "/favicon.ico") {
      response.writeHead(200, {
        "Content-Type": "image/x-icon",
        "Cache-Control": "max-age=31536000",
      });
      // Minimal 1x1 favicon ICO
      response.end(Buffer.from([
        0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x30, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x20, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]));
      return;
    }

    let assetPath = url.pathname === "/" ? path.join(WEB_DIR, "index.html") : path.join(WEB_DIR, url.pathname);
    if (!assetPath.startsWith(WEB_DIR)) {
      notFound(response);
      return;
    }

    await serveStaticAsset(request, response, assetPath);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Server error",
    });
  }
});

await ensureDirectories();

// Initialize database
try {
  initializeDatabase();
  console.log('[Server] V3 database initialized');
} catch (err) {
  console.error('[Server] Failed to initialize V3 database:', err.message);
}

const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => {
  console.log(`Bac Oral Studio running on http://127.0.0.1:${port}`);
});

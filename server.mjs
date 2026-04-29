import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import http from "node:http";

import { createAnalysisDraft, detectALFromFilename, ensureCompleteEntry, fixWeakAnalyses, highlightKeyProcedures, simplifyAnalysisEntry, slugify, cleanOcrText, isOcrNoiseDetected, eliteQualityTransform } from "./lib/revision-engine.mjs";
import { exportWorkbook } from "./lib/export-workbook.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const WEB_DIR = path.join(ROOT, "web");
const OUTPUT_DIR = path.join(ROOT, "outputs");
const TMP_DIR = path.join(ROOT, "tmp");
const PYTHON = "C:\\Users\\iyadf\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

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
      const project = await processEntries(payload.project || {}, payload.options || {});
      sendJson(response, 200, project);
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

    if (request.method === "GET" && url.pathname.startsWith("/outputs/")) {
      await serveStaticAsset(response.req, response, path.join(OUTPUT_DIR, decodeURIComponent(url.pathname.replace("/outputs/", ""))));
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

const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => {
  console.log(`Bac Oral Studio running on http://127.0.0.1:${port}`);
});

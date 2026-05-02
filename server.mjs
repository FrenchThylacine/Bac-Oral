// ============================================================
// server.mjs — Bac Oral Studio v3
// FIX: auto-detect Python (no hardcoded path)
// FIX: clean imports, removed broken stubs
// ============================================================
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync, execFile } from "node:child_process";
import http from "node:http";

import {
  createAnalysisDraft, ensureCompleteEntry, fixWeakAnalyses,
  highlightKeyProcedures, simplifyAnalysisEntry, slugify,
  cleanOcrText, isOcrNoiseDetected, eliteQualityTransform,
} from "./lib/revision-engine.mjs";

import { exportWorkbook } from "./lib/export-workbook.mjs";
import { extractFromImages } from "./lib/v3-extraction.mjs";
import {
  storeAL, getAL, getAllALs, getFlaggedItems,
  resolveFlaggedItem, getALStats, initializeDatabase, deleteAL,
} from "./lib/v3-storage.mjs";
import { parseMultipartFormData } from "./lib/multipart-parser.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = __dirname;
const WEB_DIR    = path.join(ROOT, "web");
const OUTPUT_DIR = path.join(ROOT, "outputs");
const TMP_DIR    = path.join(ROOT, "tmp");
const DATA_DIR   = path.join(ROOT, ".data");

// ── FIX: Auto-detect Python (was hardcoded to C:\Users\iyadf\...) ──
function findPython() {
  for (const cmd of ["python3", "python", "py"]) {
    try { execSync(`${cmd} --version`, { stdio: "ignore" }); return cmd; } catch {}
  }
  console.warn("[Server] Python not found — PDF recap parsing unavailable");
  return "python";
}
const PYTHON = findPython();
console.log(`[Server] Python: ${PYTHON}`);

// ── Load .env if present ─────────────────────────────────────
try {
  const envPath = path.join(ROOT, ".env");
  const envContent = await fs.readFile(envPath, "utf8").catch(() => "");
  for (const line of envContent.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
if (ANTHROPIC_API_KEY) {
  console.log("[Server] Anthropic API key detected — vision mode enabled");
} else {
  console.log("[Server] No API key — OCR pipeline mode");
}

// ── MIME types ───────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pdf":  "application/pdf",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
};

// ── Response helpers ─────────────────────────────────────────
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function notFound(res) { sendJson(res, 404, { error: "Not found" }); }

function serverError(res, err) {
  console.error("[Server] Error:", err?.message || err);
  sendJson(res, 500, { error: String(err?.message || err) });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => {
      body += c;
      if (body.length > 35_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch(e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function dataUrlToBuffer(dataUrl = "") {
  const [, b64 = ""] = dataUrl.split(",");
  return Buffer.from(b64, "base64");
}

async function writeTempFile(name, buf) {
  const safe = `${Date.now()}-${Math.random().toString(36).slice(2,6)}${path.extname(name||"") || ".bin"}`;
  const p = path.join(TMP_DIR, safe);
  await fs.writeFile(p, buf);
  return p;
}

async function serveStatic(req, res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch { notFound(res); }
}

function spawnCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", c => out += c);
    child.stderr.on("data", c => err += c);
    child.on("error", reject);
    child.on("close", code =>
      code !== 0 ? reject(new Error(err || `Exit ${code}`)) : resolve(out)
    );
  });
}

// ── Recap parsing ────────────────────────────────────────────
async function parseRecap(payload) {
  if (payload.manualText) {
    return { fileName: "Saisie manuelle", sequenceCount: 0, sequences: [], textCount: 0 };
  }
  const buf = dataUrlToBuffer(payload.fileBase64 || "");
  const tmp = await writeTempFile(payload.fileName || "recap.pdf", buf);
  try {
    const raw = await spawnCmd(PYTHON, [path.join(ROOT, "scripts", "extract_recap.py"), tmp]);
    return JSON.parse(raw);
  } finally {
    fs.unlink(tmp).catch(() => {});
  }
}

// ── V1/V2 processing ─────────────────────────────────────────
async function processEntries(project, options = {}) {
  const seqMap = new Map((project.sequences || []).map(s => [s.id, s]));
  const entries = [];

  for (const inc of project.entries || []) {
    const seq = seqMap.get(inc.sequenceId) || {};
    const parts = [];
    const files = [];

    for (const file of inc.files || []) {
      let ocrText = file.ocrText || "";
      if (options.runOcr !== false && file.dataUrl) {
        try {
          const tmp = await writeTempFile(file.name || "img.jpg", dataUrlToBuffer(file.dataUrl));
          const raw = await spawnCmd("powershell", [
            "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", path.join(ROOT, "scripts", "ocr_image.ps1"),
            "-Path", tmp,
          ]);
          fs.unlink(tmp).catch(() => {});
          ocrText = raw.trim();
        } catch {}
      }
      const cleaned = cleanOcrText(ocrText);
      files.push({ ...file, ocrText: cleaned, status: cleaned ? "done" : "missing" });
      if (cleaned) parts.push(cleaned);
    }

    const sourceText = cleanOcrText([inc.manualText || "", ...parts].filter(Boolean).join("\n\n"));
    const draft = createAnalysisDraft({ sequence: seq, al: { ...inc }, sourceText });
    const elite = eliteQualityTransform(draft);

    entries.push({
      ...inc, ...elite, files,
      sequenceMeta: seq,
      sequenceLabel: seq.label || inc.sequenceLabel || "",
      status: {
        ocr: files.some(f => f.status === "done") ? "done" : "waiting",
        structuring: elite.movements?.length ? "done" : "waiting",
        analysis: elite.oralBullets?.length ? "done" : "waiting",
        export: "ready",
      },
    });
  }

  return { ...project, entries };
}

async function applySmartAction(project, action) {
  const fns = {
    simplify: simplifyAnalysisEntry,
    "fix-weak": fixWeakAnalyses,
    highlight: highlightKeyProcedures,
  };
  const fn = fns[action];
  if (!fn) return project;
  return {
    ...project,
    entries: (project.entries || []).map(e => fn(JSON.parse(JSON.stringify(e)))),
  };
}

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const { pathname } = url;

    if (pathname.startsWith("/api/")) {
      console.log(`[Server] ${req.method} ${pathname}`);
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    // ── Health ────────────────────────────────────────────────
    if (req.method === "GET" && pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        version: "3.1",
        python: PYTHON,
        apiKey: !!ANTHROPIC_API_KEY,
      });
    }

    // ── V1/V2 routes ─────────────────────────────────────────
    if (req.method === "POST" && pathname === "/api/recap/parse") {
      const b = await readBody(req);
      return sendJson(res, 200, await parseRecap(b));
    }

    if (req.method === "POST" && pathname === "/api/process") {
      const b = await readBody(req);
      return sendJson(res, 200, await processEntries(b.project || {}, b.options || {}));
    }

    if (req.method === "POST" && pathname === "/api/action") {
      const b = await readBody(req);
      return sendJson(res, 200, await applySmartAction(b.project || {}, b.action || ""));
    }

    if (req.method === "POST" && pathname === "/api/export") {
      const b = await readBody(req);
      const file = await exportWorkbook({
        project: b.project || {},
        scope: b.scope || { type: "full" },
        options: b.options || {},
        outputDir: OUTPUT_DIR,
      });
      return sendJson(res, 200, { ...file, downloadUrl: `/outputs/${file.fileName}` });
    }

    // ── V3 Upload ─────────────────────────────────────────────
    if (req.method === "POST" && pathname === "/api/v3/upload") {
      const ct = req.headers["content-type"] || "";
      let imagePaths = [];

      try {
        if (ct.includes("multipart/form-data")) {
          const { fields } = await parseMultipartFormData(req, TMP_DIR);
          // Handle both single file and multiple files
          const fileFields = Object.values(fields).filter(f => f && f.filepath);
          for (const f of fileFields) imagePaths.push(f.filepath);
        } else {
          // JSON with base64 dataUrls
          const b = await readBody(req);
          const imgs = Array.isArray(b.images) ? b.images : [b];
          for (const img of imgs) {
            if (img.dataUrl) {
              imagePaths.push(await writeTempFile(img.name || "upload.jpg", dataUrlToBuffer(img.dataUrl)));
            }
          }
        }

        if (!imagePaths.length) {
          return sendJson(res, 400, { error: "No images received" });
        }

        const extraction = await extractFromImages(imagePaths, ANTHROPIC_API_KEY);
        const { alId } = storeAL(extraction);

        return sendJson(res, 200, {
          success: true,
          alId,
          title: extraction.title,
          genre: extraction.genre,
          movementCount: (extraction.movements || []).length,
        });

      } finally {
        // Always clean up temp files
        for (const p of imagePaths) fs.unlink(p).catch(() => {});
      }
    }

    // ── V3 Get all ALs ────────────────────────────────────────
    if (req.method === "GET" && pathname === "/api/v3/als") {
      const als = getAllALs();
      console.log(`[Server] Found ${als.length} ALs`);
      return sendJson(res, 200, { als });
    }

    // ── V3 Get single AL ──────────────────────────────────────
    if (req.method === "GET" && pathname.startsWith("/api/v3/als/")) {
      const id = pathname.replace("/api/v3/als/", "");
      const al = getAL(id);
      if (!al) return notFound(res);
      return sendJson(res, 200, al);
    }

    // ── V3 Update AL ──────────────────────────────────────────
    if (req.method === "PUT" && pathname.startsWith("/api/v3/als/")) {
      const id = pathname.replace("/api/v3/als/", "");
      const body = await readBody(req);
      const existing = getAL(id);
      if (!existing) return notFound(res);
      const updated = { ...existing, ...body, id };
      storeAL(updated);
      return sendJson(res, 200, { ok: true });
    }

    // ── V3 Delete AL ──────────────────────────────────────────
    if (req.method === "DELETE" && pathname.startsWith("/api/v3/als/")) {
      const id = pathname.replace("/api/v3/als/", "");
      deleteAL(id);
      return sendJson(res, 200, { ok: true });
    }

    // ── V3 Export ─────────────────────────────────────────────
    if (req.method === "POST" && pathname === "/api/v3/export") {
      const b = await readBody(req);
      const entries = b.alId ? [getAL(b.alId)].filter(Boolean) : getAllALs();
      if (!entries.length) return sendJson(res, 404, { error: "No ALs" });

      if (b.format === "pdf") {
        const { exportPDF } = await import("./lib/v3-pdf-exporter.mjs");
        const file = await exportPDF({ entries, outputDir: OUTPUT_DIR, alId: b.alId });
        return sendJson(res, 200, { ...file, downloadUrl: `/outputs/${file.fileName}` });
      }

      const file = await exportWorkbook({ project: { entries, sequences: [] },
        scope: b.alId ? { type:"single", value:b.alId } : { type:"full" },
        options: { mode: b.mode || "minimalist" }, outputDir: OUTPUT_DIR });
      return sendJson(res, 200, { ...file, downloadUrl: `/outputs/${file.fileName}` });
    }

    // ── V3 Stats ──────────────────────────────────────────────
    if (req.method === "GET" && pathname.startsWith("/api/v3/stats/")) {
      const id = pathname.replace("/api/v3/stats/", "");
      const stats = getALStats(id);
      if (!stats) return notFound(res);
      return sendJson(res, 200, stats);
    }

    // ── Serve outputs ─────────────────────────────────────────
    if (pathname.startsWith("/outputs/")) {
      const p = path.join(OUTPUT_DIR, decodeURIComponent(pathname.replace("/outputs/", "")));
      if (!p.startsWith(OUTPUT_DIR)) return notFound(res);
      return serveStatic(req, res, p);
    }

    // ── Favicon ───────────────────────────────────────────────
    if (pathname === "/favicon.ico") {
      res.writeHead(200, { "Content-Type": "image/x-icon" });
      return res.end(Buffer.alloc(0));
    }

    // ── Static files ──────────────────────────────────────────
    const asset = pathname === "/"
      ? path.join(WEB_DIR, "index.html")
      : path.join(WEB_DIR, pathname.replace(/^\//, ""));
    if (!asset.startsWith(WEB_DIR)) return notFound(res);
    return serveStatic(req, res, asset);

  } catch (err) {
    serverError(res, err);
  }
});

// ── Boot ─────────────────────────────────────────────────────
await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(DATA_DIR, { recursive: true });

initializeDatabase(DATA_DIR);

const PORT = Number(process.env.PORT || 4173);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Bac Oral Studio v3.1`);
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log(`  Python: ${PYTHON}`);
  console.log(`  API Key: ${ANTHROPIC_API_KEY ? "YES (vision mode)" : "NO (OCR mode)"}\n`);
});

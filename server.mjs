// ============================================================
// server.mjs — Bac Oral Studio v4.0
// ============================================================
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import http from "node:http";

import { exportWorkbook } from "./lib/export-workbook.mjs";
import { exportPDF } from "./lib/v3-pdf-exporter.mjs";
import { extractFromImages } from "./lib/v3-extraction.mjs";
import {
  storeAL, getAL, getAllALs, updateAL, deleteAL, initializeDatabase
} from "./lib/v3-storage.mjs";
import { parseMultipartFormData } from "./lib/multipart-parser.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = __dirname;
const WEB_DIR    = path.join(ROOT, "web");
const OUTPUT_DIR = path.join(ROOT, "outputs");
const TMP_DIR    = path.join(ROOT, "tmp");
const DATA_DIR   = path.join(ROOT, ".data");

// ── Auto-detect Python ───────────────────────────────────────
function findPython() {
  for (const cmd of ["python3", "python", "py"]) {
    try { execSync(`${cmd} --version`, { stdio: "ignore" }); return cmd; } catch {}
  }
  return null;
}
const PYTHON = findPython();

// ── Load .env if present ─────────────────────────────────────
(async () => {
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
})();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

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
};

// ── Response helpers ─────────────────────────────────────────
function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) { sendJson(res, 404, { error: "Not found" }); }

function serverError(res, err) {
  console.error("[Server] Error:", err?.message || err);
  sendJson(res, 500, { error: String(err?.message || "Internal Server Error") });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  try {
    return body ? JSON.parse(body) : {};
  } catch (e) {
    throw new Error("Invalid JSON payload");
  }
}

// ── File helpers ─────────────────────────────────────────────
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

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
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

  try {
    // API Routes
    if (pathname.startsWith("/api/v3/")) {
      await handleApiV3(req, res, pathname);
    } 
    // Static file serving
    else if (pathname.startsWith("/outputs/")) {
        const p = path.join(OUTPUT_DIR, decodeURIComponent(pathname.replace("/outputs/", "")));
        if (!p.startsWith(OUTPUT_DIR)) return notFound(res);
        await serveStatic(req, res, p);
    }
    else {
      const asset = pathname === "/" ? "index.html" : pathname;
      const filePath = path.join(WEB_DIR, asset.replace(/^\//, ""));
      if (!filePath.startsWith(WEB_DIR)) return notFound(res);
      await serveStatic(req, res, filePath);
    }
  } catch (err) {
    serverError(res, err);
  }
});

async function handleApiV3(req, res, pathname) {
    // Upload
    if (req.method === "POST" && pathname === "/api/v3/upload") {
        const { fields, files } = await parseMultipartFormData(req, TMP_DIR);
        const imagePaths = files.map(f => f.filepath);
        try {
            if (!imagePaths.length) throw new Error("No images received");
            const extraction = await extractFromImages(imagePaths, ANTHROPIC_API_KEY);
            const { alId } = storeAL(extraction);
            sendJson(res, 200, { success: true, alId, title: extraction.title });
        } finally {
            for (const p of imagePaths) fs.unlink(p).catch(() => {});
        }
    }
    // Get all ALs
    else if (req.method === "GET" && pathname === "/api/v3/als") {
        const als = getAllALs();
        sendJson(res, 200, { als });
    }
    // Get/Update/Delete single AL
    else if (pathname.startsWith("/api/v3/als/")) {
        const id = pathname.split('/').pop();
        if (req.method === "GET") {
            const al = getAL(id);
            if (!al) return notFound(res);
            sendJson(res, 200, al);
        }
        else if (req.method === "PUT") {
            const body = await readBody(req);
            const updated = updateAL(id, body);
            sendJson(res, 200, updated);
        }
        else if (req.method === "DELETE") {
            deleteAL(id);
            sendJson(res, 200, { ok: true });
        }
    }
    // Export
    else if (req.method === "POST" && pathname === "/api/v3/export") {
        const { format = 'excel', alId } = await readBody(req);
        const entries = alId ? [getAL(alId)].filter(Boolean) : getAllALs();
        if (!entries.length) return sendJson(res, 404, { error: "No ALs to export" });

        let file;
        if (format === "pdf") {
            file = await exportPDF({ entries, outputDir: OUTPUT_DIR, alId });
        } else { // Default to Excel
            file = await exportWorkbook({ project: { entries }, outputDir: OUTPUT_DIR });
        }
        sendJson(res, 200, { ...file, downloadUrl: `/outputs/${file.fileName}` });
    }
}

async function serveStatic(req, res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT') notFound(res);
    else serverError(res, e);
  }
}

// ── Boot ─────────────────────────────────────────────────────
(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  initializeDatabase(DATA_DIR);

  const PORT = Number(process.env.PORT || 4173);
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n  Bac Oral Studio v4.0`);
    console.log(`  URL: http://127.0.0.1:${PORT}`);
    console.log(`  Python: ${PYTHON || 'Not Found'}`)
    console.log(`  API Key: ${ANTHROPIC_API_KEY ? "YES (vision mode)" : "NO (OCR mode)"}\n`);
  });
})();

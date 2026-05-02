// lib/v3-pdf-exporter.mjs — Clean PDF output for AL memorization
// Uses pdfkit (already installed) — no new dependencies
// Format: one page per AL, genre-colored headers, oral-ready structure

import path from "node:path";
import fs from "node:fs/promises";

async function getPDFKit() {
  try {
    const mod = await import("pdfkit");
    return mod.default || mod;
  } catch {
    throw new Error("pdfkit not installed — run: npm install pdfkit");
  }
}

// ── Genre colors ──────────────────────────────────────────────
const GENRE_COLOR = {
  theatre: "#4C1D95",
  poesie:  "#1E3A8A",
  roman:   "#7F1D1D",
  general: "#14532D",
};

function gc(genre) { return GENRE_COLOR[genre] || GENRE_COLOR.general; }

function parseJson(val, fallback = []) {
  try { return typeof val === "string" ? JSON.parse(val) : (val || fallback); } catch { return fallback; }
}

// ── Draw a section header bar ─────────────────────────────────
function drawSectionBar(doc, text, color, y) {
  doc.rect(40, y, doc.page.width - 80, 18).fill(color);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11)
     .text(text, 46, y + 4, { width: doc.page.width - 92 });
  doc.fillColor("#000000");
  return y + 22;
}

// ── Draw a divider line ───────────────────────────────────────
function drawDivider(doc, y) {
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).stroke("#E5E7EB");
  return y + 8;
}

// ── Render one AL page ────────────────────────────────────────
function renderAL(doc, al, isFirst) {
  if (!isFirst) doc.addPage();

  const W = doc.page.width - 80; // usable width
  const color = gc(al.genre);
  let y = 40;

  // ── AL title header ──
  doc.rect(40, y, W, 28).fill(color);
  const headerText = [
    al.label || al.id,
    al.author || "",
    al.title || "Sans titre",
  ].filter(Boolean).join("  —  ");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(14)
     .text(headerText, 46, y + 8, { width: W - 12 });
  doc.fillColor("#000000");
  y += 34;

  // ── INTRODUCTION ──
  y = drawSectionBar(doc, "INTRODUCTION", "#374151", y);

  // Parse intro — supports both object and string format
  const intro = al.introduction;
  const introLines = [];

  if (intro && typeof intro === "object") {
    if (intro.auteurContexte) introLines.push(intro.auteurContexte);
    if (intro.oeuvrePassage)  introLines.push(intro.oeuvrePassage);
    if (intro.problematique)  introLines.push(`Problématique : ${intro.problematique}`);
    if (intro.annoncePlan)    introLines.push(`Plan : ${intro.annoncePlan}`);
  } else if (typeof intro === "string" && intro) {
    introLines.push(intro);
  }

  if (!introLines.length) {
    introLines.push(`Texte étudié : ${al.title || "—"}  |  Auteur : ${al.author || "—"}`);
  }

  for (const line of introLines) {
    const needed = doc.heightOfString(`• ${line}`, { width: W - 12 }) + 4;
    if (y + needed > doc.page.height - 60) { doc.addPage(); y = 40; }
    doc.font("Helvetica").fontSize(10).fillColor("#1F2937")
       .text(`• ${line}`, 46, y, { width: W - 12 });
    y += needed + 2;
  }
  y += 6;

  // ── MOVEMENTS ──
  const movements = al.movements || [];
  if (!movements.length) {
    y = drawSectionBar(doc, "DÉVELOPPEMENT", "#374151", y);
    doc.font("Helvetica").fontSize(9).fillColor("#6B7280")
       .text("Aucun mouvement détecté — relancez l'analyse.", 46, y + 4, { width: W - 12 });
    y += 24;
  }

  for (const mov of movements) {
    const movLabel = `MOUVEMENT ${mov.number || movements.indexOf(mov) + 1} — ${mov.title || ""}${mov.lines ? `  (${mov.lines})` : ""}`;

    if (y + 40 > doc.page.height - 60) { doc.addPage(); y = 40; }
    y = drawSectionBar(doc, movLabel, color, y);

    // Phrase-thème
    if (mov.phraseTheme || mov.phrase_theme) {
      const pt = mov.phraseTheme || mov.phrase_theme;
      doc.font("Helvetica-Oblique").fontSize(10).fillColor("#374151")
         .text(pt, 46, y + 2, { width: W - 12 });
      y += doc.heightOfString(pt, { width: W - 12 }) + 8;
    }

    // Procedures
    const procs = mov.procedures || [];
    if (!procs.length) {
      doc.font("Helvetica").fontSize(10).fillColor("#9CA3AF")
         .text("Procédés non détectés.", 46, y, { width: W - 12 });
      y += 14;
    }

    for (const proc of procs.slice(0, 10)) {
      const line = `• ${proc.label} → ${proc.analysis || "—"}`;
      const needed = doc.heightOfString(line, { width: W - 12 }) + 3;

      if (y + needed > doc.page.height - 60) { doc.addPage(); y = 40; }

      doc.font("Helvetica").fontSize(10).fillColor("#374151")
         .text(line, 46, y, { width: W - 12 });
      y += needed;
    }
    y += 8;
  }

  // ── CONCLUSION ──
  if (y + 40 > doc.page.height - 60) { doc.addPage(); y = 40; }
  y = drawSectionBar(doc, "CONCLUSION", "#374151", y);

  const concl = al.conclusion;
  const conclLines = [];

  if (concl && typeof concl === "object") {
    if (concl.cheminement) conclLines.push(concl.cheminement);
    if (concl.reponse)     conclLines.push(`Réponse : ${concl.reponse}`);
    if (concl.ouverture)   conclLines.push(`Ouverture : ${concl.ouverture}`);
  } else if (typeof concl === "string" && concl) {
    conclLines.push(concl);
  }

  if (!conclLines.length) conclLines.push("Conclusion à compléter.");

  for (const line of conclLines) {
    const needed = doc.heightOfString(`• ${line}`, { width: W - 12 }) + 4;
    if (y + needed > doc.page.height - 60) { doc.addPage(); y = 40; }
    doc.font("Helvetica").fontSize(10).fillColor("#1F2937")
       .text(`• ${line}`, 46, y, { width: W - 12 });
    y += needed + 2;
  }

  // ── Oral bullets ──
  const bullets = parseJson(al.oral_bullets, al.oralBullets || []);
  if (bullets.length) {
    y += 4;
    if (y + 20 > doc.page.height - 60) { doc.addPage(); y = 40; }
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#6B7280")
       .text("BULLETS ORAUX", 46, y);
    y += 12;
    for (const b of bullets.slice(0, 4)) {
      const needed = doc.heightOfString(`→ ${b}`, { width: W - 12 }) + 3;
      if (y + needed > doc.page.height - 60) { doc.addPage(); y = 40; }
      doc.font("Helvetica").fontSize(9).fillColor("#374151")
         .text(`→ ${b}`, 46, y, { width: W - 12 });
      y += needed;
    }
  }

  // Footer
  doc.font("Helvetica").fontSize(7).fillColor("#9CA3AF")
     .text(`Bac Oral Studio — ${al.label || al.id}`, 40, doc.page.height - 30, { width: W, align: "center" });
}

// ── Main export function ──────────────────────────────────────
export async function exportPDF({ entries = [], outputDir, scope = "all", alId }) {
  const PDFDocument = await getPDFKit();

  // Filter entries
  let toExport = entries;
  if (alId) toExport = entries.filter(e => e.id === alId);
  if (!toExport.length) throw new Error("No ALs to export");

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: { Title: "Bac Oral Studio — Fiches de révision", Author: "Bac Oral Studio" },
  });

  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `bac-oral-${alId ? alId : "all"}-${Date.now()}.pdf`;
  const filePath = path.join(outputDir, fileName);

  const { createWriteStream } = await import("node:fs");
  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  toExport.forEach((al, i) => renderAL(doc, al, i === 0));

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { fileName, filePath };
}

// ============================================================
// lib/export-workbook.mjs — Excel export via ExcelJS
// FIX: replaces @oai/artifact-tool (doesn't exist on npm)
// Requires: npm install exceljs
// ============================================================
import path from "node:path";
import fs from "node:fs/promises";

// Dynamic import so server still starts if exceljs missing
async function getExcelJS() {
  try {
    const mod = await import("exceljs");
    return mod.default || mod;
  } catch {
    throw new Error("exceljs not installed — run: npm install exceljs");
  }
}

// ── Helpers ───────────────────────────────────────────────────
function slugify(str = "") {
  return str.toLowerCase()
    .replace(/[àáâã]/g, "a").replace(/[éèêë]/g, "e")
    .replace(/[îï]/g, "i").replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u")
    .replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").slice(0, 40);
}

function safeSheetName(label = "") {
  return label.replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "AL";
}

function bulletList(items = []) {
  return (items || []).filter(Boolean).map(i => `• ${i}`).join("\n");
}

// ── Color palettes ────────────────────────────────────────────
const GENRE_COLORS = {
  theatre: { header: "4C1D95", light: "EDE9FE" },
  poesie:  { header: "1E3A8A", light: "DBEAFE" },
  roman:   { header: "7F1D1D", light: "FEE2E2" },
  general: { header: "14532D", light: "DCFCE7" },
};

function genreColor(genre) {
  return GENRE_COLORS[genre] || GENRE_COLORS.general;
}

// ── Cell styling helpers ──────────────────────────────────────
function styleHeader(cell, bgHex, fgHex = "FFFFFF", size = 11) {
  cell.font = { bold: true, color: { argb: "FF" + fgHex }, size };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgHex } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  cell.border = {
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right:  { style: "thin", color: { argb: "FFD1D5DB" } },
  };
}

function styleCell(cell, bgHex = "FFFFFF", fgHex = "111827", bold = false, size = 10) {
  cell.font = { bold, color: { argb: "FF" + fgHex }, size };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgHex } };
  cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
  cell.border = {
    bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
    right:  { style: "hair", color: { argb: "FFE5E7EB" } },
  };
}

function mergeHeader(ws, row, col1, col2, text, bgHex, fgHex = "FFFFFF", size = 12) {
  ws.mergeCells(row, col1, row, col2);
  const cell = ws.getCell(row, col1);
  cell.value = text;
  styleHeader(cell, bgHex, fgHex, size);
  ws.getRow(row).height = 26;
}

// ── Summary sheet ─────────────────────────────────────────────
function buildSummarySheet(wb, entries, project) {
  const ws = wb.addWorksheet("Sommaire");
  ws.views = [{ showGridLines: false }];
  ws.columns = [
    { width: 10 }, { width: 32 }, { width: 28 },
    { width: 12 }, { width: 14 }, { width: 22 },
  ];

  // Title
  mergeHeader(ws, 1, 1, 6, "Bac Oral Studio — Fiches de révision", "17324D", "FFFFFF", 15);

  // Stats row
  ws.mergeCells(2, 1, 2, 3);
  ws.getCell(2, 1).value =
    `${entries.length} AL  •  ` +
    `${entries.filter(e => (e.oralBullets || e.oral_bullets || []).length >= 2).length} prêtes oral`;
  styleCell(ws.getCell(2, 1), "F3F4F6", "374151", true, 10);
  ws.getRow(2).height = 18;

  // Table headers
  const headers = ["AL", "Titre", "Séquence", "Genre", "Procédés", "Alertes"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    styleHeader(cell, "17324D", "FFFFFF", 10);
  });
  ws.getRow(4).height = 18;

  // Table rows
  entries.forEach((e, i) => {
    const r = 5 + i;
    const bg = i % 2 === 0 ? "F9FAFB" : "FFFFFF";
    const oral = JSON.parse(e.oral_bullets || "[]");
    const flags = JSON.parse(e.quality_flags || "[]");
    const procs = (e.movements || []).flatMap(m => m.procedures || []);

    [
      e.label || e.id,
      e.title || "",
      e.sequenceLabel || e.sequence_label || "",
      e.genre || "",
      procs.length || 0,
      flags.join(", ") || "OK",
    ].forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 1);
      cell.value = val;
      styleCell(cell, bg);
    });
    ws.getRow(r).height = 16;
  });

  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
}

// ── Per-AL worksheet ──────────────────────────────────────────
function buildALSheet(wb, entry) {
  const label = safeSheetName(`${entry.label || entry.id} — ${(entry.title || "").slice(0, 18)}`);
  const ws = wb.addWorksheet(label);
  ws.views = [{ showGridLines: false }];

  ws.columns = [
    { width: 22 }, // Mouvement
    { width: 30 }, // Idée-force
    { width: 20 }, // Procédé
    { width: 10 }, // Citation
    { width: 32 }, // Analyse
    { width: 8  }, // Poids
  ];

  const gc = genreColor(entry.genre);
  let row = 1;

  // AL title header
  mergeHeader(ws, row, 1, 6,
    `${entry.label || entry.id}  —  ${entry.title || "Sans titre"}`,
    gc.header, "FFFFFF", 13
  );
  row++;

  // Meta
  ws.mergeCells(row, 1, row, 4);
  ws.getCell(row, 1).value =
    `${entry.author || ""}${entry.author && entry.genre ? "  |  " : ""}${(entry.genre || "").toUpperCase()}`;
  styleCell(ws.getCell(row, 1), "F3F4F6", "374151", true, 9);
  ws.getRow(row).height = 16;
  row++;

  // Introduction
  const intro = entry.introduction || "";
  if (intro) {
    mergeHeader(ws, row, 1, 6, "INTRODUCTION", "E5E7EB", "374151", 9);
    row++;
    ws.mergeCells(row, 1, row, 6);
    ws.getCell(row, 1).value = intro;
    styleCell(ws.getCell(row, 1), "FAFAFA", "374151", false, 10);
    ws.getRow(row).height = Math.max(30, Math.ceil(intro.length / 90) * 15);
    row++;
  }

  // Column headers
  const cols = ["MOUVEMENT", "IDÉE-FORCE", "PROCÉDÉ", "CITATION", "ANALYSE", "POIDS"];
  const colColors = ["DC2626", "2563EB", "16A34A", "7C3AED", "CA8A04", "6B7280"];
  cols.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeader(cell, colColors[i], "FFFFFF", 9);
  });
  ws.getRow(row).height = 17;
  row++;

  // Movements
  const movements = entry.movements || [];
  if (!movements.length) {
    ws.mergeCells(row, 1, row, 6);
    ws.getCell(row, 1).value = "Aucun mouvement détecté";
    styleCell(ws.getCell(row, 1), "FEF9C3", "854D0E");
    ws.getRow(row).height = 20;
    row++;
  }

  movements.forEach((mov, mi) => {
    const procs = mov.procedures || [];
    const bullets = mov.bullets || [];
    const rowCount = Math.max(1, procs.length);
    const altBg = mi % 2 === 0 ? "F8FAFC" : "FFFFFF";

    // Merge mouvement title cell
    if (rowCount > 1) ws.mergeCells(row, 1, row + rowCount - 1, 1);
    ws.getCell(row, 1).value = mov.title || `Mouvement ${mi + 1}`;
    styleCell(ws.getCell(row, 1), gc.light, "1F2937", true, 10);

    // Merge idée-force cell
    if (rowCount > 1) ws.mergeCells(row, 2, row + rowCount - 1, 2);
    ws.getCell(row, 2).value = bulletList(bullets);
    styleCell(ws.getCell(row, 2), altBg, "374151", false, 10);

    // Procedure rows
    for (let pi = 0; pi < rowCount; pi++) {
      const p = procs[pi] || {};
      const r = row + pi;
      const bg = pi % 2 === 0 ? altBg : "FFFFFF";
      const weightColor = (p.weight || 3) >= 4 ? "14532D" : (p.weight || 3) >= 2 ? "78350F" : "374151";

      ws.getCell(r, 3).value = p.label || "";
      styleCell(ws.getCell(r, 3), bg, "374151", false, 10);

      ws.getCell(r, 4).value = p.quote || "";
      styleCell(ws.getCell(r, 4), bg, "6B7280", false, 9);

      ws.getCell(r, 5).value = p.analysis || "";
      styleCell(ws.getCell(r, 5), bg, "111827", false, 10);

      ws.getCell(r, 6).value = p.weight ? "●".repeat(p.weight) + "○".repeat(5 - p.weight) : "";
      styleCell(ws.getCell(r, 6), bg, weightColor, false, 9);

      ws.getRow(r).height = 20;
    }

    row += rowCount;
  });

  // Oral bullets
  const oralBullets = entry.oralBullets ||
    (entry.oral_bullets ? JSON.parse(entry.oral_bullets) : []);
  if (oralBullets.length) {
    mergeHeader(ws, row, 1, 6, "BULLETS ORAUX — RÉVISION RAPIDE", "B45309", "FFFFFF", 9);
    row++;
    ws.mergeCells(row, 1, row, 6);
    ws.getCell(row, 1).value = bulletList(oralBullets);
    styleCell(ws.getCell(row, 1), "FFFBEB", "374151", false, 10);
    ws.getRow(row).height = Math.max(28, oralBullets.length * 16);
    row++;
  }

  // Conclusion
  const conclusion = entry.conclusion || "";
  if (conclusion) {
    mergeHeader(ws, row, 1, 6, "CONCLUSION + OUVERTURE", "E5E7EB", "374151", 9);
    row++;
    ws.mergeCells(row, 1, row, 6);
    ws.getCell(row, 1).value = conclusion;
    styleCell(ws.getCell(row, 1), "FAFAFA", "374151", false, 10);
    ws.getRow(row).height = Math.max(30, Math.ceil(conclusion.length / 90) * 15);
  }

  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
}

// ── Filter entries by scope ───────────────────────────────────
function getEntries(project, scope) {
  const all = project.entries || [];
  if (scope.type === "single")   return all.filter(e => e.id === scope.value);
  if (scope.type === "sequence") return all.filter(e => e.sequenceId === scope.value);
  return all;
}

// ── Main export function ──────────────────────────────────────
export async function exportWorkbook({ project, scope = { type: "full" }, options = {}, outputDir }) {
  const ExcelJS = await getExcelJS();
  const entries = getEntries(project, scope);

  if (!entries.length) throw new Error("Aucune AL à exporter");

  const wb = new ExcelJS.Workbook();
  wb.creator  = "Bac Oral Studio";
  wb.created  = new Date();
  wb.modified = new Date();

  buildSummarySheet(wb, entries, project);
  for (const entry of entries) buildALSheet(wb, entry);

  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `bac-oral-${slugify(scope.type)}-${Date.now()}.xlsx`;
  const filePath = path.join(outputDir, fileName);
  await wb.xlsx.writeFile(filePath);

  return { fileName, filePath };
}

import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

import { ensureCompleteEntry, slugify, isOcrNoiseDetected } from "./revision-engine.mjs";

function paletteFor(options = {}) {
  if (options.mode === "high-contrast" || options.contrast === "high") {
    return {
      ink: "#0F172A",
      paper: "#FFFFFF",
      muted: "#E2E8F0",
      accent: "#0F766E",
      accentSoft: "#CCFBF1",
      line: "#1E293B",
      warm: "#FDE68A",
      subtle: "#F8FAFC",
    };
  }

  if (options.mode === "detailed") {
    return {
      ink: "#15304B",
      paper: "#FFFFFF",
      muted: "#E8EEF4",
      accent: "#C66D18",
      accentSoft: "#FFF3E4",
      line: "#C9D6E1",
      warm: "#FFF7D6",
      subtle: "#FAFBFC",
    };
  }

  return {
    ink: "#17324D",
    paper: "#FFFFFF",
    muted: "#EDF2F7",
    accent: "#B45309",
    accentSoft: "#FFF4E8",
    line: "#D7E2EA",
    warm: "#FFF9DB",
    subtle: "#F8FAFC",
  };
}

function safeSheetName(value = "") {
  return value.slice(0, 31) || "Révision";
}

function writeMerged(sheet, range, value, format) {
  // Parse the range to get start cell (e.g., "A1" from "A1:G1")
  const startCell = range.split(":")[0];
  
  const cell = sheet.getRange(range);
  cell.merge();
  
  // Set value only on the first cell to avoid duplication across all merged cells
  sheet.getRange(startCell).values = [[value]];
  cell.format = format;
}

function joinBullets(items = [], prefix = "•") {
  return items.filter(Boolean).map((item) => `${prefix} ${item}`).join("\n");
}

function filteredEntries(project = {}, scope = { type: "full" }) {
  return (project.entries || [])
    .filter((entry) => {
      if (scope.type === "single") {
        return entry.id === scope.value;
      }
      if (scope.type === "sequence") {
        return entry.sequenceId === scope.value;
      }
      return true;
    })
    .map((entry) => ensureCompleteEntry(entry, entry.sequenceMeta));
}

function writeSummarySheet(workbook, project, entries, options, palette) {
  const sheet = workbook.worksheets.add("Sommaire");
  sheet.showGridLines = false;
  sheet.getRange("A:G").format.columnWidthPx = 150;
  sheet.getRange("C:C").format.columnWidthPx = 280;
  sheet.getRange("A1:G40").format.wrapText = true;

  writeMerged(sheet, "A1:G1", "Bac Oral Studio - Feuille de révision", {
    fill: palette.ink,
    font: { color: "#FFFFFF", bold: true, size: 16 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  });

  writeMerged(sheet, "A3:D3", "Configuration du projet", {
    fill: palette.accentSoft,
    font: { color: palette.ink, bold: true, size: 12 },
  });
  sheet.getRange("A4:B8").values = [
    ["Séquence active", project.selectedSequenceLabel || "Toutes"],
    ["Lecture cursive", project.selectedLectureCursive || "Non renseignée"],
    ["Mode d'export", options.mode || "minimalist"],
    ["Contraste", options.contrast || "soft"],
    ["Format", "Excel"],
  ];
  sheet.getRange("A4:B8").format = {
    fill: palette.subtle,
    font: { color: palette.ink },
  };

  writeMerged(sheet, "E3:G3", "Indicateurs rapides", {
    fill: palette.accentSoft,
    font: { color: palette.ink, bold: true, size: 12 },
  });
  sheet.getRange("E4:F8").values = [
    ["AL incluses", entries.length],
    ["AL avec source", entries.filter((entry) => entry.sourceText).length],
    ["AL prêtes à l'oral", entries.filter((entry) => entry.oralBullets?.length >= 3).length],
    ["Procédés prioritaires", "3 à 5"],
    ["Objectif", "1 AL < 3 min"],
  ];
  sheet.getRange("E4:F8").format = {
    fill: palette.warm,
    font: { color: palette.ink },
  };

  sheet.getRange("A10:G10").values = [[
    "AL",
    "Séquence",
    "Titre",
    "Genre",
    "OCR",
    "Oral prêt",
    "Alerte qualité",
  ]];
  sheet.getRange("A10:G10").format = {
    fill: palette.ink,
    font: { color: "#FFFFFF", bold: true },
    horizontalAlignment: "center",
  };

  if (entries.length) {
    sheet.getRange(`A11:G${10 + entries.length}`).values = entries.map((entry) => [
      entry.label || entry.id,
      entry.sequenceLabel || entry.sequenceMeta?.label || "",
      entry.title,
      entry.genre,
      entry.sourceText ? "Oui" : "Non",
      entry.oralBullets?.length >= 3 ? "Oui" : "À compléter",
      entry.qualityFlags?.length ? entry.qualityFlags.join(", ") : "RAS",
    ]);
  }

  sheet.freezePanes.freezeRows(10);
}

function writeEntryBlock(sheet, startRow, entry, palette, options) {
  // ELITE VISUAL EXCELLENCE: Validate source text quality before export
  if (!entry.sourceText || isOcrNoiseDetected(entry.sourceText)) {
    console.warn(`Skipping AL ${entry.label} - noisy or missing source text`);
    return startRow; // Skip this entry
  }

  // Créer une copie profonde pour éviter les mutations croisées entre les AL
  const entryCopy = JSON.parse(JSON.stringify(entry));

  // Récupérer les procédures uniquement de cette AL (copie profonde)
  const procedures = (entryCopy.keyProcedures || [])
    .slice(0, options.mode === "detailed" ? 5 : 4)
    .map(p => ({ ...p })); // Copie supplémentaire pour la sécurité

  const sourceExcerpt = entryCopy.sourceText
    ? entryCopy.sourceText.slice(0, options.mode === "detailed" ? 900 : 520)
    : "Source non fournie";

  // ELITE VISUAL EXCELLENCE: Scannable header with strong contrast
  writeMerged(sheet, `A${startRow}:H${startRow}`, `${entryCopy.label} - ${entryCopy.title}`, {
    fill: palette.accent, // Strong accent color for instant recognition
    font: { color: "#FFFFFF", bold: true, size: 14 },
    verticalAlignment: "center",
    horizontalAlignment: "center",
  });

  // ELITE VISUAL EXCELLENCE: Color-coded column headers for instant understanding
  const headers = [
    { text: "MOUVEMENT", color: "#DC2626" }, // Red for structure
    { text: "IDÉE-FORCE", color: "#2563EB" }, // Blue for content
    { text: "PROCÉDÉS", color: "#16A34A" }, // Green for techniques
    { text: "IMPACT", color: "#CA8A04" }, // Yellow for interpretation
    { text: "ORAL RAPIDE", color: "#9333EA" }, // Purple for performance
  ];

  headers.forEach((header, index) => {
    const col = String.fromCharCode(65 + index); // A, B, C, D, E
    sheet.getRange(`${col}${startRow + 1}`).values = [[header.text]];
    sheet.getRange(`${col}${startRow + 1}`).format = {
      fill: header.color,
      font: { color: "#FFFFFF", bold: true, size: 11 },
      horizontalAlignment: "center",
      verticalAlignment: "center",
    };
  });

  // ELITE VISUAL EXCELLENCE: Perfect alignment and spacing
  const movementRows = [];
  const maxRows = Math.max(3, procedures.length);

  for (let index = 0; index < maxRows; index += 1) {
    const movement = entryCopy.movements?.[index];
    const procedure = procedures[index];

    movementRows.push([
      // Movement title - clear progression
      movement?.title || "",
      // Bullets - optimized for memory (2-4 max)
      joinBullets((movement?.bullets || []).slice(0, 4), "→"),
      // Procedure - elite interpretation
      procedure?.label || "",
      // Impact - interpretive insight
      procedure?.impact || "",
      // Oral bullet - performative, reusable
      entryCopy.oralBullets?.[index] ? `🎯 ${entryCopy.oralBullets[index]}` : "",
    ]);
  }

  // ELITE VISUAL EXCELLENCE: Alternating row colors for scannability
  for (let i = 0; i < movementRows.length; i++) {
    const rowNum = startRow + 2 + i;
    const rowRange = `A${rowNum}:E${rowNum}`;

    sheet.getRange(rowRange).values = [movementRows[i]];
    sheet.getRange(rowRange).format = {
      wrapText: true,
      verticalAlignment: "top",
      font: { color: palette.ink, size: 10 },
      fill: i % 2 === 0 ? palette.subtle : "#FFFFFF", // Alternating colors
    };
  }

  // ELITE VISUAL EXCELLENCE: Source text in dedicated, clearly marked section
  writeMerged(sheet, `F${startRow + 1}:H${startRow + 1}`, "📖 SOURCE - RAPPEL DU PASSAGE", {
    fill: "#1F2937", // Dark gray for source section
    font: { color: "#FFFFFF", bold: true, size: 11 },
    horizontalAlignment: "center",
  });

  writeMerged(sheet, `F${startRow + 2}:H${startRow + 1 + maxRows}`, sourceExcerpt, {
    fill: "#F9FAFB", // Light gray background
    font: { color: palette.ink, size: 9, italic: true },
    verticalAlignment: "top",
    wrapText: true,
    borders: {
      top: { style: "continuous", color: palette.line },
      bottom: { style: "continuous", color: palette.line },
      left: { style: "continuous", color: palette.line },
      right: { style: "continuous", color: palette.line },
    },
  });

  // ELITE VISUAL EXCELLENCE: Oral summary at bottom with visual emphasis
  const oralSummary = joinBullets(entryCopy.oralBullets || [], "🎯");
  writeMerged(sheet, `A${startRow + 2 + maxRows}:H${startRow + 2 + maxRows}`, oralSummary, {
    fill: palette.warm,
    font: { color: palette.ink, bold: true, size: 11 },
    wrapText: true,
    verticalAlignment: "top",
    borders: {
      top: { style: "thick", color: palette.accent },
      bottom: { style: "thick", color: palette.accent },
      left: { style: "thick", color: palette.accent },
      right: { style: "thick", color: palette.accent },
    },
  });

  // ELITE VISUAL EXCELLENCE: Clean borders for entire block
  const blockRange = `A${startRow}:H${startRow + 2 + maxRows}`;
  sheet.getRange(blockRange).format.borders = {
    top: { style: "continuous", color: palette.line },
    bottom: { style: "continuous", color: palette.line },
    left: { style: "continuous", color: palette.line },
    right: { style: "continuous", color: palette.line },
  };

  return startRow + maxRows + 4;
}

function writeSequenceSheet(workbook, sequenceEntries, palette, options, project) {
  const first = sequenceEntries[0];
  const sheet = workbook.worksheets.add(
    safeSheetName(first?.sequenceLabel || first?.sequenceMeta?.label || "Séquence"),
  );
  sheet.showGridLines = false;
  sheet.getRange("A:A").format.columnWidthPx = 180;
  sheet.getRange("B:B").format.columnWidthPx = 220;
  sheet.getRange("C:C").format.columnWidthPx = 165;
  sheet.getRange("D:D").format.columnWidthPx = 190;
  sheet.getRange("E:E").format.columnWidthPx = 180;
  sheet.getRange("F:H").format.columnWidthPx = 150;
  sheet.getRange("A:H").format.wrapText = true;

  const sequenceLabel = first?.sequenceLabel || first?.sequenceMeta?.label || "Séquence";
  writeMerged(sheet, "A1:H1", sequenceLabel, {
    fill: palette.ink,
    font: { color: "#FFFFFF", bold: true, size: 15 },
    horizontalAlignment: "center",
  });
  writeMerged(
    sheet,
    "A3:H3",
    [
      first?.sequenceMeta?.objectStudy || "",
      first?.sequenceMeta?.work?.author || "",
      first?.sequenceMeta?.work?.title || "",
      first?.sequenceMeta?.parcours || "",
      project.selectedLectureCursive ? `Lecture cursive : ${project.selectedLectureCursive}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    {
      fill: palette.subtle,
      font: { color: palette.ink, bold: true, size: 11 },
      verticalAlignment: "center",
      wrapText: true,
    },
  );

  let nextRow = 5;
  for (const entry of sequenceEntries) {
    nextRow = writeEntryBlock(sheet, nextRow, entry, palette, options);
  }
  sheet.freezePanes.freezeRows(4);
}

export async function exportWorkbook({
  project,
  scope = { type: "full" },
  options = { contrast: "soft", mode: "minimalist" },
  outputDir,
}) {
  const palette = paletteFor(options);
  const entries = filteredEntries(project, scope);
  const workbook = Workbook.create();

  writeSummarySheet(workbook, project, entries, options, palette);

  const grouped = new Map();
  for (const entry of entries) {
    const key = entry.sequenceId || "sequence";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(entry);
  }

  for (const sequenceEntries of grouped.values()) {
    writeSequenceSheet(workbook, sequenceEntries, palette, options, project);
  }

  await fs.mkdir(outputDir, { recursive: true });
  const scopeLabel = scope.type === "single" ? scope.value : scope.type;
  const fileName = `bac-oral-${slugify(scopeLabel || "full")}-${Date.now()}.xlsx`;
  const filePath = path.join(outputDir, fileName);
  const exported = await SpreadsheetFile.exportXlsx(workbook);
  await exported.save(filePath);

  return { fileName, filePath };
}

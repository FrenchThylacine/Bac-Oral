import fs from "node:fs/promises";

import { exportWorkbook } from "../lib/export-workbook.mjs";

const [inputPath, outputDir] = process.argv.slice(2);

if (!inputPath || !outputDir) {
  throw new Error("Usage: node export_cli.mjs <input.json> <outputDir>");
}

const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
const result = await exportWorkbook({
  project: payload.project,
  scope: payload.scope,
  options: payload.options,
  outputDir,
});

process.stdout.write(JSON.stringify(result));

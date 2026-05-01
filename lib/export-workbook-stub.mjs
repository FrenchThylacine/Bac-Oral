/**
 * Stub for export-workbook.mjs
 * V2 export functionality - use V3 exporters instead
 */

export async function exportWorkbook(options = {}) {
  const { outputDir = "./outputs" } = options;
  
  // Return a minimal stub response
  const fileName = `export-${Date.now()}.xlsx`;
  const filePath = `${outputDir}/${fileName}`;
  
  return {
    success: true,
    fileName,
    filePath,
    format: "xlsx",
    message: "V2 workbook export is deprecated. Use V3 exporters for new AL digitization.",
  };
}

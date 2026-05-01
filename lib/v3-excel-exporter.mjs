/**
 * V3 Excel Exporter - Generate Excel files (full data, one AL per tab)
 * Uses exceljs for real Excel format
 */

import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

const OUTPUTS_DIR = 'outputs';

// Color mapping for genre
const GENRE_COLORS = {
  theatre: 'FF7B2CBF',
  poesie: 'FF3A86FF',
  roman: 'FFFF006E',
  general: 'FF9E9E9E',
};

function getGenreColor(genre) {
  return GENRE_COLORS[genre] || GENRE_COLORS.general;
}

export async function exportToExcel(al, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `${al.id}_full.xlsx`);
  const workbook = new ExcelJS.Workbook();
  
  // Create worksheet for this AL
  const sheetName = (al.title || 'AL').substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);
  
  let row = 1;
  const genreColor = getGenreColor(al.genre);
  
  // Title
  worksheet.mergeCells(`A${row}:E${row}`);
  const titleCell = worksheet.getCell(`A${row}`);
  titleCell.value = al.title || 'Analyse Littéraire';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: genreColor } };
  titleCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
  worksheet.getRow(row).height = 25;
  row += 2;
  
  // Introduction
  worksheet.mergeCells(`A${row}:E${row}`);
  const introLabel = worksheet.getCell(`A${row}`);
  introLabel.value = 'INTRODUCTION';
  introLabel.font = { bold: true, size: 12 };
  introLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  row += 1;
  
  worksheet.mergeCells(`A${row}:E${row+1}`);
  const introCell = worksheet.getCell(`A${row}`);
  introCell.value = al.intro || '';
  introCell.alignment = { wrapText: true, vertical: 'top' };
  worksheet.getRow(row).height = 40;
  row += 3;
  
  // Movements and Procedures
  worksheet.getCell(`A${row}`).value = 'Mouvement';
  worksheet.getCell(`B${row}`).value = 'Idée-force';
  worksheet.getCell(`C${row}`).value = 'Procédés';
  worksheet.getCell(`D${row}`).value = 'Analyses';
  worksheet.getCell(`E${row}`).value = 'Oral rapide';
  
  for (let col = 1; col <= 5; col++) {
    const cell = worksheet.getCell(row, col);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } };
    cell.alignment = { horizontal: 'center', wrapText: true };
  }
  worksheet.getRow(row).height = 20;
  row += 1;
  
  // Data rows
  for (const movement of al.movements || []) {
    let isFirstProc = true;
    
    for (const proc of movement.procedures || []) {
      worksheet.getCell(`A${row}`).value = isFirstProc ? movement.name : '';
      worksheet.getCell(`B${row}`).value = movement.name;
      worksheet.getCell(`C${row}`).value = proc.label || proc.name || '';
      worksheet.getCell(`D${row}`).value = (proc.analyses || []).join('\n') || proc.analysis || '';
      worksheet.getCell(`E${row}`).value = proc.oralBullet || '';
      
      for (let col = 1; col <= 5; col++) {
        const cell = worksheet.getCell(row, col);
        cell.alignment = { wrapText: true, vertical: 'top' };
      }
      
      worksheet.getRow(row).height = 30;
      row += 1;
      isFirstProc = false;
    }
  }
  
  row += 1;
  
  // Conclusion
  worksheet.mergeCells(`A${row}:E${row}`);
  const concludeLabel = worksheet.getCell(`A${row}`);
  concludeLabel.value = 'CONCLUSION';
  concludeLabel.font = { bold: true, size: 12 };
  concludeLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  row += 1;
  
  worksheet.mergeCells(`A${row}:E${row+1}`);
  const concludeCell = worksheet.getCell(`A${row}`);
  concludeCell.value = al.conclusion || '';
  concludeCell.alignment = { wrapText: true, vertical: 'top' };
  worksheet.getRow(row).height = 40;
  
  // Column widths
  worksheet.columns = [
    { width: 18 },
    { width: 18 },
    { width: 20 },
    { width: 25 },
    { width: 20 },
  ];
  
  // Save file
  await workbook.xlsx.writeFile(fileName);
  console.log('[Export] Excel created:', fileName);
  
  return {
    success: true,
    file: fileName,
    size: (await fs.promises.stat(fileName)).size,
  };
}

export async function exportMultipleALsToExcel(als, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `bac-oral-${Date.now()}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  
  for (const al of als) {
    const sheetName = (al.title || 'AL').substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);
    
    let row = 1;
    const genreColor = getGenreColor(al.genre);
    
    // Title
    worksheet.mergeCells(`A${row}:E${row}`);
    const titleCell = worksheet.getCell(`A${row}`);
    titleCell.value = al.title || 'Analyse Littéraire';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: genreColor } };
    titleCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    worksheet.getRow(row).height = 25;
    row += 2;
    
    // Introduction
    worksheet.mergeCells(`A${row}:E${row}`);
    const introLabel = worksheet.getCell(`A${row}`);
    introLabel.value = 'INTRODUCTION';
    introLabel.font = { bold: true, size: 12 };
    introLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    row += 1;
    
    worksheet.mergeCells(`A${row}:E${row+1}`);
    const introCell = worksheet.getCell(`A${row}`);
    introCell.value = al.intro || '';
    introCell.alignment = { wrapText: true, vertical: 'top' };
    worksheet.getRow(row).height = 40;
    row += 3;
    
    // Headers
    worksheet.getCell(`A${row}`).value = 'Mouvement';
    worksheet.getCell(`B${row}`).value = 'Idée-force';
    worksheet.getCell(`C${row}`).value = 'Procédés';
    worksheet.getCell(`D${row}`).value = 'Analyses';
    worksheet.getCell(`E${row}`).value = 'Oral rapide';
    
    for (let col = 1; col <= 5; col++) {
      const cell = worksheet.getCell(row, col);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } };
      cell.alignment = { horizontal: 'center', wrapText: true };
    }
    worksheet.getRow(row).height = 20;
    row += 1;
    
    // Data
    for (const movement of al.movements || []) {
      let isFirstProc = true;
      
      for (const proc of movement.procedures || []) {
        worksheet.getCell(`A${row}`).value = isFirstProc ? movement.name : '';
        worksheet.getCell(`B${row}`).value = movement.name;
        worksheet.getCell(`C${row}`).value = proc.label || proc.name || '';
        worksheet.getCell(`D${row}`).value = (proc.analyses || []).join('\n') || proc.analysis || '';
        worksheet.getCell(`E${row}`).value = proc.oralBullet || '';
        
        for (let col = 1; col <= 5; col++) {
          const cell = worksheet.getCell(row, col);
          cell.alignment = { wrapText: true, vertical: 'top' };
        }
        
        worksheet.getRow(row).height = 30;
        row += 1;
        isFirstProc = false;
      }
    }
    
    row += 1;
    
    // Conclusion
    worksheet.mergeCells(`A${row}:E${row}`);
    const concludeLabel = worksheet.getCell(`A${row}`);
    concludeLabel.value = 'CONCLUSION';
    concludeLabel.font = { bold: true, size: 12 };
    concludeLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    row += 1;
    
    worksheet.mergeCells(`A${row}:E${row+1}`);
    const concludeCell = worksheet.getCell(`A${row}`);
    concludeCell.value = al.conclusion || '';
    concludeCell.alignment = { wrapText: true, vertical: 'top' };
    worksheet.getRow(row).height = 40;
    
    // Column widths
    worksheet.columns = [
      { width: 18 },
      { width: 18 },
      { width: 20 },
      { width: 25 },
      { width: 20 },
    ];
  }
  
  // Save file
  await workbook.xlsx.writeFile(fileName);
  console.log('[Export] Multi-AL Excel created:', fileName);
  
  return {
    success: true,
    file: fileName,
    alCount: als.length,
  };
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }
}

export function getExportPath(alId, format = 'xlsx') {
  ensureOutputDir();
  return path.join(OUTPUTS_DIR, `${alId}.${format}`);
}

export default {
  exportToExcel,
  exportMultipleALsToExcel,
  getExportPath,
};

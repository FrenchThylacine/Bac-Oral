/**
 * V3 Excel Exporter - Generate Excel files (full data, one AL per tab)
 */

import fs from 'fs';
import path from 'path';

const OUTPUTS_DIR = 'outputs';

export async function exportToExcel(al, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `${al.id}_full.xlsx`);
  
  // Build simplified Excel-like CSV for now (full Excel would need xlsx package)
  const lines = [];
  
  // Header
  lines.push('AL: ' + al.title);
  lines.push('');
  lines.push('INTRODUCTION');
  lines.push(al.intro || '');
  lines.push('');
  
  // Movements and Procedures
  lines.push('CONTENT');
  lines.push('Movement,Procedure,Type,Analyses');
  
  for (const movement of al.movements || []) {
    let isFirstProcedure = true;
    
    for (const procedure of movement.procedures || []) {
      const analyses = (procedure.analyses || []).join(' | ');
      
      if (isFirstProcedure) {
        lines.push(`"${movement.name}","${procedure.name}","${procedure.type}","${analyses}"`);
        isFirstProcedure = false;
      } else {
        lines.push(`,"${procedure.name}","${procedure.type}","${analyses}"`);
      }
    }
  }
  
  lines.push('');
  lines.push('CONCLUSION');
  lines.push(al.conclusion || '');
  
  const content = lines.join('\n');
  fs.writeFileSync(fileName, content, 'utf8');
  
  console.log('[Export] Excel created:', fileName);
  
  return {
    success: true,
    file: fileName,
    size: content.length,
  };
}

export async function exportMultipleALsToExcel(als, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `bac-oral-${Date.now()}.xlsx`);
  
  let content = '';
  
  for (const al of als) {
    content += `=== SHEET: ${al.title} ===\n`;
    content += `ID: ${al.id}\n`;
    content += `Intro: ${al.intro || ''}\n`;
    content += `\nMovement,Procedure,Type,Analyses\n`;
    
    for (const movement of al.movements || []) {
      for (const proc of movement.procedures || []) {
        const analyses = (proc.analyses || []).join(' | ');
        content += `"${movement.name}","${proc.name}","${proc.type}","${analyses}"\n`;
      }
    }
    
    content += `\nConclusion: ${al.conclusion || ''}\n`;
    content += `\n--- END OF ${al.title} ---\n\n`;
  }
  
  fs.writeFileSync(fileName, content, 'utf8');
  
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

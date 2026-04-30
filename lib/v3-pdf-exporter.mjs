/**
 * V3 PDF Exporter - Generate PDF summaries (top 10 procedures/movement)
 */

import fs from 'fs';
import path from 'path';

const OUTPUTS_DIR = 'outputs';
const MAX_PROCEDURES_PER_MOVEMENT = 10;
const MAX_BULLET_POINTS = 5;

export async function exportToPDF(al, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `${al.id}_summary.pdf.txt`);
  
  const content = generatePDFContent(al);
  
  fs.writeFileSync(fileName, content, 'utf8');
  
  console.log('[Export] PDF created:', fileName);
  
  return {
    success: true,
    file: fileName,
    size: content.length,
    pages: Math.ceil(content.length / 3000),
  };
}

function generatePDFContent(al) {
  let content = '';
  
  // Title Page
  content += '='.repeat(60) + '\n';
  content += al.title.toUpperCase().padStart((60 + al.title.length) / 2).padEnd(60) + '\n';
  content += '='.repeat(60) + '\n';
  content += '\n';
  
  // Intro
  content += 'INTRODUCTION\n';
  content += '-'.repeat(40) + '\n';
  content += (al.intro || 'No introduction provided') + '\n';
  content += '\n\n';
  
  // Movements (filtered to top 10 procedures each)
  content += 'ANALYSIS\n';
  content += '='.repeat(60) + '\n';
  content += '\n';
  
  for (const movement of al.movements || []) {
    content += `Movement: ${movement.name}\n`;
    content += '-'.repeat(40) + '\n';
    
    const topProcedures = (movement.procedures || [])
      .slice(0, MAX_PROCEDURES_PER_MOVEMENT)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    for (const procedure of topProcedures) {
      content += `\n  • ${procedure.name}\n`;
      content += `    Type: ${procedure.type} | Color: ${procedure.color}\n`;
      
      const analyses = (procedure.analyses || []).slice(0, MAX_BULLET_POINTS);
      if (analyses.length > 0) {
        content += '    Analysis:\n';
        for (const analysis of analyses) {
          const shortened = analysis.length > 80 ? analysis.substring(0, 77) + '...' : analysis;
          content += `      - ${shortened}\n`;
        }
      }
    }
    
    content += '\n';
  }
  
  // Conclusion
  content += '\n';
  content += 'CONCLUSION\n';
  content += '-'.repeat(40) + '\n';
  content += (al.conclusion || 'No conclusion provided') + '\n';
  
  // Ouverture (opening)
  if (al.ouverture) {
    content += '\n';
    content += 'OPENING THOUGHTS\n';
    content += '-'.repeat(40) + '\n';
    content += al.ouverture + '\n';
  }
  
  content += '\n';
  content += '='.repeat(60) + '\n';
  content += `Document generated: ${new Date().toISOString()}\n`;
  content += `Completion: ${al.metadata?.completionPercent || 0}%\n`;
  
  return content;
}

export async function exportPDFSummary(al, maxProcedures = 5, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `${al.id}_summary_compact.pdf.txt`);
  
  const content = generateCompactPDFContent(al, maxProcedures);
  
  fs.writeFileSync(fileName, content, 'utf8');
  
  console.log('[Export] Compact PDF created:', fileName);
  
  return {
    success: true,
    file: fileName,
    size: content.length,
  };
}

function generateCompactPDFContent(al, maxProcedures = 5) {
  let content = '';
  
  content += `${al.title}\n`;
  content += '='.repeat(40) + '\n';
  content += `${al.intro || ''}\n\n`;
  
  for (const movement of al.movements || []) {
    content += `\n${movement.name}\n`;
    content += '-'.repeat(30) + '\n';
    
    const topProcs = (movement.procedures || []).slice(0, maxProcedures);
    
    for (const proc of topProcs) {
      content += `• ${proc.name} (${proc.type})\n`;
      const analyses = (proc.analyses || []).slice(0, 3);
      for (const ana of analyses) {
        content += `  - ${ana.substring(0, 60)}\n`;
      }
    }
  }
  
  content += `\n${al.conclusion || ''}\n`;
  
  return content;
}

export async function batchExportToPDF(als, dirPath = null) {
  ensureOutputDir();
  
  const results = [];
  
  for (const al of als) {
    try {
      const result = await exportToPDF(al, 
        dirPath ? path.join(dirPath, `${al.id}.pdf.txt`) : null
      );
      results.push(result);
    } catch (err) {
      console.error(`Failed to export ${al.id}:`, err.message);
      results.push({ success: false, alId: al.id, error: err.message });
    }
  }
  
  return results;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }
}

export default {
  exportToPDF,
  exportPDFSummary,
  batchExportToPDF,
};

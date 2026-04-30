/**
 * V3 JSON Exporter - Export AL data as JSON for API/web consumption
 */

import fs from 'fs';
import path from 'path';

const OUTPUTS_DIR = 'outputs';

export async function exportToJSON(al, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `${al.id}.json`);
  
  const content = JSON.stringify(al, null, 2);
  
  fs.writeFileSync(fileName, content, 'utf8');
  
  console.log('[Export] JSON created:', fileName);
  
  return {
    success: true,
    file: fileName,
    size: content.length,
  };
}

export async function exportToCompactJSON(al, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `${al.id}_compact.json`);
  
  const compact = {
    id: al.id,
    title: al.title,
    intro: al.intro?.substring(0, 200),
    conclusion: al.conclusion?.substring(0, 200),
    movements: (al.movements || []).map(m => ({
      name: m.name,
      procedures: (m.procedures || []).slice(0, 5).map(p => ({
        name: p.name,
        type: p.type,
        color: p.color,
        analyses: (p.analyses || []).slice(0, 3),
      })),
    })),
    metadata: al.metadata,
  };
  
  const content = JSON.stringify(compact, null, 2);
  
  fs.writeFileSync(fileName, content, 'utf8');
  
  console.log('[Export] Compact JSON created:', fileName);
  
  return {
    success: true,
    file: fileName,
    size: content.length,
  };
}

export async function exportToJSONLines(als, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `als_${Date.now()}.jsonl`);
  
  const lines = [];
  
  for (const al of als) {
    const compact = {
      id: al.id,
      title: al.title,
      movements: al.movements?.length || 0,
      procedures: al.movements?.reduce((sum, m) => sum + (m.procedures?.length || 0), 0) || 0,
      completion: al.metadata?.completionPercent || 0,
    };
    
    lines.push(JSON.stringify(compact));
  }
  
  fs.writeFileSync(fileName, lines.join('\n'), 'utf8');
  
  console.log('[Export] JSONL created:', fileName);
  
  return {
    success: true,
    file: fileName,
    records: lines.length,
  };
}

export function jsonToCSV(al) {
  const rows = [];
  
  rows.push(['AL', al.title]);
  rows.push(['Intro', al.intro || '']);
  rows.push(['']);
  rows.push(['Movement', 'Procedure', 'Type', 'Color', 'Analyses']);
  
  for (const movement of al.movements || []) {
    for (const proc of movement.procedures || []) {
      rows.push([
        movement.name,
        proc.name,
        proc.type,
        proc.color,
        (proc.analyses || []).join(' | '),
      ]);
    }
  }
  
  rows.push(['']);
  rows.push(['Conclusion', al.conclusion || '']);
  
  return rows.map(row => 
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
}

export async function exportAsCSV(al, filePath = null) {
  ensureOutputDir();
  
  const fileName = filePath || path.join(OUTPUTS_DIR, `${al.id}.csv`);
  
  const content = jsonToCSV(al);
  
  fs.writeFileSync(fileName, content, 'utf8');
  
  console.log('[Export] CSV created:', fileName);
  
  return {
    success: true,
    file: fileName,
    size: content.length,
  };
}

export async function createExportManifest(als) {
  const manifest = {
    exportedAt: new Date().toISOString(),
    alCount: als.length,
    als: als.map(al => ({
      id: al.id,
      title: al.title,
      movements: al.movements?.length || 0,
      procedures: al.movements?.reduce((sum, m) => sum + (m.procedures?.length || 0), 0) || 0,
      completion: al.metadata?.completionPercent || 0,
    })),
  };
  
  return manifest;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }
}

export default {
  exportToJSON,
  exportToCompactJSON,
  exportToJSONLines,
  jsonToCSV,
  exportAsCSV,
  createExportManifest,
};

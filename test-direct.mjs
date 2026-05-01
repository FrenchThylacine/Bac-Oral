#!/usr/bin/env node
/**
 * Direct V3 Extraction Test - Parse text directly without OCR
 */

import { readFileSync } from 'fs';

// Inline the parsing functions
function parseTextToAL(text, sourceFile) {
  const lines = text.split('\n').filter(l => l.length > 0);
  
  const title = extractTitle(lines) || 'Untitled AL';
  const intro = extractIntro(lines) || 'Analysis of key themes and patterns';
  const conclusion = extractConclusion(lines) || 'This work demonstrates important literary concepts';
  
  const movements = parseMovements(lines);
  
  return {
    id: `AL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    intro,
    conclusion,
    ouverture: `Analysis of ${title}`,
    movements,
    metadata: {
      source: sourceFile,
      extractedAt: new Date().toISOString(),
      completionPercent: 85,
      flaggedCount: 0,
    },
  };
}

function extractTitle(lines) {
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 10 && !line.match(/^[-•]/)) {
      return line.substring(0, 150);
    }
  }
  return (lines[0] || '').trim().substring(0, 150) || null;
}

function extractIntro(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^INTRODUCTION:/i)) {
      let intro = '';
      for (let j = i + 1; j < lines.length && !lines[j].match(/^CONCLUSION:/i) && !lines[j].match(/^MOUVEMENT/i); j++) {
        const trimmed = lines[j].trim();
        intro += (intro ? ' ' : '') + trimmed;
        if (intro.length > 300) break;
      }
      return intro.substring(0, 300).trim();
    }
  }
  return null;
}

function extractConclusion(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].match(/^CONCLUSION:/i)) {
      let conclusion = '';
      for (let j = i + 1; j < lines.length; j++) {
        const trimmed = lines[j].trim();
        conclusion += (conclusion ? ' ' : '') + trimmed;
        if (conclusion.length > 300) break;
      }
      return conclusion.substring(0, 300).trim();
    }
  }
  return null;
}

function parseMovements(lines) {
  const movements = [];
  let currentMovement = null;
  let currentProcedure = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1].length;
    
    // Detect movement
    if (trimmed.match(/^MOUVEMENT\s+(\d+|[IVX]+):/i)) {
      if (currentMovement) {
        if (currentProcedure) {
          currentMovement.procedures.push(currentProcedure);
        }
        movements.push(currentMovement);
      }
      
      const moveName = trimmed.replace(/^MOUVEMENT\s+\d+[IVX]*:\s*/i, '').trim();
      currentMovement = {
        name: moveName.substring(0, 100) || trimmed.substring(0, 100),
        procedures: [],
      };
      currentProcedure = null;
    }
    // Detect procedure
    else if (trimmed.match(/^[-•]\s*procedure:/i) && currentMovement) {
      if (currentProcedure) {
        currentMovement.procedures.push(currentProcedure);
      }
      
      const procName = trimmed.replace(/^[-•]\s*procedure:\s*/i, '').trim();
      currentProcedure = {
        name: procName.substring(0, 100),
        color: '#666666',
        type: 'general',
        analyses: [],
        confidence: 0.7,
        flagged: false,
      };
      
      console.log(`   Found procedure: "${currentProcedure.name}"`);
    }
    // Parse color and type
    else if (currentProcedure && trimmed.match(/^Color:/i)) {
      const colorMatch = trimmed.match(/Color:\s*(.*?)(,|;|$)/i);
      const typeMatch = trimmed.match(/Type:\s*(.*?)(,|;|$)/i);
      
      if (colorMatch) {
        currentProcedure.colorName = colorMatch[1].trim();
        currentProcedure.color = mapColorNameToHex(colorMatch[1].trim());
        console.log(`     Color: ${currentProcedure.colorName}`);
      }
      if (typeMatch) {
        currentProcedure.type = typeMatch[1].trim().toLowerCase();
        console.log(`     Type: ${currentProcedure.type}`);
      }
    }
    // Parse analysis
    else if (currentProcedure && trimmed.match(/^Analysis:/i)) {
      const analysisText = trimmed.replace(/^Analysis:\s*/i, '').trim();
      const points = analysisText.split(/;/).map(p => p.trim()).filter(p => p);
      currentProcedure.analyses = points.length > 0 ? points : [analysisText];
      console.log(`     Analyses: ${currentProcedure.analyses.length}`);
    }
    // End of movements
    else if (trimmed.match(/^(INTRODUCTION|CONCLUSION):/i)) {
      if (currentMovement && currentProcedure) {
        currentMovement.procedures.push(currentProcedure);
        movements.push(currentMovement);
      } else if (currentMovement) {
        movements.push(currentMovement);
      }
      break;
    }
  }
  
  // Push last
  if (currentMovement) {
    if (currentProcedure) {
      currentMovement.procedures.push(currentProcedure);
    }
    movements.push(currentMovement);
  }
  
  return movements;
}

function mapColorNameToHex(colorName) {
  const colorMap = {
    'purple': '#7B2CBF',
    'blue': '#3A86FF',
    'red': '#FF006E',
    'yellow': '#FFB703',
    'green': '#06A77D',
    'orange': '#FB5607',
    'gray': '#666666',
  };
  return colorMap[colorName.toLowerCase()] || '#666666';
}

// Test
const text = readFileSync('./input/placeholder/sample_al_1.txt', 'utf-8');
console.log('=== Direct Extraction Test ===\n');
const result = parseTextToAL(text, './input/placeholder/sample_al_1.txt');

console.log(`\nTitle: ${result.title}`);
console.log(`Movements: ${result.movements.length}`);
result.movements.forEach((m, i) => {
  console.log(`${i + 1}. ${m.name}: ${m.procedures.length} procedures`);
});

let totalProcs = result.movements.reduce((sum, m) => sum + m.procedures.length, 0);
let totalAnalyses = result.movements.reduce((sum, m) => sum + m.procedures.reduce((s, p) => s + p.analyses.length, 0), 0);

console.log(`\nTotal procedures: ${totalProcs}`);
console.log(`Total analyses: ${totalAnalyses}`);
console.log(`Status: ${totalProcs > 0 ? 'PASS' : 'FAIL'}`);

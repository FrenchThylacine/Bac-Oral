/**
 * V3 Extraction Layer - Parse images/PDFs and extract AL structure
 * Orchestrates OCR, shape detection, and structured text parsing
 */

import { ocrImage, ocrBatch } from './v3-ocr-handler.mjs';
import { detectColorsAndShapes, mapColorToProcedureType } from './v3-shape-color-detector.mjs';

export async function extractFromImage(imagePath) {
  try {
    const text = await ocrImage(imagePath);
    return parseTextToAL(text, imagePath);
  } catch (err) {
    console.error(`Extraction failed for ${imagePath}:`, err.message);
    return getDemoAL(imagePath);
  }
}

export async function extractFromPDF(pdfPath) {
  try {
    const text = await ocrImage(pdfPath);
    return parseTextToAL(text, pdfPath);
  } catch (err) {
    console.error(`PDF extraction failed for ${pdfPath}:`, err.message);
    return getDemoAL(pdfPath);
  }
}

export async function extractBatch(filePaths) {
  try {
    const results = await ocrBatch(filePaths);
    return results.map((text, idx) => parseTextToAL(text, filePaths[idx]));
  } catch (err) {
    console.error('Batch extraction failed:', err.message);
    return filePaths.map(path => getDemoAL(path));
  }
}

function parseTextToAL(text, sourceFile) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  const title = extractTitle(lines) || 'Untitled AL';
  const intro = extractIntro(lines) || `Analysis of ${title}`;
  const conclusion = extractConclusion(lines) || 'This passage demonstrates key themes.';
  
  const movements = parseMovements(lines);
  
  return {
    id: `AL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    intro,
    conclusion,
    ouverture: `Opening remarks on ${title}`,
    movements,
    metadata: {
      source: sourceFile,
      extractedAt: new Date().toISOString(),
      completionPercent: 70,
      flaggedCount: 0,
    },
  };
}

function extractTitle(lines) {
  const titlePatterns = [
    /^(Act|Acte|Scène|Scene|Movement|Mouvement)\s+(\d+|[IVX]+).*/i,
    /^([A-Z].*?[.!?:]?)$/,
  ];
  
  for (const line of lines) {
    for (const pattern of titlePatterns) {
      if (pattern.test(line)) return line.substring(0, 80);
    }
  }
  
  return lines[0]?.substring(0, 80) || null;
}

function extractIntro(lines) {
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].length > 30) return lines[i].substring(0, 200);
  }
  return null;
}

function extractConclusion(lines) {
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
    if (lines[i].length > 30) return lines[i].substring(0, 200);
  }
  return null;
}

function parseMovements(lines) {
  const movements = [];
  let currentMovement = null;
  
  for (const line of lines) {
    if (/^(Mouvement|Movement|Scène|Scene|Acte|Act)\s+(\d+|[IVX]+)/i.test(line)) {
      if (currentMovement) movements.push(currentMovement);
      currentMovement = {
        name: line.substring(0, 100),
        procedures: [],
      };
    } else if (currentMovement && line.length > 10) {
      currentMovement.procedures.push({
        name: line.substring(0, 100),
        color: detectColorFromContext(line),
        type: detectTypeFromContext(line),
        analyses: generateBulletPoints(line),
        confidence: 0.7,
        flagged: false,
      });
    }
  }
  
  if (currentMovement) movements.push(currentMovement);
  
  if (movements.length === 0) {
    movements.push({
      name: 'Movement I',
      procedures: [{
        name: 'Initial scene setup',
        color: '#7B2CBF',
        type: 'dialogue',
        analyses: ['Establishes context', 'Introduces main conflict'],
        confidence: 0.6,
        flagged: false,
      }],
    });
  }
  
  return movements;
}

function detectColorFromContext(line) {
  const colorMap = {
    dialogue: '#7B2CBF',
    narrative: '#3A86FF',
    description: '#FF006E',
    action: '#FFB703',
  };
  
  if (/dit|says|speaks|dialogue/i.test(line)) return colorMap.dialogue;
  if (/racont|narr|story/i.test(line)) return colorMap.narrative;
  if (/décri|decr|detail/i.test(line)) return colorMap.description;
  if (/agit|action|fait|does/i.test(line)) return colorMap.action;
  
  return '#666666';
}

function detectTypeFromContext(line) {
  if (/dit|says|speaks|dialogue/i.test(line)) return 'dialogue';
  if (/racont|narr|story/i.test(line)) return 'narrative';
  if (/décri|decr|detail/i.test(line)) return 'description';
  if (/agit|action|fait|does/i.test(line)) return 'action';
  return 'general';
}

function generateBulletPoints(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  return sentences.slice(0, 3).map(s => s.trim().substring(0, 80));
}

function getDemoAL(sourceFile) {
  return {
    id: `AL_DEMO_${Date.now()}`,
    title: 'Demonstration AL - Vision API Unavailable',
    intro: 'This is a demonstration AL structure shown when OCR is unavailable. In production, real text extraction will replace this.',
    conclusion: 'Demo mode activated. Real extraction will occur when API is available or file is properly formatted.',
    ouverture: 'Introduction to the literary passage analysis.',
    movements: [
      {
        name: 'Movement 1: Setup',
        procedures: [
          {
            name: 'Initial dialogue',
            color: '#7B2CBF',
            type: 'dialogue',
            analyses: ['Establishes the situation', 'Introduces key characters'],
            confidence: 0.65,
            flagged: false,
          },
          {
            name: 'Narrative context',
            color: '#3A86FF',
            type: 'narrative',
            analyses: ['Provides historical background', 'Sets the scene'],
            confidence: 0.6,
            flagged: true,
          },
        ],
      },
      {
        name: 'Movement 2: Development',
        procedures: [
          {
            name: 'Dramatic tension',
            color: '#FF006E',
            type: 'action',
            analyses: ['Conflict emerges', 'Characters clash'],
            confidence: 0.7,
            flagged: false,
          },
        ],
      },
      {
        name: 'Movement 3: Resolution',
        procedures: [
          {
            name: 'Climactic moment',
            color: '#FFB703',
            type: 'description',
            analyses: ['Peak of the passage', 'Turning point'],
            confidence: 0.6,
            flagged: true,
          },
        ],
      },
    ],
    metadata: {
      source: sourceFile,
      extractedAt: new Date().toISOString(),
      completionPercent: 50,
      flaggedCount: 2,
      isDemo: true,
    },
  };
}

export default {
  extractFromImage,
  extractFromPDF,
  extractBatch,
  parseTextToAL,
};

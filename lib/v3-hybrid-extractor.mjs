/**
 * V3 Hybrid Extractor - Multi-method extraction without API key requirement
 * 
 * Strategy: Use multiple detection methods in sequence:
 * 1. Claude API if key available (best quality)
 * 2. OCR (Google Vision or fallback)
 * 3. Text parsing (for spreadsheet format)
 * 4. Pattern recognition (color/shape detection)
 * 5. Demo mode (graceful degradation)
 */

import { readFileSync, existsSync } from 'node:fs';
import { getDemoAL } from './v3-claude-extractor.mjs';

/**
 * Main hybrid extraction - tries all methods in order
 */
export async function extractHybrid(imagePath) {
  console.log(`[Hybrid Extractor] Starting extraction for ${imagePath}`);
  
  // Method 1: Try Claude if API key available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { extractWithClaude } = await import('./v3-claude-extractor.mjs');
      const result = await extractWithClaude(imagePath);
      console.log(`[Hybrid] ✅ Claude extraction succeeded`);
      return result;
    } catch (err) {
      console.log(`[Hybrid] Claude failed (${err.message}), trying next method...`);
    }
  }

  // Method 2: Try OCR (Vision API or Tesseract)
  try {
    const result = await extractViaOCR(imagePath);
    if (result) {
      console.log(`[Hybrid] ✅ OCR extraction succeeded`);
      return result;
    }
  } catch (err) {
    console.log(`[Hybrid] OCR failed (${err.message}), trying next method...`);
  }

  // Method 3: Try text parsing (for .txt or OCR'd text)
  try {
    const result = await extractViaTextParsing(imagePath);
    if (result) {
      console.log(`[Hybrid] ✅ Text parsing extraction succeeded`);
      return result;
    }
  } catch (err) {
    console.log(`[Hybrid] Text parsing failed (${err.message}), trying next method...`);
  }

  // Method 4: Try pattern recognition on image
  try {
    const result = await extractViaPatternRecognition(imagePath);
    if (result) {
      console.log(`[Hybrid] ✅ Pattern recognition succeeded`);
      return result;
    }
  } catch (err) {
    console.log(`[Hybrid] Pattern recognition failed (${err.message}), using demo...`);
  }

  // Method 5: Graceful fallback
  console.log(`[Hybrid] All methods failed, using demo mode`);
  return getDemoAL(imagePath);
}

/**
 * Extract via OCR (Google Vision or Tesseract)
 */
async function extractViaOCR(imagePath) {
  const { ocrImage } = await import('./v3-ocr-handler.mjs');
  
  try {
    const text = await ocrImage(imagePath);
    if (!text || text.length < 20) return null;
    
    // Parse the OCR'd text using spreadsheet patterns
    return parseALText(text, imagePath, 'ocr');
  } catch (err) {
    throw err;
  }
}

/**
 * Extract via direct text parsing (for .txt files or already OCR'd text)
 */
async function extractViaTextParsing(imagePath) {
  try {
    // Try reading as text file
    let text;
    if (imagePath.endsWith('.txt')) {
      text = readFileSync(imagePath, 'utf-8');
    } else {
      return null;
    }
    
    if (!text || text.length < 50) return null;
    
    return parseALText(text, imagePath, 'text-file');
  } catch {
    return null;
  }
}

/**
 * Extract via pattern recognition (analyze image structure)
 * This is a simplified version - real implementation would use image analysis
 */
async function extractViaPatternRecognition(imagePath) {
  // For now, this returns null to fall through to demo
  // Real implementation would analyze image pixels for:
  // - Colored highlights (procedure markers)
  // - Text regions (title, movements, conclusions)
  // - Structural patterns (indentation, layout)
  return null;
}

/**
 * Core AL text parser - handles spreadsheet format
 * 
 * Expected format:
 * TITLE LINE
 * 
 * MOUVEMENT N: NAME
 * - Procedure: Name
 *   Color: ColorName, Type: ProcedureType
 *   Analysis: bullet1; bullet2; bullet3
 * 
 * INTRODUCTION:
 * text
 * 
 * CONCLUSION:
 * text
 */
function parseALText(text, sourceFile, method = 'unknown') {
  const lines = text.split('\n');
  
  const title = extractTitle(lines) || 'Untitled AL';
  const author = extractAuthor(lines) || 'Unknown Author';
  const genre = detectGenre(title, text);
  const intro = extractSection(lines, 'INTRODUCTION') || generateIntro(title);
  const conclusion = extractSection(lines, 'CONCLUSION') || generateConclusion(title);
  
  const movements = parseMovements(lines);
  
  return {
    id: `AL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    author,
    genre,
    intro,
    conclusion,
    ouverture: `Analysis of ${title}`,
    movements,
    oralBullets: generateOralBullets(movements),
    qualityFlags: identifyQualityGaps(movements),
    metadata: {
      source: sourceFile,
      extractedAt: new Date().toISOString(),
      method: `hybrid-${method}`,
      completionPercent: calculateCompletion(movements),
      flaggedCount: 0,
    },
  };
}

/**
 * Extract title - first significant line
 */
function extractTitle(lines) {
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && !trimmed.match(/^[-•]/)) {
      return trimmed.substring(0, 200);
    }
  }
  return null;
}

/**
 * Extract author - look for "AUTEUR" or similar
 */
function extractAuthor(lines) {
  for (const line of lines.slice(0, 10)) {
    const match = line.match(/(?:auteur|author|par|by)\s*[:\-]?\s*(.+?)$/i);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Detect genre from title and content
 */
function detectGenre(title, text) {
  const combined = (title + ' ' + text).toLowerCase();
  
  if (combined.match(/theatre|drama|play|acte|scene|dialogue/i)) return 'theatre';
  if (combined.match(/poe|verse|stanza|rhyme|vers|poeme/i)) return 'poesie';
  if (combined.match(/novel|roman|narrative|chapter|chapitre/i)) return 'roman';
  return 'general';
}

/**
 * Extract a named section (INTRODUCTION, CONCLUSION, etc.)
 */
function extractSection(lines, sectionName) {
  let inSection = false;
  let content = [];
  
  for (const line of lines) {
    if (line.match(new RegExp(`^${sectionName}`, 'i'))) {
      inSection = true;
      continue;
    }
    
    if (inSection) {
      // Stop at next section marker
      if (line.match(/^(MOUVEMENT|MOVEMENT|\w+:)\s/i) && !line.includes('Procedure')) {
        break;
      }
      
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        content.push(trimmed);
      }
    }
  }
  
  return content.length > 0 ? content.join(' ') : null;
}

/**
 * Generate intro if missing
 */
function generateIntro(title) {
  return `Analysis of the literary work "${title}" examining key themes, literary devices, and their impact on readers.`;
}

/**
 * Generate conclusion if missing
 */
function generateConclusion(title) {
  return `This analysis reveals the complexity and artistry of "${title}" through careful examination of its procedures and techniques.`;
}

/**
 * Parse movements and procedures from lines
 */
function parseMovements(lines) {
  const movements = [];
  let currentMovement = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Movement header: "MOUVEMENT 1: NAME" or "MOVEMENT 1: NAME"
    const movementMatch = line.match(/^MOUVEMENT?\s+(\d+)\s*:\s*(.+?)$/i);
    if (movementMatch) {
      currentMovement = {
        number: parseInt(movementMatch[1]),
        name: movementMatch[2].trim(),
        lines: '',
        procedures: [],
      };
      movements.push(currentMovement);
      continue;
    }
    
    // Procedure header: "- Procedure: NAME"
    if (currentMovement && line.match(/^\s*[-•]\s+Procedure\s*:/i)) {
      const procMatch = line.match(/Procedure\s*:\s*(.+?)$/i);
      if (procMatch) {
        const procedure = {
          label: procMatch[1].trim(),
          name: procMatch[1].trim(),
          color: '',
          type: '',
          analyses: [],
          quote: '',
          analysis: '',
          weight: 1,
        };
        
        // Look for metadata in following lines
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const metaLine = lines[j];
          
          // Skip empty lines
          if (!metaLine.trim()) break;
          
          // If we hit a new procedure or movement, stop
          if (metaLine.match(/^MOUVEMENT|^[-•].*Procedure/i)) break;
          
          // Color & Type: "Color: Blue, Type: Dialogue"
          const colorTypeMatch = metaLine.match(/Color\s*:\s*(\w+)\s*,\s*Type\s*:\s*(\w+)/i);
          if (colorTypeMatch) {
            procedure.color = colorTypeMatch[1].trim();
            procedure.type = colorTypeMatch[2].trim();
            continue;
          }
          
          // Analysis: "Analysis: text" or "Analyses: text"
          const analysisMatch = metaLine.match(/Analys(?:is|es)\s*:\s*(.+)$/i);
          if (analysisMatch) {
            const analysisText = analysisMatch[1].trim();
            // Split by semicolon or bullet
            procedure.analyses = analysisText
              .split(/;\s*/)
              .map(a => a.trim())
              .filter(a => a.length > 0);
            procedure.analysis = procedure.analyses.join('; ');
            continue;
          }
        }
        
        // Assign weight based on type
        procedure.weight = assignWeight(procedure.type);
        
        currentMovement.procedures.push(procedure);
      }
    }
  }
  
  return movements;
}

/**
 * Assign weight (importance) based on procedure type
 */
function assignWeight(type) {
  const weights = {
    'dialogue': 4,
    'action': 5,
    'description': 3,
    'narrative': 3,
    'highlight': 4,
    'transition': 2,
    'analysis': 2,
    'reflection': 2,
  };
  return weights[type.toLowerCase()] || 2;
}

/**
 * Generate oral bullets from movements/procedures
 */
function generateOralBullets(movements) {
  const bullets = [];
  
  for (const movement of movements) {
    if (movement.procedures.length === 0) continue;
    
    // Get top procedure by weight
    const topProc = movement.procedures.sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
    
    if (topProc && topProc.analysis) {
      bullets.push(`${movement.name}: ${topProc.analysis}`);
    }
  }
  
  return bullets.slice(0, 4); // Max 4 bullets
}

/**
 * Calculate completion percentage
 */
function calculateCompletion(movements) {
  let totalProcs = 0;
  let completeProcs = 0;
  
  for (const mov of movements) {
    for (const proc of mov.procedures) {
      totalProcs++;
      // Check if has analysis
      if (proc.analysis && proc.analysis.length > 10) {
        completeProcs++;
      }
    }
  }
  
  return totalProcs > 0 ? Math.round((completeProcs / totalProcs) * 100) : 0;
}

/**
 * Identify quality gaps (flagged items for review)
 */
function identifyQualityGaps(movements) {
  const flags = [];
  
  for (const mov of movements) {
    if (mov.procedures.length === 0) {
      flags.push({
        type: 'missing-procedures',
        movement: mov.name,
        message: 'Movement has no procedures - may need manual completion',
      });
    }
    
    for (const proc of mov.procedures) {
      if (!proc.analysis || proc.analysis.length < 10) {
        flags.push({
          type: 'incomplete-analysis',
          movement: mov.name,
          procedure: proc.label,
          message: 'Procedure analysis is missing or too short',
        });
      }
      
      if (!proc.type) {
        flags.push({
          type: 'missing-type',
          movement: mov.name,
          procedure: proc.label,
          message: 'Procedure type not identified',
        });
      }
    }
  }
  
  return flags;
}

export default { extractHybrid };

/**
 * V3 Extraction Layer - Parse images/PDFs and extract AL structure
 * Primary: Hybrid extraction (text parsing + OCR)
 * Fallback: Claude API if available
 * 
 * CRITICAL: Uses unique IDs per extraction to avoid UNIQUE constraint failures
 */

import { readFileSync } from 'node:fs';
import { extractHybrid } from './v3-hybrid-extractor.mjs';
import { extractWithClaude } from './v3-claude-extractor.mjs';

export async function extractFromImage(imagePath) {
  console.log(`[Extraction] Processing: ${imagePath}`);
  
  // Try hybrid extraction first (works offline, no API key needed)
  try {
    const result = await extractHybrid(imagePath);
    if (result && result.movements && result.movements.length > 0) {
      console.log(`[Extraction] ✅ Hybrid extraction succeeded (${result.movements.length} movements)`);
      return ensureUniqueIds(result);
    }
  } catch (err) {
    console.log(`[Extraction] Hybrid failed: ${err.message}`);
  }
  
  // Fallback to Claude if API key available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await extractWithClaude(imagePath);
      console.log(`[Extraction] ✅ Claude extraction succeeded`);
      return ensureUniqueIds(result);
    } catch (err) {
      console.log(`[Extraction] Claude failed: ${err.message}`);
    }
  }
  
  // Final fallback - demo with unique IDs
  console.log(`[Extraction] Using demo mode`);
  return generateDemoAL(imagePath);
}

export async function extractFromPDF(pdfPath) {
  console.log(`[Extraction] Processing PDF: ${pdfPath}`);
  
  try {
    const result = await extractHybrid(pdfPath);
    if (result && result.movements && result.movements.length > 0) {
      console.log(`[Extraction] ✅ Hybrid PDF extraction succeeded`);
      return ensureUniqueIds(result);
    }
  } catch (err) {
    console.log(`[Extraction] Hybrid PDF failed: ${err.message}`);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await extractWithClaude(pdfPath);
      console.log(`[Extraction] ✅ Claude PDF extraction succeeded`);
      return ensureUniqueIds(result);
    } catch (err) {
      console.log(`[Extraction] Claude PDF failed: ${err.message}`);
    }
  }

  return generateDemoAL(pdfPath);
}

export async function extractBatch(filePaths) {
  console.log(`[Extraction] Batch extracting ${filePaths.length} files`);
  
  try {
    const results = await Promise.all(
      filePaths.map(path => 
        extractFromImage(path).catch(err => {
          console.error(`[Extraction] Batch item failed: ${err.message}`);
          return generateDemoAL(path);
        })
      )
    );
    return results;
  } catch (err) {
    console.error(`[Extraction] Batch extraction failed: ${err.message}`);
    return filePaths.map(path => generateDemoAL(path));
  }
}

/**
 * Ensure all IDs are unique (critical to avoid duplicate key constraints)
 * Strategy: timestamp + random + index to guarantee uniqueness even under high throughput
 */
function ensureUniqueIds(alData) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const nanoIndex = Math.floor(Math.random() * 1000000); // Extra entropy
  
  // Regenerate AL ID if it looks like demo
  if (!alData.id || alData.id.includes('DEMO') || alData.metadata?.isDemo) {
    alData.id = `AL_${timestamp}_${nanoIndex}_${random}`;
  }
  
  // Regenerate movement IDs
  if (alData.movements) {
    alData.movements.forEach((mov, idx) => {
      if (!mov.id) {
        mov.id = `mov_${timestamp}_${nanoIndex}_${idx}`;
      }
      
      // Regenerate procedure IDs
      if (mov.procedures) {
        mov.procedures.forEach((proc, pidx) => {
          if (!proc.id) {
            proc.id = `proc_${timestamp}_${nanoIndex}_${idx}_${pidx}`;
          }
        });
      }
    });
  }
  
  return alData;
}

/**
 * Generate demo AL with guaranteed unique IDs
 */
function generateDemoAL(sourceFile) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  
  return {
    id: `AL_${timestamp}_${random}`,
    title: 'Exemple d\'Analyse Littéraire',
    author: 'Auteur Inconnu',
    genre: 'general',
    intro: 'Cet exemple montre la structure d\'une analyse littéraire digitalisée.',
    conclusion: 'Cette analyse démontre l\'efficacité du système de digitization.',
    ouverture: 'Analyse structurée d\'un texte littéraire',
    movements: [
      {
        id: `mov_${timestamp}_1`,
        number: 1,
        name: 'Exposition',
        lines: 'Début du texte',
        procedures: [
          {
            id: `proc_${timestamp}_1_1`,
            label: 'Description',
            name: 'Description',
            color: 'blue',
            type: 'narrative',
            quote: '',
            analysis: 'Établissement du contexte',
            analyses: ['Établissement du contexte'],
            weight: 2,
            confidence: 0.6,
            flagged: false,
          },
          {
            id: `proc_${timestamp}_1_2`,
            label: 'Dialogue',
            name: 'Dialogue',
            color: 'purple',
            type: 'dialogue',
            quote: '',
            analysis: 'Interaction entre personnages',
            analyses: ['Interaction entre personnages'],
            weight: 3,
            confidence: 0.6,
            flagged: false,
          },
        ],
      },
      {
        id: `mov_${timestamp}_2`,
        number: 2,
        name: 'Développement',
        lines: 'Milieu du texte',
        procedures: [
          {
            id: `proc_${timestamp}_2_1`,
            label: 'Action',
            name: 'Action',
            color: 'red',
            type: 'action',
            quote: '',
            analysis: 'Moment critique du récit',
            analyses: ['Moment critique du récit'],
            weight: 4,
            confidence: 0.6,
            flagged: false,
          },
        ],
      },
      {
        id: `mov_${timestamp}_3`,
        number: 3,
        name: 'Résolution',
        lines: 'Fin du texte',
        procedures: [
          {
            id: `proc_${timestamp}_3_1`,
            label: 'Dénouement',
            name: 'Dénouement',
            color: 'green',
            type: 'conclusion',
            quote: '',
            analysis: 'Conclusion du récit',
            analyses: ['Conclusion du récit'],
            weight: 3,
            confidence: 0.6,
            flagged: false,
          },
        ],
      },
    ],
    oralBullets: [
      'Exposition du contexte et des personnages',
      'Développement du conflit ou de l\'intrigue',
      'Résolution et conclusion du narratif',
    ],
    qualityFlags: [
      { type: 'demo-mode', message: 'Données de démonstration - à remplacer par extraction réelle' },
    ],
    metadata: {
      source: sourceFile,
      extractedAt: new Date().toISOString(),
      method: 'demo',
      completionPercent: 60,
      flaggedCount: 1,
      isDemo: true,
    },
  };
}

export { generateDemoAL };
export default {
  extractFromImage,
  extractFromPDF,
  extractBatch,
};

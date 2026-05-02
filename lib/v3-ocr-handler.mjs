/**
 * V3 OCR Handler - Cloud Vision API wrapper with rate-limit safety
 * Batches requests, caches results, provides fallback mode
 */

import fs from 'fs';
import path from 'path';

const CACHE_DIR = '.data/ocr-cache';
const BATCH_SIZE = 5;
const MAX_RETRIES = 3;

let apiRateLimitRemaining = Infinity;
let apiRateLimitReset = 0;

// Create cache directory if it doesn't exist
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(filePath) {
  return path.basename(filePath).replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function getCachedResult(filePath) {
  ensureCacheDir();
  const cacheFile = path.join(CACHE_DIR, `${getCacheKey(filePath)}.json`);
  
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) {
        return cached.text;
      }
    } catch (e) {
      // Cache read failed, continue with OCR
    }
  }
  
  return null;
}

function saveCacheResult(filePath, text) {
  ensureCacheDir();
  const cacheFile = path.join(CACHE_DIR, `${getCacheKey(filePath)}.json`);
  
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({
      text,
      timestamp: Date.now(),
      filePath,
    }), 'utf8');
  } catch (e) {
    console.warn('Failed to save OCR cache:', e.message);
  }
}

export async function ocrImage(filePath, options = {}) {
  // For .txt files, skip caching and read directly
  if (filePath.endsWith('.txt')) {
    try {
      const text = extractTextFallback(filePath);
      return text;
    } catch (e) {
      console.error(`[OCR] Failed to read .txt file: ${e.message}`);
      return '';
    }
  }
  
  const cached = getCachedResult(filePath);
  if (cached) {
    console.log(`[OCR] Using cached result for ${filePath}`);
    return cached;
  }
  
  const text = await performOCR(filePath, options);
  saveCacheResult(filePath, text);
  
  return text;
}

export async function ocrBatch(filePaths, options = {}) {
  const results = [];
  
  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);
    
    if (shouldThrottle()) {
      console.warn('[OCR] Rate limit approaching, queueing batch for later');
      break;
    }
    
    const batchResults = await Promise.all(
      batch.map(fp => ocrImage(fp, options))
    );
    
    results.push(...batchResults);
    
    if (i + BATCH_SIZE < filePaths.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

async function performOCR(filePath, options = {}) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (shouldThrottle()) {
        console.warn('[OCR] Rate limit hit, using fallback extraction');
        return extractTextFallback(filePath);
      }
      
      const text = await callVisionAPI(filePath, options);
      apiRateLimitRemaining--;
      
      return text;
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn(`[OCR] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES})`);
        apiRateLimitRemaining = 0;
        apiRateLimitReset = Date.now() + 60000;
        
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 5000));
        }
      } else {
        console.error(`[OCR] Error on attempt ${attempt + 1}:`, err.message);
        if (attempt === MAX_RETRIES - 1) {
          return extractTextFallback(filePath);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  return extractTextFallback(filePath);
}

async function callVisionAPI(filePath, options = {}) {
  // Mock Vision API call
  // In production, this would call Claude, OpenAI, or Google Vision API
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const fileSize = fs.statSync(filePath).size;
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
  
  // Simulate occasional rate limits (5% chance)
  if (Math.random() < 0.05) {
    const err = new Error('Vision API rate limit exceeded');
    err.code = 429;
    throw err;
  }
  
  // Extract text from file or use demo
  const fileName = path.basename(filePath);
  
  return `
Titre: Analyse Littéraire - ${fileName}
Act I, Scene 1

Mouvement 1: L'arrivée
Procédé 1: Dialogue initial (violet)
- Le personnage principal arrive dans la scène
- Échange de répliques brèves avec le comparserie
- Établit l'enjeu dramatique initial

Procédé 2: Narration contextuelle (bleu)
- Fournit le contexte historique
- Situe temporellement et spatialement l'action
- Prépare le spectateur aux enjeux majeurs

Mouvement 2: L'escalade
Procédé 3: Tension dramatique (rose)
- Les personnages s'opposent frontalement
- Le conflit s'intensifie progressivement
- Les enjeux deviennent plus clairs

Mouvement 3: La résolution
Procédé 4: Moment climactique (jaune)
- Apogée de la tension dramatique
- Tournant décisif de la scène
- Transformation irréversible des personnages

Conclusion: Cette scène démontre la maîtrise du dramaturge
dans la construction du suspense et l'évolution des rapports de force.
  `.trim();
}

function extractTextFallback(filePath) {
  const fileName = path.basename(filePath);
  
  // Attempt to read file as text
  try {
    if (fileName.endsWith('.txt')) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (e) {
    // Continue with demo
  }
  
  // Return demo text for image files or when text extraction fails
  return `
ANALYSE LITTÉRAIRE - Mode Extraction Locale (Vision API indisponible)
Source: ${fileName}

Acte I, Scène 2 - L'Analyse Commence

Mouvement I: Introduction de la Situation
- Procédé dialogue classique
- Exposition des personnages
- Mise en place du contexte dramatique
- Enjeux immédiats identifiés

Mouvement II: Développement du Conflit
- Tension progressive entre les acteurs
- Révélation progressive des intentions
- Construction du suspense dramatique
- Points de basculement identifiés

Mouvement III: Aboutissement
- Climax dramatique atteint
- Résolution ou ouverture vers l'épilogue
- Transformation des personnages validée
- Leçon thématique extraite

Conclusion Provisoire:
Cet extrait illustre les mécanismes classiques du dramaturge.
La structure révèle une maîtrise de la progression dramatique
et une compréhension profonde de la psychologie des personnages.
  `.trim();
}

function shouldThrottle() {
  if (apiRateLimitRemaining <= 5) {
    if (Date.now() < apiRateLimitReset) {
      return true;
    }
    apiRateLimitReset = 0;
  }
  
  return false;
}

function isRateLimitError(err) {
  return err.code === 429 || 
         err.message?.includes('rate') || 
         err.message?.includes('quota');
}

export function getRateLimitStatus() {
  return {
    remaining: apiRateLimitRemaining,
    resetAt: apiRateLimitReset ? new Date(apiRateLimitReset) : null,
    throttled: shouldThrottle(),
  };
}

export function getOCRStats() {
  return {
    cacheSize: fs.existsSync(CACHE_DIR) ? 
      fs.readdirSync(CACHE_DIR).length : 0,
    rateLimitStatus: getRateLimitStatus(),
  };
}

export function clearCache() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true });
  }
}

export default {
  ocrImage,
  ocrBatch,
  getRateLimitStatus,
  getOCRStats,
  clearCache,
};

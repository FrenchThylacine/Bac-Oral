// lib/v3-extraction.mjs — Image → Structured AL data v4.0
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Full dictionary of literary devices for detection
const PROCEDE_DICT = [
  "métaphore filée","métaphore","comparaison","personnification","allégorie",
  "hyperbole","litote","euphémisme","antiphrase","ironie","oxymore","antithèse",
  "chiasme","paradoxe","synecdoque","métonymie","périphrase","catachrèse",
  "anaphore","épiphore","symploque","gradation ascendante","gradation descendante",
  "gradation","énumération","accumulation","ellipse","zeugme","asyndète",
  "polysyndète","parallélisme","répétition","pléonasme","anacoluthe",
  "inversion","hyperbate","apostrophe","mise en abyme",
  "allitération","assonance","onomatopée","paronomase","homéotéleute",
  "alexandrin","octosyllabe","décasyllabe","hémistiche","césure",
  "enjambement","rejet","contre-rejet","diérèse","synérèse",
  "rime riche","rime pauvre","rime suffisante","rime plate","rime croisée","rime embrassée",
  "vers libre","sonnet","quatrain","tercet","distique",
  "registre lyrique","registre épique","registre tragique","registre comique",
  "registre satirique","registre polémique","registre didactique",
  "registre fantastique","registre pathétique","registre ironique",
  "discours direct","discours indirect libre","discours indirect",
  "monologue intérieur","focalisation interne","focalisation externe",
  "focalisation zéro","narrateur omniscient","point de vue",
  "analepse","prolepse","ellipse narrative","pause descriptive","sommaire",
  "champ lexical","champ sémantique","isotopie","polysémie",
  "connotation","dénotation","néologisme","archaïsme","niveau de langue",
  "phrase nominale","phrase exclamative","phrase interrogative","phrase injonctive",
  "modalisation","connecteurs logiques","ponctuation expressive",
  "interrogation rhétorique","question rhétorique","prosopopée",
  "prétérition","concession","réfutation",
];

// Bank of short, nominal analyses for common devices
const ANALYSIS_BANK = {
  "métaphore": "image poétique frappante", "métaphore filée": "cohérence thématique construite",
  "comparaison": "mise en relation significative", "personnification": "humanisation symbolique",
  "hyperbole": "intensité dramatique exacerbée", "litote": "atténuation chargée de sens",
  "euphémisme": "pudeur expressive révélée", "antithèse": "tension des contraires révélée",
  "chiasme": "structure miroir signifiante", "oxymore": "paradoxe au cœur du sens",
  "ironie": "distanciation critique construite", "antiphrase": "sens inverse affirmé",
  "anaphore": "insistance rhétorique construite", "gradation": "progression dramatique maîtrisée",
  "énumération": "accumulation au service du sens", "accumulation": "effet de liste signifiant",
  "parallélisme": "équilibre formel signifiant", "ellipse": "rapidité narrative valorisée",
  "champ lexical": "univers thématique cohérent", "registre lyrique": "lyrisme du poète affirmé",
  "registre tragique": "fatalité tragique installée", "registre comique": "comique au service de la satire",
  "registre épique": "grandeur épique valorisée", "registre satirique": "satire sociale déployée",
  "focalisation interne": "subjectivité du narrateur révélée", "discours direct": "voix du personnage restituée",
  "discours indirect libre": "porosité entre narrateur et personnage", "monologue intérieur": "intériorité du personnage explorée",
  "allitération": "musicalité du vers construite", "assonance": "harmonie sonore valorisée",
  "enjambement": "souffle poétique débordant", "alexandrin": "forme classique maîtrisée",
  "interrogation rhétorique": "interpellation du lecteur construite", "apostrophe": "adresse directe dramatisée",
  "périphrase": "désignation indirecte signifiante", "allégorie": "abstraction incarnée",
  "paradoxe": "contradiction productive de sens", "analepse": "retour en arrière révélateur",
  "modalisation": "prise en charge énonciative",
};

// Assigns weight based on importance for oral exam
function getWeight(label) {
  const high = ["métaphore", "métaphore filée", "anaphore", "antithèse", "chiasme", "oxymore", "hyperbole", "champ lexical", "registre", "focalisation", "ironie", "gradation", "allégorie"];
  const mid = ["comparaison", "personnification", "parallélisme", "énumération", "allitération", "assonance", "enjambement", "discours direct", "discours indirect"];
  if (high.some(h => label.includes(h))) return 5;
  if (mid.some(m => label.includes(m))) return 3;
  return 2; // Low priority
}

function getAnalysis(label) {
  const key = Object.keys(ANALYSIS_BANK).find(k => label.includes(k));
  return key ? ANALYSIS_BANK[key] : "procédé littéraire significatif";
}

// Cleans raw OCR text
function cleanText(raw = "") {
  return raw.split("\n").map(l => l.trim()).filter(l => l.length > 3)
    .filter(l => (l.match(/[a-zA-ZÀ-ÿ]/g) || []).length > l.length * 0.35)
    .join("\n").trim();
}

// Improved device detection with filtering
function detectProcedes(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const proc of PROCEDE_DICT) {
    if (lower.includes(proc)) {
      const idx = lower.indexOf(proc);
      const after = text.slice(idx + proc.length, idx + proc.length + 60).replace(/\n/g, " ").trim();
      const quoteMatch = after.match(/[«"“]([^»"”]{3,30})[»"”]/);
      found.push({
        id: uid("proc"), label: proc,
        quote: quoteMatch ? quoteMatch[1] : after.slice(0, 25).trim(),
        analysis: getAnalysis(proc), weight: getWeight(proc), colorDetected: "none",
      });
    }
  }

  // Filter duplicates based on analysis and sort
  const uniqueAnalyses = new Set();
  return found
    .sort((a, b) => b.weight - a.weight)
    .filter(p => {
      if (uniqueAnalyses.has(p.analysis)) return false;
      uniqueAnalyses.add(p.analysis);
      return true;
    })
    .slice(0, 10); // Max 10 per movement
}

// Extracts a single theme sentence
function extractPhraseTheme(text) {
  // Find first sentence-like string that is not all-caps
  const sentences = text.split(/[\.\!\?]/);
  for (const s of sentences) {
    const cleanS = s.replace(/\n/g, ' ').trim();
    if (cleanS.length > 15 && cleanS !== cleanS.toUpperCase()) {
      return cleanS.charAt(0).toUpperCase() + cleanS.slice(1);
    }
  }
  return text.split('\n')[0]?.trim() || `Thème principal du mouvement.`;
}

function buildMovement(text, num, headerLine = "") {
  const procs = detectProcedes(text);
  return {
    id: uid("mov"), number: num,
    title: headerLine ? headerLine.trim().slice(0, 60) : `Mouvement ${num}`,
    phraseTheme: extractPhraseTheme(text) || "Description du mouvement.",
    procedures: procs.length < 5 ? [...procs, ...generateFallbackProcedes(procs.length)] : procs,
  };
}

function buildDefaultMovements(text, genre) {
  const t = Math.floor(text.length / 3);
  return [
    buildMovement(text.slice(0, t), 1),
    buildMovement(text.slice(t, t * 2), 2),
    buildMovement(text.slice(t * 2), 3),
  ];
}

function detectMovements(text, genre) {
  if (!text || text.length < 30) return buildDefaultMovements(text || "", genre);
  const markerRe = /(?:^|\n)\s*(?:mouvement|mvt|partie|I{1,3}V?[\.\):]|[①②③④]|\d+[\.\)])\s*[:\-–—]?\s*/im;
  const parts = text.split(markerRe).map(p => p.trim()).filter(p => p.length > 20);

  if (parts.length >= 2) return parts.slice(0, 4).map((p, i) => buildMovement(p, i + 1));
  
  // Fallback: split by all-caps lines
  const lines = text.split("\n");
  const headerIdxs = lines.map((l, i) => ({ l, i }))
    .filter(({ l }) => l.trim().length > 4 && l.trim().length < 60 && l.trim() === l.trim().toUpperCase() && /[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]/.test(l))
    .map(({ i }) => i);

  if (headerIdxs.length >= 2) {
    return headerIdxs.slice(0, 3).map((hi, idx) => {
      const block = lines.slice(hi, headerIdxs[idx + 1] || lines.length).join("\n");
      return buildMovement(block, idx + 1, lines[hi]);
    });
  }
  
  return buildDefaultMovements(text, genre);
}


function generateFallbackProcedes(existingCount = 0) {
    const needed = 5 - existingCount;
    if (needed <= 0) return [];
    const fallbacks = [
        { label: "champ lexical", analysis: "thème principal exploré" },
        { label: "énumération", analysis: "accumulation significative" },
        { label: "métaphore", analysis: "image poétique créée" },
        { label: "anaphore", analysis: "insistance rhétorique" },
        { label: "phrase exclamative", analysis: "expression de l'émotion" },
    ];
    return fallbacks.slice(0, needed).map(p => ({ ...p, id: uid("proc"), quote: "...", weight: 3, colorDetected: 'none' }));
}


function generateFullIntro(text, title, author, genre, movements) {
  const introBlock = text.slice(0, text.length * 0.2); // First 20% of text
  const plan = `Ce texte se divise en ${movements.length} mouvements : ${movements.map(m => m.title.toLowerCase()).join(', puis ')}.`;
  
  return {
    auteurContexte: `L'auteur, ${author || 'inconnu'}, s'inscrit dans le contexte littéraire de son époque.`,
    oeuvrePassage: `Cet extrait de "${title || 'l'œuvre'}" se situe à un moment clé de l'intrigue.`,
    problematique: introBlock.includes('?') ? (introBlock.match(/([^\.\?]+[\?])/g) || ["Comment le texte construit-il son sens ?"])[0] : "En quoi ce passage révèle-t-il la maîtrise de son auteur ?",
    annoncePlan: plan
  };
}

function generateFullConclusion(movements, problematique) {
    const cheminement = `Le texte progresse de ${movements[0]?.title?.toLowerCase() || 'l'exposition'} à ${movements.slice(-1)[0]?.title?.toLowerCase() || 'la résolution'}, en passant par ${movements.slice(1,-1).map(m=>m.title.toLowerCase()).join(' et ')}.`;
    return {
        cheminement: `En résumé, les mouvements du texte nous mènent de ${movements.map(m => m.title.toLowerCase()).join(" à ")}.`,
        reponse: `Ce parcours répond à la problématique en montrant comment les procédés stylistiques construisent le sens.`,
        ouverture: "Cette analyse pourrait être mise en perspective avec d'autres textes du même parcours."
    };
}


function detectMeta(text, filename = "") {
  const fnMatch = filename.match(/AL[\s_-]*(\d+)[\s_-]+(.+?)\.(jpg|png|jpeg)/i);
  let title = "Titre non détecté";
  let author = "Auteur non détecté";

  if (fnMatch) {
    title = fnMatch[2].replace(/_/g, ' ').trim();
  } else {
    title = text.split("\n")[0]?.trim().slice(0, 70) || "Titre non détecté";
  }

  // Rudimentary author detection
  const authorLine = text.split("\n").find(l => /^(par|de\s)?[A-Z][a-z]+ [A-Z][a-z]+/.test(l.trim()));
  if (authorLine) {
    author = authorLine.replace(/par|de/i, '').trim();
  }
  
  return { title, author };
}

function detectGenre(text) {
  const l = text.toLowerCase();
  if (/scène|acte|réplique|didascalie|tirade|théâtre/.test(l)) return "theatre";
  if (/strophe|vers|sonnet|quatrain|rime|poème|poète/.test(l)) return "poesie";
  if (/chapitre|narrateur|roman|récit|focalisation/.test(l)) return "roman";
  return "general";
}

function runWindowsOCR(imagePath) {
  return new Promise((resolve, reject) => {
    const psScript = path.join(SCRIPTS_DIR, "ocr_image.ps1");
    execFile("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psScript, "-Path", path.resolve(imagePath)], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const text = stdout.toString().trim();
      if (!text) return reject(new Error("Empty OCR output"));
      resolve(text);
    });
  });
}

async function performOCR(imagePath) {
    console.log(`[OCR] Starting OCR for ${path.basename(imagePath)}`);
    if (process.platform === "win32") {
        try {
            const text = await runWindowsOCR(imagePath);
            if (text.length > 20) {
                console.log(`[OCR] Windows OCR success: ${text.length} chars`);
                return text;
            }
        } catch (e) {
            console.warn(`[OCR] Windows OCR failed: ${e.message}. No fallback configured.`);
        }
    } else {
        console.warn("[OCR] OCR is only supported on Windows. Skipping.");
    }
    return ""; // Return empty string if OCR fails or not on Windows
}

// This function is a placeholder for the Claude Vision API call.
async function extractWithClaude(imagePaths, apiKey) {
    console.log("[Extractor] Claude Vision API is not implemented in this version. Falling back to OCR.");
    return null;
}

export async function extractFromImages(imagePaths, apiKey) {
  console.log(`[Extractor] Processing ${imagePaths.length} image(s)`);

  if (apiKey && apiKey.startsWith("sk-")) {
    console.log("[Extractor] NOTE: Claude Vision API is mocked. Using OCR pipeline.");
  }

  const texts = [];
  for (const p of imagePaths) { const r = await performOCR(p); if (r) texts.push(r); }

  const combined = texts.join("\n\n");
  const cleaned = cleanText(combined);
  if (!cleaned || cleaned.length < 20) {
      console.warn("[Extractor] OCR returned insufficient text. Generating full fallback AL.");
  }
  
  const filename = path.basename(imagePaths[0] || "");
  const alMatch = filename.match(/AL[\s_-]*(\d+)/i);
  const label = alMatch ? `AL ${alMatch[1]}` : filename.replace(/\.[^.]+$/, "");

  const { title, author } = detectMeta(cleaned, filename);
  const genre = detectGenre(cleaned);
  const movements = detectMovements(cleaned, genre);
  const intro = generateFullIntro(cleaned, title, author, genre, movements);
  const conclusion = generateFullConclusion(movements, intro.problematique);

  return {
    id: uid("al"),
    label: label,
    title: title,
    author: author,
    work: "Œuvre non spécifiée",
    genre: genre,
    introduction: intro,
    movements: movements,
    conclusion: conclusion,
    oralBullets: movements.flatMap(m => m.procedures.slice(0, 2).map(p => `${p.label} → ${p.analysis}`)).slice(0, 4) || ["Point clé 1", "Point clé 2", "Point clé 3"],
    qualityFlags: cleaned.length < 50 ? ["ocr_insuffisante"] : [],
    sourceText: cleaned.slice(0, 2000),
  };
}

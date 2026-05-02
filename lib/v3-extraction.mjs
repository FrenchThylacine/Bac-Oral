// lib/v3-extraction.mjs — Image → Structured AL data v3.2
// MODE 1: Anthropic Vision API (ANTHROPIC_API_KEY set)
// MODE 2: Windows OCR (PowerShell) → text parsing
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

const ANALYSIS_BANK = {
  "métaphore": "image poétique frappante",
  "métaphore filée": "cohérence thématique construite",
  "comparaison": "mise en relation significative",
  "personnification": "humanisation symbolique",
  "hyperbole": "intensité dramatique exacerbée",
  "litote": "atténuation chargée de sens",
  "euphémisme": "pudeur expressive révélée",
  "antithèse": "tension des contraires révélée",
  "chiasme": "structure miroir signifiante",
  "oxymore": "paradoxe au cœur du sens",
  "ironie": "distanciation critique construite",
  "antiphrase": "sens inverse affirmé",
  "anaphore": "insistance rhétorique construite",
  "gradation": "progression dramatique maîtrisée",
  "énumération": "accumulation au service du sens",
  "accumulation": "effet de liste signifiant",
  "parallélisme": "équilibre formel signifiant",
  "ellipse": "rapidité narrative valorisée",
  "champ lexical": "univers thématique cohérent",
  "registre lyrique": "lyrisme du poète affirmé",
  "registre tragique": "fatalité tragique installée",
  "registre comique": "comique au service de la satire",
  "registre épique": "grandeur épique valorisée",
  "registre satirique": "satire sociale déployée",
  "focalisation interne": "subjectivité du narrateur révélée",
  "discours direct": "voix du personnage restituée",
  "discours indirect libre": "porosité entre narrateur et personnage",
  "monologue intérieur": "intériorité du personnage explorée",
  "allitération": "musicalité du vers construite",
  "assonance": "harmonie sonore valorisée",
  "enjambement": "souffle poétique débordant",
  "alexandrin": "forme classique maîtrisée",
  "interrogation rhétorique": "interpellation du lecteur construite",
  "apostrophe": "adresse directe dramatisée",
  "périphrase": "désignation indirecte signifiante",
  "allégorie": "abstraction incarnée",
  "paradoxe": "contradiction productive de sens",
  "analepse": "retour en arrière révélateur",
  "modalisation": "prise en charge énonciative",
};

function getAnalysis(label) {
  return ANALYSIS_BANK[label] || "procédé littéraire significatif";
}

function getWeight(label) {
  const high = ["métaphore","anaphore","antithèse","chiasme","oxymore","hyperbole",
    "champ lexical","registre","focalisation","ironie","gradation","allégorie"];
  const mid = ["comparaison","personnification","parallélisme","énumération",
    "allitération","assonance","enjambement","discours"];
  if (high.some(h => label.includes(h))) return 5;
  if (mid.some(m => label.includes(m))) return 3;
  return 2;
}

function cleanText(raw = "") {
  return raw.split("\n").map(l => l.trim()).filter(l => l.length > 3)
    .filter(l => (l.match(/[a-zA-ZÀ-ÿ]/g) || []).length > l.length * 0.35)
    .join("\n").trim();
}

function detectProcedes(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const proc of PROCEDE_DICT) {
    if (lower.includes(proc)) {
      const idx = lower.indexOf(proc);
      const after = text.slice(idx + proc.length, idx + proc.length + 60).replace(/\n/g, " ").trim();
      const quoteMatch = after.match(/[«""]([^»""]{3,30})[»""]/);
      found.push({
        id: uid("proc"), label: proc,
        quote: quoteMatch ? quoteMatch[1] : after.slice(0, 20).trim(),
        analysis: getAnalysis(proc), weight: getWeight(proc), colorDetected: "none",
      });
    }
  }
  return found.sort((a, b) => b.weight - a.weight).slice(0, 8);
}

function buildMovement(text, num, headerLine = "") {
  const procs = detectProcedes(text);
  return {
    id: uid("mov"), number: num,
    title: headerLine ? headerLine.trim().slice(0, 50) : `Mouvement ${num}`,
    lines: "", bullets: procs.slice(0, 3).map(p => p.analysis), procedures: procs,
  };
}

function buildDefaultMovements(text) {
  const t = Math.floor(text.length / 3);
  return [
    buildMovement(text.slice(0, t), 1),
    buildMovement(text.slice(t, t * 2), 2),
    buildMovement(text.slice(t * 2), 3),
  ];
}

function detectMovements(text) {
  if (!text || text.length < 30) return buildDefaultMovements(text || "");
  const markerRe = /(?:^|\n)\s*(?:mouvement|mvt|partie|I{1,3}V?[\.\):]|[①②③④]|\d+[\.\)])\s*[:\-–—]?\s*/im;
  const parts = text.split(markerRe).map(p => p.trim()).filter(p => p.length > 15);
  if (parts.length >= 2) return parts.slice(0, 4).map((p, i) => buildMovement(p, i + 1));
  const lines = text.split("\n");
  const headerIdxs = lines.map((l, i) => ({ l, i }))
    .filter(({ l }) => l.trim().length > 5 && l.trim().length < 60 &&
      l.trim() === l.trim().toUpperCase() && /[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]/.test(l))
    .map(({ i }) => i);
  if (headerIdxs.length >= 2) {
    return headerIdxs.slice(0, 3).map((hi, idx) => {
      const block = lines.slice(hi, headerIdxs[idx + 1] || lines.length).join("\n");
      return buildMovement(block, idx + 1, lines[hi]);
    });
  }
  return buildDefaultMovements(text);
}

function detectIntro(text) {
  return text.split("\n").filter(l => l.trim().length > 15).slice(0, 3).join(" ").trim();
}

function detectConclusion(text) {
  const lower = text.toLowerCase();
  const idx = Math.max(lower.lastIndexOf("conclusion"), lower.lastIndexOf("en conclusion"));
  if (idx !== -1) return text.slice(idx + 11, idx + 350).replace(/\n/g, " ").trim();
  return text.split("\n").filter(l => l.trim().length > 15).slice(-3).join(" ").trim();
}

function detectMeta(text, filename = "") {
  const fnMatch = filename.match(/AL[\s_-]*(\d+)[\s_-]+(.+?)\.(jpg|png|jpeg)/i);
  if (fnMatch) return { title: fnMatch[2].trim(), author: "" };
  return { title: text.split("\n").find(l => l.trim().length > 5)?.trim().slice(0, 60) || "", author: "" };
}

function detectGenre(text) {
  const l = text.toLowerCase();
  if (/scène|acte|réplique|didascalie|tirade/.test(l)) return "theatre";
  if (/strophe|vers|sonnet|quatrain|rime|poème|poète/.test(l)) return "poesie";
  if (/chapitre|narrateur|roman|récit|focalisation/.test(l)) return "roman";
  return "general";
}

function generateIntro(title, genre, movements) {
  const g = { theatre:"extrait théâtral", poesie:"poème", roman:"extrait romanesque", general:"texte littéraire" };
  return `Ce ${g[genre]||"texte"}${title?` "${title}"`:""}  constitue un passage remarquable. Nous étudierons ${movements.slice(0,2).map(m=>m.title).join(" puis ")||"les mouvements du texte"}.`;
}

function generateConclusion(title, genre, movements) {
  return `En conclusion, ce texte${title?` "${title}"`:""}  déploie une progression à travers ${movements.map(m=>m.title).join(", ")||"ses mouvements"}. Les procédés construisent un sens révélateur des enjeux de l'œuvre.`;
}

function runWindowsOCR(imagePath) {
  return new Promise((resolve, reject) => {
    const psScript = path.join(SCRIPTS_DIR, "ocr_image.ps1");
    execFile("powershell", [
      "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-File", psScript, "-Path", path.resolve(imagePath),
    ], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const text = stdout.toString().trim();
      if (!text) return reject(new Error("Empty OCR output"));
      resolve(text);
    });
  });
}

function runTesseract(imagePath) {
  return new Promise((resolve, reject) => {
    execFile("tesseract", [imagePath, "stdout", "-l", "fra+eng", "--psm", "6"],
      { timeout: 30000 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.toString());
      });
  });
}

async function performOCR(imagePath) {
  if (process.platform === "win32") {
    try {
      const text = await runWindowsOCR(imagePath);
      if (text.length > 20) { console.log(`[OCR] Windows OCR: ${text.length} chars`); return text; }
    } catch (e) { console.warn(`[OCR] Windows OCR failed: ${e.message}`); }
  }
  try {
    const text = await runTesseract(imagePath);
    if (text.trim().length > 20) { console.log(`[OCR] Tesseract: ${text.length} chars`); return text.trim(); }
  } catch (e) { console.warn(`[OCR] Tesseract failed: ${e.message}`); }
  console.warn("[OCR] All methods failed");
  return "";
}

async function extractWithClaude(imagePaths, apiKey) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const content = [];
  for (const p of imagePaths) {
    const data = await fs.readFile(p);
    const mime = path.extname(p).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
    content.push({ type: "image", source: { type: "base64", media_type: mime, data: data.toString("base64") } });
  }
  content.push({ type: "text", text: `Analyse cette feuille d'analyse littéraire. Retourne UNIQUEMENT ce JSON valide (sans markdown):
{"title":"","author":"","genre":"theatre|poesie|roman|general","introduction":"2-3 phrases","conclusion":"2-3 phrases","movements":[{"number":1,"title":"","lines":"","procedures":[{"label":"","quote":"","analysis":"formulation nominale","weight":4,"colorDetected":"none"}]}],"oralBullets":["","",""],"qualityFlags":[]}
RÈGLES: analyses nominales, max 4 procédés/mouvement, générer intro/conclusion si absente.` });

  const response = await client.messages.create({ model: "claude-opus-4-5", max_tokens: 2000, messages: [{ role: "user", content }] });
  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
  parsed.id = uid("al");
  (parsed.movements || []).forEach(m => { m.id = uid("mov"); (m.procedures || []).forEach(p => { p.id = uid("proc"); }); });
  return parsed;
}

export async function extractFromImage(imagePath, apiKey) {
  return extractFromImages([imagePath], apiKey);
}

export async function extractFromImages(imagePaths, apiKey) {
  console.log(`[Extractor] Processing ${imagePaths.length} image(s)`);

  if (apiKey && apiKey.startsWith("sk-")) {
    console.log("[Extractor] Using Claude Vision API");
    try { return await extractWithClaude(imagePaths, apiKey); }
    catch (e) { console.warn("[Extractor] Claude API failed, falling back:", e.message); }
  }

  console.log("[Extractor] Using OCR pipeline (no API key)");
  const texts = [];
  for (const p of imagePaths) { const r = await performOCR(p); if (r) texts.push(r); }

  const combined = texts.join("\n\n");
  const cleaned = cleanText(combined);
  if (!cleaned || cleaned.length < 20) console.warn("[Extractor] OCR returned insufficient text");

  const filename = path.basename(imagePaths[0] || "");
  const meta = detectMeta(cleaned, filename);
  const genre = detectGenre(cleaned);
  const movements = detectMovements(cleaned);
  const alMatch = filename.match(/AL[\s_-]*(\d+)/i);

  return {
    id: uid("al"),
    label: alMatch ? `AL ${alMatch[1]}` : filename.replace(/\.[^.]+$/, ""),
    title: meta.title || filename.replace(/\.[^.]+$/, ""),
    author: meta.author || "",
    genre,
    introduction: detectIntro(cleaned) || generateIntro(meta.title, genre, movements),
    conclusion: detectConclusion(cleaned) || generateConclusion(meta.title, genre, movements),
    movements,
    oralBullets: movements.flatMap(m => (m.bullets || []).slice(0, 2)).slice(0, 4),
    qualityFlags: cleaned.length < 50 ? ["ocr-insufficient"] : [],
    sourceText: cleaned.slice(0, 1500),
  };
}

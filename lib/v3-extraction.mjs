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

const PRIORITY_PROCEDES = [
  "métaphore filée","métaphore","anaphore","antithèse","chiasme","oxymore",
  "hyperbole","champ lexical","registre","focalisation","ironie","gradation","allégorie"
];
const SECONDARY_PROCEDES = [
  "comparaison","personnification","parallélisme","énumération",
  "allitération","assonance","enjambement","discours direct","discours indirect libre","discours indirect"
];
const GENRE_PROC_BANK = {
  theatre: ["métaphore","anaphore","antithèse","chiasme","oxymore","hyperbole","champ lexical","registre tragique","focalisation","discours direct"],
  poesie: ["métaphore filée","métaphore","comparaison","personnification","allitération","assonance","enjambement","allégorie","champ lexical","ironie"],
  roman: ["comparaison","personnification","parallélisme","énumération","discours indirect libre","focalisation interne","ellipse","champ lexical","registre réaliste","ironie"],
  general: ["métaphore","comparaison","personnification","antithèse","chiasme","oxymore","hyperbole","allégorie","champ lexical","focalisation"]
};

function extractQuote(text, label, idx) {
  const snippet = text.slice(Math.max(0, idx - 40), idx + label.length + 80).replace(/\n/g, " ");
  const words = snippet.replace(/[^\p{L}0-9'’]+/gu, " ").trim().split(/\s+/);
  return words.slice(0, 5).join(" ");
}

function detectProcedes(text) {
  const found = [];
  for (const proc of PROCEDE_DICT) {
    const idx = lower.indexOf(proc);
    if (idx !== -1) {
      const quote = extractQuote(text, proc, idx);
      found.push({
        id: uid("proc"), label: proc,
        quote: quote || proc,
        analysis: getAnalysis(proc),
        weight: getWeight(proc),
        colorDetected: "none",
      });
    }
  }
  return found
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, "fr"))
    .filter((proc, index, arr) => index === arr.findIndex(p => p.analysis === proc.analysis))
    .slice(0, 10);
}

function generateFallbackProcedures(text, genre, existing = [], count = 5) {
  const usedAnalyses = new Set(existing.map(p => p.analysis));
  const bank = [...new Set([...(GENRE_PROC_BANK[genre] || []), ...PRIORITY_PROCEDES, ...SECONDARY_PROCEDES])];
  const fallback = [];
  for (const label of bank) {
    if (fallback.length >= count) break;
    const analysis = getAnalysis(label);
    if (usedAnalyses.has(analysis)) continue;
    const idx = (text || "").toLowerCase().indexOf(label);
    const quote = idx !== -1 ? extractQuote(text, label, idx) : label;
    fallback.push({
      id: uid("proc"), label,
      quote: quote || label,
      analysis,
      weight: getWeight(label),
      colorDetected: "none",
    });
    usedAnalyses.add(analysis);
  }
  return fallback.slice(0, count);
}

function ensureProcedures(procedures, text, genre) {
  const list = (procedures || []).slice(0, 10);
  if (list.length >= 5) return list;
  return [...list, ...generateFallbackProcedures(text, genre, list, 5 - list.length)].slice(0, 10);
}

function buildPhraseTheme(text, num) {
  const plain = (text || "").replace(/\s+/g, " ").trim();
  const sentence = plain.match(/([^\.\?\!]{20,200}[\.\?\!]?)\s*/);
  if (sentence) return sentence[1].trim().slice(0, 120);
  return `Thème du mouvement ${num}`;
}

function buildMovement(text, num, headerLine = "") {
  const title = headerLine ? headerLine.trim().slice(0, 50) : `Mouvement ${num}`;
  const block = (text || "").trim();
  return {
    id: uid("mov"), number: num,
    title: title || `Mouvement ${num}`,
    phraseTheme: buildPhraseTheme(block || title, num),
    procedures: ensureProcedures(detectProcedes(block), block, detectGenre(block)),
  };
}

function buildDefaultMovements(text) {
  const partLength = Math.max(1, Math.floor((text || "").length / 3));
  return [
    buildMovement((text || "").slice(0, partLength), 1),
    buildMovement((text || "").slice(partLength, partLength * 2), 2),
    buildMovement((text || "").slice(partLength * 2), 3),
  ];
}

function detectMovements(text) {
  const cleaned = (text || "").trim();
  if (!cleaned || cleaned.length < 30) return buildDefaultMovements(cleaned);
  const markerRe = /(?:^|\n)\s*(?:mouvement|mvt|partie|I{1,3}V?[\.\):]|[①②③④]|\d+[\.\)])\s*[:\-–—]?\s*/im;
  const parts = cleaned.split(markerRe).map(p => p.trim()).filter(p => p.length > 20);
  if (parts.length >= 3) return parts.slice(0, 4).map((p, i) => buildMovement(p, i + 1));

  const lines = cleaned.split("\n");
  const headerIdxs = lines.map((l, i) => ({ l, i }))
    .filter(({ l }) => l.trim().length > 5 && l.trim().length < 60 && l.trim() === l.trim().toUpperCase() && /[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]/.test(l))
    .map(({ i }) => i);
  if (headerIdxs.length >= 3) {
    return headerIdxs.slice(0, 3).map((hi, idx) => {
      const block = lines.slice(hi, headerIdxs[idx + 1] || lines.length).join("\n");
      return buildMovement(block, idx + 1, lines[hi]);
    });
  }
  return buildDefaultMovements(cleaned);
}

function pickProblematicCandidate(lines) {
  return lines.find(l => /probl(ém|e)m|comment|en quoi|quel(le)?/.test(l.toLowerCase()));
}

function formatProblemStatement(value) {
  const trimmed = (value || "").trim().replace(/\?$/, "");
  if (!trimmed) return "Quel sens le texte met-il en valeur";
  return trimmed.replace(/^(Quelle|Quel|Comment|Pourquoi)\b[\s,:]*/i, "").trim();
}

function formatAnnouncementPlan(movements) {
  const parts = movements.map((m, idx) => `mouvement ${idx + 1} : ${m.title || `thème ${idx + 1}`}`);
  return `Ce texte se divise en ${movements.length} mouvements : ${parts.join(" / ")}.`;
}

function formatAuthorContext(title, author, genre) {
  const authorPart = author ? `${author} est l'auteur` : "L'auteur";
  const genreText = genre === "theatre" ? "d'un extrait théâtral" : genre === "poesie" ? "d'un poème" : genre === "roman" ? "d'un extrait romanesque" : "d'un texte littéraire";
  return `${authorPart} ${genreText}${title ? ` intitulé « ${title} »` : ""}, ancré dans un contexte historique et littéraire.`;
}

function formatOeuvrePassage(title, work, genre) {
  const oeuvre = work || title || "l'œuvre";
  return `Extrait de ${oeuvre}, le passage illustre un moment significatif du texte.`;
}

function detectIntro(text, title, author, genre, movements) {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(l => l.length > 15);
  const auteurContexte = lines[0] && lines[0].length <= 140 ? lines[0] : formatAuthorContext(title, author, genre);
  const oeuvrePassage = lines[1] && lines[1].length <= 160 ? lines[1] : formatOeuvrePassage(title, title, genre);
  const problematique = formatProblemStatement(pickProblematicCandidate(lines) || "");
  const annoncePlan = formatAnnouncementPlan(movements);
  return { auteurContexte, oeuvrePassage, problematique, annoncePlan };
}

function detectConclusion(text, title, genre, movements) {
  const lower = (text || "").toLowerCase();
  const idx = Math.max(lower.lastIndexOf("conclusion"), lower.lastIndexOf("en conclusion"));
  const movementTitles = movements.map((m, i) => m.title || `le mouvement ${i + 1}`);
  const cheminementText = movementTitles.length === 1
    ? movementTitles[0]
    : movementTitles.length === 2
      ? `${movementTitles[0]} puis ${movementTitles[1]}`
      : `${movementTitles.slice(0, -1).join(", ")} puis ${movementTitles.slice(-1)}`;
  const defaultCheminement = movementTitles.length
    ? `Le texte suit successivement ${cheminementText}.`
    : "Le texte développe une progression par mouvements.";
  const reponse = "Il répond à la problématique en montrant comment les procédés structurent le sens du passage.";
  const ouverture = "On peut ouvrir sur un autre passage du même auteur ou sur un texte du même genre.";
  if (idx !== -1) {
    const conclusionText = (text || "").slice(idx).replace(/\n/g, " ").trim();
    const firstSentence = conclusionText.match(/([^\.\?\!]+[\.\?\!]?)\s*/);
    return {
      cheminement: firstSentence ? firstSentence[1].trim() : defaultCheminement,
      reponse,
      ouverture,
    };
  }
  return { cheminement: defaultCheminement, reponse, ouverture };
}

function detectMeta(text, filename = "") {
  const fileBase = filename.replace(/\.[^.]+$/, "");
  const fnMatch = fileBase.match(/AL[\s_-]*(\d+)[\s_-]+(.+?)(?:[\s_-]+(.+))?$/i);
  if (fnMatch) {
    const title = fnMatch[2].trim();
    const author = fnMatch[3] ? fnMatch[3].trim() : "";
    return { title, author, work: title };
  }
  const firstLine = (text || "").split("\n").find(l => l.trim().length > 5)?.trim() || fileBase || "";
  return { title: firstLine.slice(0, 60), author: "", work: firstLine.slice(0, 60) };
}

function detectGenre(text) {
  const l = (text || "").toLowerCase();
  if (/scène|acte|réplique|didascalie|tirade/.test(l)) return "theatre";
  if (/strophe|vers|sonnet|quatrain|rime|poème|poète|alexandrin|enjambement/.test(l)) return "poesie";
  if (/chapitre|narrateur|roman|récit|focalisation/.test(l)) return "roman";
  return "general";
}

function generateIntro(title, genre, movements) {
  const g = { theatre:"extrait théâtral", poesie:"poème", roman:"extrait romanesque", general:"texte littéraire" };
  return `Ce ${g[genre]||"texte"}${title?` "${title}"`:""} constitue un passage remarquable. Nous étudierons ${movements.slice(0,2).map(m=>m.title).join(" puis ")||"les mouvements du texte"}.`;
}

function generateConclusion(title, genre, movements) {
  return `En conclusion, ce texte${title?` "${title}"`:""} déploie une progression à travers ${movements.map(m=>m.title).join(", ")||"ses mouvements"}. Les procédés construisent un sens révélateur des enjeux de l'œuvre.`;
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
  const meta = detectMeta("", path.basename(imagePaths[0] || ""));
  const genre = parsed.genre || detectGenre(parsed.introduction || parsed.sourceText || "");
  const movements = ensureMovements((parsed.movements || []).map((m, idx) => {
    const blockText = `${m.title || ""} ${m.lines || ""}`.trim();
    return {
      id: uid("mov"), number: m.number || idx + 1,
      title: m.title || `Mouvement ${idx + 1}`,
      phraseTheme: m.title || buildPhraseTheme(blockText, idx + 1),
      procedures: ensureProcedures((m.procedures || []).map(p => ({
        id: uid("proc"),
        label: p.label || "procédé",
        quote: p.quote || "",
        analysis: p.analysis || getAnalysis(p.label || ""),
        weight: p.weight || getWeight(p.label || ""),
        colorDetected: p.colorDetected || "none",
      })), blockText, genre),
    };
  }), parsed.introduction || "");

  const introduction = detectIntro(parsed.introduction || "", parsed.title || meta.title, parsed.author || meta.author, genre, movements);
  const conclusion = detectConclusion(parsed.conclusion || "", parsed.title || meta.title, genre, movements);

  return {
    id: uid("al"),
    label: parsed.label || meta.title || `AL ${Date.now()}`,
    title: parsed.title || meta.title || "",
    author: parsed.author || meta.author || "",
    work: parsed.work || parsed.title || meta.work || meta.title || "",
    genre,
    introduction,
    conclusion,
    movements,
    oralBullets: Array.isArray(parsed.oralBullets) ? parsed.oralBullets.slice(0, 4) : [],
    qualityFlags: parsed.qualityFlags || [],
    sourceText: (parsed.sourceText || parsed.introduction || "").slice(0, 1500),
  };
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
  const movements = ensureMovements(detectMovements(cleaned), cleaned);
  const alMatch = filename.match(/AL[\s_-]*(\d+)/i);
  const introduction = detectIntro(cleaned, meta.title, meta.author, genre, movements);
  const conclusion = detectConclusion(cleaned, meta.title, genre, movements);
  const oralBullets = movements.flatMap(m => (m.procedures || []).slice(0, 2).map(p => p.analysis)).slice(0, 4);

  return {
    id: uid("al"),
    label: alMatch ? `AL ${alMatch[1]}` : filename.replace(/\.[^.]+$/, ""),
    title: meta.title || filename.replace(/\.[^.]+$/, ""),
    author: meta.author || "",
    work: meta.work || meta.title || filename.replace(/\.[^.]+$/, ""),
    genre,
    introduction,
    movements,
    conclusion,
    oralBullets,
    qualityFlags: cleaned.length < 20 ? ["ocr-insufficient"] : [],
    sourceText: cleaned.slice(0, 1500),
  };
}

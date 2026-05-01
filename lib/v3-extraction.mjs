// ============================================================
// lib/v3-extraction.mjs — Image → Structured AL data
// MODE 1: Anthropic Vision API (if ANTHROPIC_API_KEY set)
// MODE 2: Windows OCR → Tesseract fallback → text parsing
// FIX: unique IDs every call, never hardcoded, never crashes
// ============================================================
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

// ── Unique ID generator ──────────────────────────────────────
function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── French literary procédé dictionary (80+ entries) ─────────
const PROCEDE_DICT = [
  // Figures de style
  "métaphore", "métaphore filée", "comparaison", "personnification",
  "allégorie", "hyperbole", "litote", "euphémisme", "antiphrase",
  "ironie", "oxymore", "antithèse", "chiasme", "paradoxe",
  "synecdoque", "métonymie", "périphrase", "catachrèse",
  // Figures de construction
  "anaphore", "épiphore", "symploque", "gradation", "klimax",
  "énumération", "accumulation", "ellipse", "zeugme", "asyndète",
  "polysyndète", "parallélisme", "répétition", "pléonasme",
  "anacoluthe", "inversion", "hyperbate", "apostrophe",
  // Figures de son
  "allitération", "assonance", "onomatopée", "paronomase",
  "homéotéleute", "rythme", "cadence", "harmonie imitative",
  // Versification
  "alexandrin", "octosyllabe", "décasyllabe", "hémistiche",
  "césure", "enjambement", "rejet", "contre-rejet", "diérèse",
  "synérèse", "hiatus", "élision", "rime riche", "rime pauvre",
  "rime suffisante", "rime plate", "rime croisée", "rime embrassée",
  // Registres
  "registre lyrique", "registre épique", "registre tragique",
  "registre comique", "registre satirique", "registre polémique",
  "registre didactique", "registre fantastique", "registre pathétique",
  // Modes narratifs
  "discours direct", "discours indirect", "discours indirect libre",
  "monologue intérieur", "focalisation interne", "focalisation externe",
  "focalisation zéro", "narrateur omniscient", "point de vue",
  "analepse", "prolepse", "ellipse narrative", "pause descriptive",
  // Champs lexicaux / vocabulaire
  "champ lexical", "champ sémantique", "isotopie", "polysémie",
  "connotation", "dénotation", "néologisme", "archaïsme",
  // Autres
  "interrogation rhétorique", "exclamation", "impératif",
  "modalisation", "connecteurs logiques", "progression thématique",
];

function detectProcedes(text) {
  const found = [];
  const lower = text.toLowerCase();
  for (const proc of PROCEDE_DICT) {
    if (lower.includes(proc)) {
      found.push({
        id: uid("proc"),
        label: proc,
        quote: extractQuoteNear(text, proc),
        analysis: generateAnalysis(proc),
        weight: getWeight(proc),
        colorDetected: "none",
      });
    }
  }
  // Return up to 8 most important
  return found.sort((a, b) => b.weight - a.weight).slice(0, 8);
}

function extractQuoteNear(text, term) {
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return "";
  // Grab up to 40 chars after the term
  const snippet = text.slice(idx + term.length, idx + term.length + 40)
    .replace(/\n/g, " ").trim();
  // Look for quoted text
  const quoted = snippet.match(/[«""]([^»""]{3,30})[»""]/);
  return quoted ? quoted[1] : snippet.slice(0, 25);
}

function getWeight(proc) {
  const high = ["métaphore", "anaphore", "antithèse", "chiasme", "oxymore",
    "hyperbole", "champ lexical", "registre", "focalisation", "ironie"];
  const mid = ["comparaison", "personnification", "gradation", "parallélisme",
    "énumération", "allitération", "assonance", "enjambement"];
  if (high.some(h => proc.includes(h))) return 5;
  if (mid.some(m => proc.includes(m))) return 3;
  return 2;
}

// Genre-aware analysis generation
function generateAnalysis(proc) {
  const map = {
    "métaphore": "image poétique frappante",
    "métaphore filée": "cohérence thématique renforcée",
    "comparaison": "mise en relation significative",
    "personnification": "humanisation symbolique",
    "hyperbole": "intensité dramatique exacerbée",
    "litote": "atténuation chargée de sens",
    "antithèse": "tension des contraires révélée",
    "chiasme": "structure miroir signifiante",
    "oxymore": "paradoxe au cœur du sens",
    "ironie": "distanciation critique construite",
    "anaphore": "insistance rhétorique construite",
    "gradation": "progression dramatique maîtrisée",
    "énumération": "accumulation au service du sens",
    "champ lexical": "univers thématique cohérent",
    "registre lyrique": "lyrisme du poète affirmé",
    "registre tragique": "fatalité tragique installée",
    "registre comique": "comique au service de la satire",
    "focalisation interne": "subjectivité du narrateur révélée",
    "discours direct": "voix du personnage restituée",
    "allitération": "musicalité du vers construite",
    "assonance": "harmonie sonore valorisée",
    "enjambement": "souffle poétique débordant",
    "alexandrin": "forme classique maîtrisée",
    "interrogation rhétorique": "interpellation du lecteur construite",
  };
  return map[proc] || `procédé littéraire significatif`;
}

// ── Text cleaning ─────────────────────────────────────────────
function cleanText(raw = "") {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 3)
    .filter(l => {
      const letters = (l.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
      return letters > l.length * 0.4; // at least 40% letters
    })
    .join("\n")
    .trim();
}

// ── Movement detection ────────────────────────────────────────
function detectMovements(text) {
  if (!text || text.length < 20) {
    return buildDefaultMovements(text || "");
  }

  // Try to split on movement markers
  const markers = /(?:^|\n)\s*(?:mouvement|mvt|partie|I{1,3}V?|[①②③④]|\d+[\.\)])\s*[:\-–—]?\s*/im;
  const parts = text.split(markers).filter(p => p.trim().length > 10);

  if (parts.length >= 2) {
    return parts.slice(0, 4).map((p, i) => buildMovement(p, i + 1));
  }

  // Split on ALL CAPS lines (likely movement headers)
  const lines = text.split("\n");
  const headerIdxs = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.trim().length > 5 && l.trim() === l.trim().toUpperCase())
    .map(({ i }) => i);

  if (headerIdxs.length >= 2) {
    const movements = [];
    for (let h = 0; h < Math.min(headerIdxs.length, 3); h++) {
      const start = headerIdxs[h];
      const end = headerIdxs[h + 1] || lines.length;
      const block = lines.slice(start, end).join("\n");
      movements.push(buildMovement(block, h + 1, lines[start]));
    }
    return movements;
  }

  // Fallback: split into 3 equal parts
  return buildDefaultMovements(text);
}

function buildDefaultMovements(text) {
  const third = Math.floor(text.length / 3);
  return [
    buildMovement(text.slice(0, third), 1),
    buildMovement(text.slice(third, third * 2), 2),
    buildMovement(text.slice(third * 2), 3),
  ];
}

function buildMovement(text, num, headerLine = "") {
  const procs = detectProcedes(text);
  const title = headerLine
    ? headerLine.trim().slice(0, 50)
    : `Mouvement ${num}`;

  return {
    id: uid("mov"),
    number: num,
    title,
    lines: "",
    text: text.trim().slice(0, 200),
    bullets: procs.slice(0, 3).map(p => p.analysis),
    procedures: procs,
  };
}

// ── Intro / conclusion detection ──────────────────────────────
function detectIntro(text) {
  const lines = text.split("\n").filter(l => l.trim().length > 10);
  // First 2-3 lines before first movement marker are likely intro
  const introLines = lines.slice(0, 3).join(" ").trim();
  if (introLines.length > 20) return introLines;
  return "";
}

function detectConclusion(text) {
  const lower = text.toLowerCase();
  const idx = lower.lastIndexOf("conclusion");
  if (idx !== -1) {
    return text.slice(idx + 11, idx + 300).trim();
  }
  // Last 2 lines
  const lines = text.split("\n").filter(l => l.trim().length > 10);
  return lines.slice(-2).join(" ").trim();
}

// ── Title / author detection ──────────────────────────────────
function detectMeta(text, filename = "") {
  // Try filename first: "AL 1 - Texte.jpg" → "Texte"
  const fnMatch = filename.match(/AL\s*\d+\s*[-–]\s*(.+?)\.(jpg|png|jpeg)/i);
  if (fnMatch) return { title: fnMatch[1].trim(), author: "" };

  // Try first non-empty line
  const firstLine = text.split("\n").find(l => l.trim().length > 3) || "";
  return { title: firstLine.trim().slice(0, 60), author: "" };
}

function detectGenre(text) {
  const lower = text.toLowerCase();
  if (/scène|acte|réplique|didascalie|tirade|monologue/.test(lower)) return "theatre";
  if (/strophe|vers|sonnet|quatrain|rime|poème|poète/.test(lower)) return "poesie";
  if (/chapitre|narrateur|personnage|roman|récit|focalisation/.test(lower)) return "roman";
  return "general";
}

// ── OCR: Windows PowerShell ───────────────────────────────────
function runWindowsOCR(imagePath) {
  return new Promise((resolve, reject) => {
    const script = `
$null = [System.Reflection.Assembly]::LoadWithPartialName('System.Runtime.WindowsRuntime')
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($WinRtTask, $ResultType) {
  $asTaskSpecialized = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTaskSpecialized.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
[Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('${imagePath.replace(/\\/g, "\\\\")}')) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$lang = [Windows.Globalization.Language]::new('fr')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$result.Lines | ForEach-Object { $_.Text }
`.trim();

    execFile("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { timeout: 30000 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.toString());
      }
    );
  });
}

// ── OCR: Tesseract fallback ───────────────────────────────────
function runTesseract(imagePath) {
  return new Promise((resolve, reject) => {
    execFile("tesseract", [imagePath, "stdout", "-l", "fra+eng", "--psm", "6"],
      { timeout: 30000 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.toString());
      }
    );
  });
}

// ── OCR orchestrator ─────────────────────────────────────────
async function performOCR(imagePath) {
  // Try Windows OCR first (best for French handwriting)
  if (process.platform === "win32") {
    try {
      const text = await runWindowsOCR(imagePath);
      if (text && text.trim().length > 20) {
        console.log(`[OCR] Windows OCR success: ${text.length} chars`);
        return text;
      }
    } catch (e) {
      console.warn("[OCR] Windows OCR failed:", e.message);
    }
  }

  // Try Tesseract
  try {
    const text = await runTesseract(imagePath);
    if (text && text.trim().length > 20) {
      console.log(`[OCR] Tesseract success: ${text.length} chars`);
      return text;
    }
  } catch (e) {
    console.warn("[OCR] Tesseract failed:", e.message);
  }

  console.warn("[OCR] All OCR methods failed, returning empty");
  return "";
}

// ── Anthropic Vision API ──────────────────────────────────────
async function extractWithClaude(imagePaths, apiKey) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const imageContents = [];
  for (const p of imagePaths) {
    const data = await fs.readFile(p);
    const ext = path.extname(p).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    imageContents.push({
      type: "image",
      source: { type: "base64", media_type: mime, data: data.toString("base64") },
    });
  }

  imageContents.push({
    type: "text",
    text: `Analyse cette feuille d'analyse littéraire et retourne UNIQUEMENT ce JSON valide (sans markdown):
{
  "title": "titre du texte",
  "author": "auteur",
  "genre": "theatre|poesie|roman|general",
  "introduction": "2-3 phrases contextualisées",
  "conclusion": "2-3 phrases bilan oral avec ouverture",
  "movements": [{
    "number": 1,
    "title": "titre court et précis du mouvement",
    "lines": "v.1-12",
    "procedures": [{
      "label": "nom du procédé",
      "quote": "citation 5 mots max",
      "analysis": "formulation nominale orale (ex: liberté du poète revendiquée)",
      "weight": 4,
      "colorDetected": "jaune|rose|vert|bleu|none"
    }]
  }],
  "oralBullets": ["bullet 1", "bullet 2", "bullet 3"],
  "qualityFlags": []
}
RÈGLES: analyses nominales uniquement, max 4 procédés par mouvement, générer intro/conclusion si absente.`,
  });

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: imageContents }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Assign unique IDs to all nested objects
  parsed.id = uid("al");
  (parsed.movements || []).forEach(m => {
    m.id = uid("mov");
    (m.procedures || []).forEach(p => { p.id = uid("proc"); });
  });

  return parsed;
}

// ── Main export ───────────────────────────────────────────────
export async function extractFromImage(imagePath, apiKey) {
  return extractFromImages([imagePath], apiKey);
}

export async function extractFromImages(imagePaths, apiKey) {
  console.log(`[Extractor] Processing ${imagePaths.length} image(s)`);

  // MODE 1: Use Claude Vision if API key available
  if (apiKey && apiKey.startsWith("sk-")) {
    console.log("[Extractor] Using Claude Vision API");
    try {
      return await extractWithClaude(imagePaths, apiKey);
    } catch (e) {
      console.warn("[Extractor] Claude API failed, falling back to OCR:", e.message);
    }
  }

  // MODE 2: OCR pipeline
  console.log("[Extractor] Using OCR pipeline (no API key)");

  const allText = [];
  for (const imgPath of imagePaths) {
    const raw = await performOCR(imgPath);
    if (raw) allText.push(raw);
  }

  const combinedRaw = allText.join("\n\n");
  const cleaned = cleanText(combinedRaw);

  if (!cleaned || cleaned.length < 20) {
    console.warn("[Extractor] OCR returned insufficient text");
  }

  const filename = path.basename(imagePaths[0] || "");
  const meta = detectMeta(cleaned, filename);
  const genre = detectGenre(cleaned);
  const movements = detectMovements(cleaned);
  const intro = detectIntro(cleaned);
  const conclusion = detectConclusion(cleaned);

  // Generate intro/conclusion from template if missing
  const finalIntro = intro || generateIntroTemplate(meta.title, genre, movements);
  const finalConclusion = conclusion || generateConclusionTemplate(meta.title, genre, movements);

  const alId = uid("al");
  // Extract AL number from filename if possible
  const alMatch = filename.match(/AL[\s_-]*(\d+)/i);
  const alLabel = alMatch ? `AL ${alMatch[1]}` : alId;

  return {
    id: alId,
    label: alLabel,
    title: meta.title || filename.replace(/\.[^.]+$/, ""),
    author: meta.author || "",
    genre,
    introduction: finalIntro,
    conclusion: finalConclusion,
    movements,
    oralBullets: movements.flatMap(m => m.bullets || []).slice(0, 4),
    qualityFlags: cleaned.length < 50 ? ["ocr-insufficient"] : [],
    sourceText: cleaned.slice(0, 1000),
    demoMode: false,
  };
}

// ── Template generators ───────────────────────────────────────
function generateIntroTemplate(title, genre, movements) {
  const genreLabel = {
    theatre: "extrait théâtral",
    poesie: "poème",
    roman: "extrait romanesque",
    general: "texte littéraire",
  }[genre] || "texte";

  const movTitles = movements.slice(0, 2).map(m => m.title).join(" puis ");

  return `Ce ${genreLabel}${title ? ` intitulé "${title}"` : ""} constitue un passage remarquable de la littérature française. Nous étudierons successivement ${movTitles || "les différents mouvements du texte"}. Cette analyse vise à dégager les enjeux littéraires essentiels du passage.`;
}

function generateConclusionTemplate(title, genre, movements) {
  const movTitles = movements.map(m => m.title).join(", ");
  return `En conclusion, ce texte${title ? ` "${title}"` : ""} déploie une progression littéraire rigoureuse à travers ${movTitles || "ses différents mouvements"}. L'ensemble des procédés mobilisés concourt à construire un sens profond, révélateur des enjeux de l'œuvre. Ce passage invite à une réflexion plus large sur les questionnements de l'auteur.`;
}

const FILLER_PATTERNS = [
  /\bon voit que\b/gi,
  /\bcela montre que\b/gi,
  /\bil y a\b/gi,
  /\bpermet de voir\b/gi,
  /\bl['’]auteur utilise\b/gi,
  /\ble texte montre que\b/gi,
];
// Patterns pour détecter le bruit OCR (caractères parasites non-linguistiques)
const OCR_NOISE_PATTERNS = [
  /^[O0][\s]*[SZ][\s]*[E0][\s]*[O0]/gi, // "O SE O", "0SZ0", etc.
  /[O0]{2,}[\s]*[LIJ]{2,}[\s]*[J]{1,}/gi, // "OOLLJ...", "00LLJ", etc.
  /^[\W_]{5,}$/gm, // Lignes de caractères spéciaux uniquement
  /[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, // Caractères de contrôle
];

export function isOcrNoiseDetected(text = "") {
  if (!text || text.length < 3) {
    return false;
  }
  // Compter le ratio de caractères alphanumériques
  const cleanChars = text.replace(/[^a-zà-ÿ0-9]/gi, "");
  const ratio = cleanChars.length / text.length;
  
  if (ratio < 0.3) {
    return true; // Moins de 30% de caractères linguistiques
  }
  
  // Vérifier les patterns de bruit spécifiques
  return OCR_NOISE_PATTERNS.some(pattern => pattern.test(text));
}

export function cleanOcrText(text = "") {
  if (!text) return "";
  
  let cleaned = cleanText(text);
  
  // Déterminer si le texte est du bruit OCR
  if (isOcrNoiseDetected(cleaned)) {
    return ""; // Texte à ignorer
  }
  
  // Remplacer les séquences de bruit par des espaces
  cleaned = cleaned.replace(/[O0]{2,}[\s]*[LIJ]{2,}[\s]*[J]{1,}/gi, "");
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  return cleaned;
}
const GENERIC_TEMPLATES = {
  theatre: {
    movementTitles: ["Conflit initial", "Montée de la tension", "Vérité finale"],
    oralTemplates: [
      "parole transformée en affrontement",
      "sentiment mis à nu",
      "jeu de pouvoir amoureux",
      "bascule dramatique",
    ],
    procedureDefaults: [
      "parole vive",
      "opposition des voix",
      "tension dramatique",
      "registre pathétique",
    ],
  },
  poesie: {
    movementTitles: ["Élan poétique", "Renversement des valeurs", "Liberté créatrice"],
    oralTemplates: [
      "liberté du poète",
      "réel transformé en matière poétique",
      "beauté paradoxale",
      "énergie de la voix",
    ],
    procedureDefaults: [
      "images frappantes",
      "rythme expressif",
      "lexique sensoriel",
      "provocation créatrice",
    ],
  },
  roman: {
    movementTitles: ["Entrée dans l'enjeu", "Tension romanesque", "Portée du passage"],
    oralTemplates: [
      "naissance du désir",
      "portrait révélateur",
      "bascule du destin",
      "intensité romanesque",
    ],
    procedureDefaults: [
      "point de vue marqué",
      "dramatisation du récit",
      "lexique affectif",
      "portrait valorisant ou dévalorisant",
    ],
  },
  general: {
    movementTitles: ["Ouverture du passage", "Tension du passage", "Sens final du passage"],
    oralTemplates: [
      "enjeu majeur du passage",
      "émotion dominante",
      "progression de l'argument",
      "effet produit sur le lecteur",
    ],
    procedureDefaults: [
      "contraste fort",
      "rythme expressif",
      "champ lexical dominant",
    ],
  },
};

function toTitleCase(value = "") {
  return value
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/giu, (match) => match.toUpperCase());
}

export function slugify(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleanText(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function collapseWhitespace(value = "") {
  return cleanText(value).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

export function parseAlNumber(value = "") {
  const match =
    value.match(/\bAL\s*[-:]?\s*(\d{1,2})\b/i) ||
    value.match(/\bTexte\s*(\d{1,2})\b/i);
  return match ? Number(match[1]) : null;
}

export function detectALFromFilename(filename = "", sequence = null) {
  const alNumber = parseAlNumber(filename);
  if (alNumber) {
    return `AL-${alNumber}`;
  }

  if (!sequence) {
    return null;
  }

  const normalizedName = slugify(filename);
  const found = (sequence.texts || []).find((text) => {
    const token = slugify(`${text.title || ""} ${text.author || ""} ${text.excerpt || ""}`);
    return token && normalizedName.includes(token.slice(0, 24));
  });
  return found?.id ?? null;
}

export function guessGenre(sequence = {}) {
  const target = collapseWhitespace(
    `${sequence.objectStudy || ""} ${sequence.work?.title || ""} ${sequence.parcours || ""}`,
  ).toLowerCase();

  if (target.includes("théâtre") || target.includes("theatre") || target.includes("scène") || target.includes("scene")) {
    return "theatre";
  }
  if (target.includes("poésie") || target.includes("poesie") || target.includes("poète") || target.includes("poete")) {
    return "poesie";
  }
  if (target.includes("roman") || target.includes("récit") || target.includes("recit")) {
    return "roman";
  }
  return "general";
}

function splitSentences(text = "") {
  return cleanText(text)
    .split(/(?<=[.!?;:])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function chunkSentences(text = "", targetCount = 3) {
  const sentences = splitSentences(text);
  if (!sentences.length) {
    return [];
  }

  const count = Math.min(targetCount, sentences.length >= 8 ? 3 : 2);
  const size = Math.ceil(sentences.length / count);
  const chunks = [];
  for (let index = 0; index < sentences.length; index += size) {
    chunks.push(sentences.slice(index, index + size).join(" "));
  }
  return chunks.slice(0, count);
}

function detectRepetitions(text = "") {
  const words = collapseWhitespace(text)
    .toLowerCase()
    .split(/[^a-zà-ÿœ'-]+/iu)
    .filter((word) => word.length >= 5);
  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((left, right) => right[1] - left[1])
    .map(([word]) => word)
    .slice(0, 3);
}

function inferMovementTitle(chunk = "", genre = "general", index = 0) {
  const normalized = chunk.toLowerCase();
  const defaults = GENERIC_TEMPLATES[genre] || GENERIC_TEMPLATES.general;

  if (genre === "theatre") {
    if (normalized.includes("?")) {
      return "Questionnement conflictuel";
    }
    if (normalized.includes("adieu") || normalized.includes("sort")) {
      return "Rupture dramatique";
    }
  }

  if (genre === "poesie") {
    if (normalized.includes("route") || normalized.includes("voyage") || normalized.includes("bohème")) {
      return "Errance poétique";
    }
    if (/\bje\b|\bmoi\b/iu.test(normalized)) {
      return "Affirmation de soi";
    }
  }

  if (genre === "roman") {
    if (normalized.includes("rencontre") || normalized.includes("aperç")) {
      return "Naissance du romanesque";
    }
    if (normalized.includes("mort") || normalized.includes("malheur")) {
      return "Issue tragique";
    }
  }

  return defaults.movementTitles[index] || GENERIC_TEMPLATES.general.movementTitles[index] || `Mouvement ${index + 1}`;
}

function createProcedure(label, impact, weight = 1) {
  return { label, impact, weight };
}

export function detectProcedures(text = "", genre = "general") {
  const source = cleanText(text);
  const lowered = source.toLowerCase();
  const procedures = [];

  if (source.includes("?")) {
    procedures.push(createProcedure("interrogations", "certitude mise en crise", 3));
  }
  if (source.includes("!")) {
    procedures.push(createProcedure("exclamations", "émotion portée au premier plan", 3));
  }
  if (/["«»]/.test(source)) {
    procedures.push(createProcedure("discours direct", "parole rendue plus vive", 2));
  }
  if (/\b(mais|pourtant|cependant|or|tandis que)\b/iu.test(source)) {
    procedures.push(createProcedure("oppositions", "tension et renversement", 3));
  }
  if (/\b(je|moi|me|mon|ma)\b/iu.test(source)) {
    procedures.push(createProcedure("première personne", "subjectivité pleinement assumée", 2));
  }
  if (/\b(amour|cœur|coeur|désir|desir|passion|souffrance|bonheur)\b/iu.test(source)) {
    procedures.push(createProcedure("lexique affectif", "sentiment mis au centre", 3));
  }
  if (/\b(non|jamais|rien|plus|aucun)\b/iu.test(source)) {
    procedures.push(createProcedure("négations", "refus radical mis en avant", 2));
  }
  if (/\b(ciel|terre|route|fontaine|soleil|nuit|bois|vent|eau|abîme|abime)\b/iu.test(source)) {
    procedures.push(createProcedure("images du monde sensible", "réel transformé en image forte", 2));
  }
  if (/\b(va|viens|laisse|regarde|écoute|retourne|dis|dites)\b/iu.test(source)) {
    procedures.push(createProcedure("impératifs", "volonté d'agir ou de dominer", 2));
  }

  const repetitions = detectRepetitions(source);
  if (repetitions.length) {
    procedures.push(
      createProcedure(`répétitions (${repetitions.join(", ")})`, "obsession ou insistance", 2),
    );
  }

  for (const fallback of GENERIC_TEMPLATES[genre]?.procedureDefaults || GENERIC_TEMPLATES.general.procedureDefaults) {
    procedures.push(createProcedure(fallback, "effet structurant du passage", 1));
  }

  const unique = [];
  const seen = new Set();
  for (const item of procedures.sort((left, right) => right.weight - left.weight)) {
    if (seen.has(item.label)) {
      continue;
    }
    seen.add(item.label);
    unique.push(item);
  }

  return unique.slice(0, 6);
}

export function simplifyPhrase(value = "") {
  let output = cleanText(value);
  for (const pattern of FILLER_PATTERNS) {
    output = output.replace(pattern, "");
  }
  output = output
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,:;\s-]+/g, "")
    .trim();

  if (!output) {
    return "";
  }
  return output.charAt(0).toLowerCase() + output.slice(1);
}

function sharpenBullet(bullet = "", fallbacks = []) {
  const cleaned = simplifyPhrase(bullet);
  if (!cleaned) {
    return fallbacks[0] || "";
  }
  if (cleaned.split(" ").length <= 7 && !/\b(montre|voit|utilise|permet)\b/iu.test(cleaned)) {
    return cleaned;
  }
  return fallbacks.find(Boolean) || cleaned;
}

export function buildMovementsFromText(text = "", genre = "general") {
  const chunks = chunkSentences(text, 3);
  if (!chunks.length) {
    return [
      { title: inferMovementTitle("", genre, 0), bullets: ["entrée dans l'enjeu du passage"], excerpt: "" },
      { title: inferMovementTitle("", genre, 1), bullets: ["progression du conflit ou de l'idée"], excerpt: "" },
      { title: inferMovementTitle("", genre, 2), bullets: ["sens final du passage"], excerpt: "" },
    ];
  }

  return chunks.map((chunk, index) => {
    const keyProcedures = detectProcedures(chunk, genre).slice(0, 2);
    const bullets = keyProcedures.map((procedure) => simplifyPhrase(procedure.impact)).filter(Boolean);
    return {
      title: inferMovementTitle(chunk, genre, index),
      bullets: bullets.length ? bullets : ["enjeu du mouvement"],
      excerpt: chunk,
    };
  });
}

export function buildOralBullets(text = "", genre = "general", procedures = []) {
  const defaults = GENERIC_TEMPLATES[genre] || GENERIC_TEMPLATES.general;
  const ideas = [
    ...procedures.slice(0, 3).map((procedure) => simplifyPhrase(procedure.impact)),
    ...defaults.oralTemplates,
  ].filter(Boolean);

  return ideas.filter((item, index) => ideas.indexOf(item) === index).slice(0, 4);
}

function buildTitle(meta = {}, sequence = {}) {
  if (meta.title) {
    return meta.title;
  }
  const parts = [
    meta.author || sequence.work?.author || "",
    meta.excerpt || meta.work || sequence.work?.title || "",
  ].filter(Boolean);
  return parts.join(" - ");
}

function buildIntroduction(draft = {}, genre = "general") {
  if (!draft.sourceText || draft.sourceText.length < 10) {
    return "Passage de référence non spécifié - à remplir manuellement.";
  }
  
  const templates = {
    theatre: `Dans ce passage de ${draft.author || "théâtre"}, ${draft.title || "ce texte"} met en scène une situation où ${draft.keyProcedures?.[0]?.label || "le conflit"}. Le texte déploie plusieurs procédés clés qui structurent l'enjeu dramatique.`,
    poesie: `Ce poème de ${draft.author || "poète"} intitulé "${draft.title || "untitled"}" explore ${draft.keyProcedures?.[0]?.label || "un thème poétique"}. Le texte construit son univers à travers des procédés caractéristiques qui en font un moment clé de la séquence.`,
    roman: `Dans cet extrait de ${draft.work || "roman"}, ${draft.author || "l'auteur"} présente ${draft.title || "une scène"}. Ce passage révèle ${draft.keyProcedures?.[0]?.label || "l'intensité romanesque"}  par ses choix narratifs remarquables.`,
    general: `Ce texte, "${draft.title || "passage"}", est un moment charnière qui concentre plusieurs enjeux majeurs. L'analyse suivante en dégage les mouvements structurants et les procédés d'écriture qui en font l'intérêt.`,
  };
  
  return templates[genre] || templates.general;
}

function buildConclusion(draft = {}, genre = "general") {
  if (!draft.oralBullets || draft.oralBullets.length === 0) {
    return "À partir de cette analyse, on peut conclure à l'importance de ce passage pour comprendre l'œuvre et la séquence.";
  }
  
  const mainPoint = draft.oralBullets[0] || "l'enjeu central";
  const secondPoint = draft.oralBullets[1] || "les enjeux secondaires";
  
  const templates = {
    theatre: `En conclusion, ce passage illustre comment ${mainPoint}. Au-delà de ${secondPoint}, c'est la dynamique dramatique qui prime : ce texte montre l'art du dramaturge à condenser l'affrontement en quelques répliques décisives.`,
    poesie: `En conclusion, ce poème se définit par ${mainPoint}. Loin de seulement décrire, le texte ${secondPoint}. C'est cette tension entre forme et sens qui en fait un exemplum de la poésie moderne.`,
    roman: `En conclusion, ce passage révèle ${mainPoint}. Ce qui frappe avant tout, c'est ${secondPoint}. Le romancier construit ainsi une intensité narrative qui justifie la place centrale de cet extrait.`,
    general: `En conclusion, ce passage concentre plusieurs enjeux : d'une part ${mainPoint}, d'autre part ${secondPoint}. C'est pourquoi il constitue un moment privilégié pour aborder les questions clés de la séquence.`,
  };
  
  return templates[genre] || templates.general;
}

export function createAnalysisDraft({ sequence = {}, al = {}, sourceText = "" }) {
  const genre = guessGenre(sequence);
  const cleanedText = cleanText(sourceText);
  
  // Copie profonde des procédures pour éviter les mutations partagées
  const procedures = JSON.parse(JSON.stringify(detectProcedures(cleanedText || al.excerpt || al.title || "", genre)));
  
  const movements = buildMovementsFromText(cleanedText || al.excerpt || al.title || "", genre);
  const oralBullets = buildOralBullets(cleanedText, genre, procedures);
  const title = buildTitle(al, sequence);

  const draft = {
    ...al,
    title,
    genre,
    sourceText: cleanedText,
    movements,
    keyProcedures: procedures,
    oralBullets,
    introduction: buildIntroduction({ ...al, author: al.author, work: al.work, title, keyProcedures: procedures }, genre),
    conclusion: buildConclusion({ oralBullets }, genre),
    id: al.id || `AL-${Date.now()}`,
    label: al.label || al.id,
  };

  return ensureCompleteEntry(draft, sequence, false);
}

export function simplifyAnalysisEntry(entry = {}) {
  // Copie profonde pour éviter les mutations
  const entryClone = JSON.parse(JSON.stringify(entry));
  return {
    ...entryClone,
    movements: (entryClone.movements || []).map((movement, index) => ({
      title: cleanText(movement.title || `Mouvement ${index + 1}`),
      bullets: (movement.bullets || [])
        .map((bullet) => simplifyPhrase(bullet))
        .filter(Boolean)
        .slice(0, 3),
      excerpt: cleanText(movement.excerpt || ""),
    })),
    oralBullets: (entryClone.oralBullets || [])
      .map((bullet) => simplifyPhrase(bullet))
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function highlightKeyProcedures(entry = {}) {
  // Copie profonde pour éviter les mutations
  const entryClone = JSON.parse(JSON.stringify(entry));
  return {
    ...entryClone,
    keyProcedures: (entryClone.keyProcedures || [])
      .slice()
      .sort((left, right) => (right.weight || 0) - (left.weight || 0))
      .map((procedure, index) => ({
        ...procedure,
        oralLabel: `${index === 0 ? "Procédé-clé" : "Procédé"} : ${procedure.label} -> ${procedure.impact}`,
      })),
  };
}

export function fixWeakAnalyses(entry = {}) {
  // Copie profonde pour éviter les mutations de l'objet original
  const entryClone = JSON.parse(JSON.stringify(entry));
  
  const reinforcements = [
    entryClone.keyProcedures?.[0]?.impact,
    entryClone.keyProcedures?.[1]?.impact,
    ...(GENERIC_TEMPLATES[entryClone.genre]?.oralTemplates || []),
  ]
    .map((item) => simplifyPhrase(item))
    .filter(Boolean);

  return {
    ...entryClone,
    movements: (entryClone.movements || []).map((movement) => ({
      ...movement,
      bullets: (movement.bullets || [])
        .map((bullet) => sharpenBullet(bullet, reinforcements))
        .filter(Boolean)
        .slice(0, 3),
    })),
    oralBullets: (entryClone.oralBullets || [])
      .map((bullet) => sharpenBullet(bullet, reinforcements))
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function ensureCompleteEntry(entry = {}, sequence = {}, skipDefaults = false) {
  let output = {
    ...entry,
    title: cleanText(entry.title || buildTitle(entry, sequence)),
    genre: entry.genre || guessGenre(sequence),
    sourceText: cleanText(entry.sourceText || ""),
    // Copie profonde pour éviter les mutations partagées
    movements: Array.isArray(entry.movements) ? JSON.parse(JSON.stringify(entry.movements)) : [],
    keyProcedures: Array.isArray(entry.keyProcedures) ? JSON.parse(JSON.stringify(entry.keyProcedures)) : [],
    oralBullets: Array.isArray(entry.oralBullets) ? [...(entry.oralBullets || [])] : [],
    sequenceLabel: entry.sequenceLabel || sequence.label || "",
  };

  // Si skipDefaults est vrai, on ne remplit PAS avec les valeurs par défaut
  if (!skipDefaults) {
    if (!output.movements.length) {
      output.movements = buildMovementsFromText(output.sourceText || output.title, output.genre);
    }
    if (!output.keyProcedures.length) {
      output.keyProcedures = detectProcedures(output.sourceText || output.title, output.genre);
    }
    if (!output.oralBullets.length) {
      output.oralBullets = buildOralBullets(output.sourceText || output.title, output.genre, output.keyProcedures);
    }
  }

  output = simplifyAnalysisEntry(output);
  output = highlightKeyProcedures(output);
  output = fixWeakAnalyses(output);

  output.qualityFlags = [];
  if (!output.sourceText) {
    output.qualityFlags.push("missing-source-text");
  }
  if (output.oralBullets.some((bullet) => bullet.length > 60)) {
    output.qualityFlags.push("bullet-too-long");
  }
  if ((output.movements || []).length < 2) {
    output.qualityFlags.push("missing-movements");
  }

  return output;
}

export function mergeProcessedEntry(target = {}, patch = {}) {
  const merged = {
    ...target,
    ...patch,
    // Copie profonde pour éviter les mutations partagées
    movements: patch.movements ? JSON.parse(JSON.stringify(patch.movements)) : JSON.parse(JSON.stringify(target.movements || [])),
    keyProcedures: patch.keyProcedures ? JSON.parse(JSON.stringify(patch.keyProcedures)) : JSON.parse(JSON.stringify(target.keyProcedures || [])),
    oralBullets: patch.oralBullets ? [...patch.oralBullets] : [...(target.oralBullets || [])],
  };
  return ensureCompleteEntry(
    merged,
    { id: target.sequenceId, ...target.sequenceMeta },
    true // skipDefaults=true pour ne pas réinjecter les templates par défaut
  );
}

// ========================================================
// ELITE QUALITY LAYER - PEDAGOGICAL SUPERIORITY ALGORITHMS
// ========================================================

/**
 * ELITE QUALITY TRANSFORMATION
 * Transforms standard analysis into exam-ready, orally-performable bullets
 * Focus: Interpretation over description, memorability, oral performance
 */
export function eliteQualityTransform(entry = {}) {
  let eliteEntry = JSON.parse(JSON.stringify(entry));

  // 1. PEDAGOGICAL SUPERIORITY: Remove generic, focus on interpretation
  eliteEntry.keyProcedures = eliteEntry.keyProcedures?.map(proc => ({
    ...proc,
    label: transformToEliteProcedure(proc.label),
    impact: transformToEliteImpact(proc.impact)
  }));

  // 2. MEMORY OPTIMIZATION: Chunk into 2-4 bullets max, rhythmical phrasing
  eliteEntry.movements = eliteEntry.movements?.map(movement => ({
    ...movement,
    bullets: optimizeForMemory(movement.bullets)
  }));

  // 3. ORAL PERFORMANCE: Make each bullet directly reusable orally
  eliteEntry.oralBullets = eliteEntry.oralBullets?.map(bullet =>
    transformForOralPerformance(bullet)
  );

  // 4. INTELLIGENT SIMPLIFICATION: Merge similar ideas, remove redundancy
  eliteEntry = intelligentSimplification(eliteEntry);

  return eliteEntry;
}

/**
 * TRANSFORM GENERIC PROCEDURES TO ELITE INTERPRETATIONS
 * BAD: "use of metaphor" → GOOD: "valorise la liberté du poète"
 */
function transformToEliteProcedure(label = "") {
  const eliteMappings = {
    // Théâtre
    "parole vive": "parole transformée en affrontement",
    "opposition des voix": "conflit dramatique exacerbé",
    "tension dramatique": "bascule dramatique imminente",
    "registre pathétique": "émotion portée au paroxysme",

    // Poésie
    "images frappantes": "réel transformé en matière poétique",
    "rythme expressif": "énergie de la voix poétique",
    "lexique sensoriel": "beauté paradoxale du monde sensible",
    "provocation créatrice": "liberté du poète revendiquée",

    // Roman
    "point de vue marqué": "subjectivité narrative assumée",
    "dramatisation du récit": "intensité romanesque déployée",
    "lexique affectif": "sentiment mis au centre du récit",
    "portrait valorisant": "personnage transcendé par l'écriture",

    // Général
    "contraste fort": "opposition structurante du passage",
    "rythme expressif": "progression rythmique signifiante",
    "champ lexical dominant": "univers lexical cohérent déployé"
  };

  return eliteMappings[label.toLowerCase()] || label;
}

/**
 * TRANSFORM DESCRIPTIVE IMPACT TO INTERPRETATIVE INSIGHT
 */
function transformToEliteImpact(impact = "") {
  const eliteMappings = {
    // Théâtre
    "certitude mise en crise": "doute existentiel révélé",
    "émotion portée au premier plan": "pathos dramatique déployé",
    "tension et renversement": "bascule dramatique consommée",
    "parole rendue plus vive": "dialogue transformé en confrontation",

    // Poésie
    "sentiment mis au centre": "émotion poétique sublimée",
    "réel transformé en image forte": "transfiguration poétique opérée",
    "obsession ou insistance": "thème poétique martelé",
    "subjectivité pleinement assumée": "je poétique souverain",

    // Roman
    "naissance du désir": "éros romanesque éveillé",
    "portrait révélateur": "psychologie mise à nu",
    "bascule du destin": "fatalité romanesque enclenchée",
    "intensité romanesque": "passion narrative déployée"
  };

  // Find matching impact
  for (const [key, value] of Object.entries(eliteMappings)) {
    if (impact.toLowerCase().includes(key.split(' ')[0])) {
      return value;
    }
  }

  return impact;
}

/**
 * MEMORY OPTIMIZATION: Create 2-4 rhythmical, memorable bullets
 */
function optimizeForMemory(bullets = []) {
  if (!bullets.length) return ["enjeu du mouvement"];

  // Keep only 2-4 most impactful bullets
  const optimized = bullets.slice(0, 4);

  // Transform to rhythmical, memorable phrasing
  return optimized.map(bullet => {
    // Remove filler words and long sentences
    let clean = bullet
      .replace(/\b(on voit que|cela montre|il y a|permet de voir|l'auteur utilise|le texte montre)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Make it punchy and memorable
    if (clean.length > 50) {
      clean = clean.split(/[.;]/)[0].trim(); // Take first sentence
    }

    return clean.charAt(0).toLowerCase() + clean.slice(1);
  }).filter(Boolean);
}

/**
 * ORAL PERFORMANCE TRANSFORMATION
 * Transform descriptive analysis to performative, orally-reusable bullets
 *
 * BAD: "montre que le personnage est triste"
 * GOOD: "tristesse du personnage"
 */
function transformForOralPerformance(bullet = "") {
  // Remove descriptive verbs and make it performative
  const transformations = [
    // Remove "montre que" patterns
    [/\b(montre que|révèle que|indique que|prouve que)\b/gi, ''],

    // Transform "le personnage est X" → "X du personnage"
    [/\ble personnage (est|semble|devient|paraît) ([a-zà-ÿ]+)\b/gi, '$2 du personnage'],

    // Transform "mise en X" → "X déployé"
    [/\bmise en (évidence|valeur|scène|avant)\b/gi, '$1 déployée'],

    // Transform "permet de X" → "X rendu possible"
    [/\bpermet de ([a-zà-ÿ]+)\b/gi, '$1 rendu possible'],

    // Remove filler words
    [/\b(ainsi|donc|par conséquent|en effet|effectivement)\b/gi, '']
  ];

  let transformed = bullet;
  for (const [pattern, replacement] of transformations) {
    transformed = transformed.replace(pattern, replacement);
  }

  // Clean up and make it punchy
  transformed = transformed
    .replace(/\s+/g, ' ')
    .replace(/^[.,;:\s]+/, '') // Remove leading punctuation
    .trim();

  // Ensure it's not too long for oral delivery
  if (transformed.length > 60) {
    transformed = transformed.split(/[.;]/)[0].trim();
  }

  return transformed;
}

/**
 * INTELLIGENT SIMPLIFICATION: Merge similar ideas, remove redundancy
 */
function intelligentSimplification(entry = {}) {
  const simplified = JSON.parse(JSON.stringify(entry));

  // Merge similar procedures
  if (simplified.keyProcedures) {
    simplified.keyProcedures = mergeSimilarProcedures(simplified.keyProcedures);
  }

  // Merge similar oral bullets
  if (simplified.oralBullets) {
    simplified.oralBullets = mergeSimilarBullets(simplified.oralBullets);
  }

  // Ensure movements have clear progression
  if (simplified.movements) {
    simplified.movements = ensureLogicalFlow(simplified.movements);
  }

  return simplified;
}

/**
 * Merge procedures with similar meanings
 */
function mergeSimilarProcedures(procedures = []) {
  const merged = [];
  const seen = new Set();

  for (const proc of procedures) {
    const key = proc.label.toLowerCase().split(' ')[0]; // First word as key

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(proc);
    } else {
      // Merge impacts if similar procedure already exists
      const existing = merged.find(p => p.label.toLowerCase().startsWith(key));
      if (existing && existing.impact !== proc.impact) {
        existing.impact = `${existing.impact} • ${proc.impact}`;
      }
    }
  }

  return merged.slice(0, 5); // Max 5 procedures
}

/**
 * Merge similar oral bullets
 */
function mergeSimilarBullets(bullets = []) {
  const merged = [];
  const seen = new Set();

  for (const bullet of bullets) {
    const key = bullet.toLowerCase().split(' ')[0]; // First word as key

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(bullet);
    }
  }

  return merged.slice(0, 4); // Max 4 oral bullets
}

/**
 * Ensure movements follow logical progression
 */
function ensureLogicalFlow(movements = []) {
  // Ensure each movement builds on the previous
  return movements.map((movement, index) => {
    let title = movement.title;

    // Standardize movement titles for better flow
    const flowTitles = [
      "Ouverture du passage",
      "Tension croissante",
      "Sens final déployé"
    ];

    if (index < flowTitles.length) {
      title = flowTitles[index];
    }

    return {
      ...movement,
      title
    };
  });
}

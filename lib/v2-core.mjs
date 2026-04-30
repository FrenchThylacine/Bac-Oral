/**
 * Bac-Oral V2 Core Module
 * 
 * Provides modular, testable components for:
 * - Introduction generation
 * - Conclusion generation
 * - Motion/movement detection
 * - Color processing (genre-based categorization)
 * - Output validation
 */

import {
  guessGenre,
  detectProcedures,
  buildMovementsFromText,
  buildOralBullets,
  simplifyPhrase,
} from "./revision-engine.mjs";

// Color mapping for different genres
const GENRE_COLORS = {
  theatre: "#7B2CBF",    // purple
  poesie: "#3A86FF",     // blue
  roman: "#FF006E",      // red/pink
  general: "#666666",    // gray
};

/**
 * Generate introduction text for an entry
 * @param {Object} entry - Entry with sourceText, author, title, work, keyProcedures
 * @param {string} genre - Genre type (theatre, poesie, roman, general)
 * @returns {string} Generated introduction text
 */
export function generateIntro(entry = {}, genre = "general") {
  if (!entry.sourceText || entry.sourceText.length < 10) {
    return "Passage de référence non spécifié - à remplir manuellement.";
  }

  const templates = {
    theatre: `Dans ce passage de ${entry.author || "théâtre"}, ${entry.title || "ce texte"} met en scène une situation où ${entry.keyProcedures?.[0]?.label || "le conflit"}. Le texte déploie plusieurs procédés clés qui structurent l'enjeu dramatique.`,
    poesie: `Ce poème de ${entry.author || "poète"} intitulé "${entry.title || "untitled"}" explore ${entry.keyProcedures?.[0]?.label || "un thème poétique"}. Le texte construit son univers à travers des procédés caractéristiques qui en font un moment clé de la séquence.`,
    roman: `Dans cet extrait de ${entry.work || "roman"}, ${entry.author || "l'auteur"} présente ${entry.title || "une scène"}. Ce passage révèle ${entry.keyProcedures?.[0]?.label || "l'intensité romanesque"} par ses choix narratifs remarquables.`,
    general: `Ce texte, "${entry.title || "passage"}", est un moment charnière qui concentre plusieurs enjeux majeurs. L'analyse suivante en dégage les mouvements structurants et les procédés d'écriture qui en font l'intérêt.`,
  };

  return templates[genre] || templates.general;
}

/**
 * Generate conclusion text for an entry
 * @param {Object} entry - Entry with oralBullets and other metadata
 * @param {string} genre - Genre type
 * @returns {string} Generated conclusion text
 */
export function generateConclusion(entry = {}, genre = "general") {
  if (!entry.oralBullets || entry.oralBullets.length === 0) {
    return "À partir de cette analyse, on peut conclure à l'importance de ce passage pour comprendre l'œuvre et la séquence.";
  }

  const mainPoint = entry.oralBullets[0] || "l'enjeu central";
  const secondPoint = entry.oralBullets[1] || "les enjeux secondaires";

  const templates = {
    theatre: `En conclusion, ce passage illustre comment ${mainPoint}. Au-delà de ${secondPoint}, c'est la dynamique dramatique qui prime : ce texte montre l'art du dramaturge à condenser l'affrontement en quelques répliques décisives.`,
    poesie: `En conclusion, ce poème se définit par ${mainPoint}. Loin de seulement décrire, le texte ${secondPoint}. C'est cette tension entre forme et sens qui en fait un exemplum de la poésie moderne.`,
    roman: `En conclusion, ce passage révèle ${mainPoint}. Ce qui frappe avant tout, c'est ${secondPoint}. Le romancier construit ainsi une intensité narrative qui justifie la place centrale de cet extrait.`,
    general: `En conclusion, ce passage concentre plusieurs enjeux : d'une part ${mainPoint}, d'autre part ${secondPoint}. C'est pourquoi il constitue un moment privilégié pour aborder les questions clés de la séquence.`,
  };

  return templates[genre] || templates.general;
}

/**
 * Detect motions/movements in text
 * Enhances buildMovementsFromText with validation and error handling
 * @param {string} text - Source text to analyze
 * @param {string} genre - Genre type
 * @returns {Array<Object>} Array of movement objects {title, bullets, excerpt}
 */
export function detectMotions(text = "", genre = "general") {
  if (!text || text.trim().length < 10) {
    return [
      { title: "Entrée du passage", bullets: ["contexte initial"], excerpt: "" },
      { title: "Développement", bullets: ["progression thématique"], excerpt: "" },
      { title: "Conclusion du passage", bullets: ["aboutissement"], excerpt: "" },
    ];
  }

  try {
    const movements = buildMovementsFromText(text, genre);
    
    // Validate each movement has required fields
    return movements.map(motion => ({
      title: motion.title || "Mouvement non titré",
      bullets: Array.isArray(motion.bullets) ? motion.bullets : ["point clé"],
      excerpt: motion.excerpt || "",
    }));
  } catch (error) {
    console.error("Error detecting motions:", error);
    return [
      { title: "Mouvement 1", bullets: ["début du passage"], excerpt: "" },
      { title: "Mouvement 2", bullets: ["développement"], excerpt: "" },
      { title: "Mouvement 3", bullets: ["fin du passage"], excerpt: "" },
    ];
  }
}

/**
 * Apply color processing to entries
 * Maps genres to colors and adds color metadata
 * @param {Array<Object>|Object} entries - Single entry or array of entries
 * @returns {Array<Object>|Object} Entry/entries with added color metadata
 */
export function applyColorProcessing(entries) {
  const isArray = Array.isArray(entries);
  const items = isArray ? entries : [entries];

  const processed = items.map(entry => {
    const genre = entry.genre || guessGenre(entry.sequence || {});
    const color = GENRE_COLORS[genre] || GENRE_COLORS.general;

    return {
      ...entry,
      genre,
      color,
      colorLabel: {
        theatre: "Théâtre",
        poesie: "Poésie",
        roman: "Roman",
        general: "Autres",
      }[genre] || "Autres",
    };
  });

  return isArray ? processed : processed[0];
}

/**
 * Validate V2 output entry structure
 * Checks for required fields and valid data types
 * @param {Object} entry - Entry to validate
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export function validateV2Output(entry = {}) {
  const errors = [];

  // Check required fields
  if (!entry.id) errors.push("Missing field: id");
  if (!entry.title) errors.push("Missing field: title");
  if (!entry.sourceText) errors.push("Missing field: sourceText");

  // Check optional but important fields
  if (!entry.genre) {
    console.warn("Missing field: genre (will default to 'general')");
  }

  // Validate array fields
  if (!Array.isArray(entry.movements)) {
    errors.push("movements must be an array");
  } else if (entry.movements.length === 0) {
    errors.push("movements array is empty");
  } else {
    entry.movements.forEach((motion, idx) => {
      if (!motion.title) errors.push(`Movement ${idx}: missing title`);
      if (!Array.isArray(motion.bullets)) errors.push(`Movement ${idx}: bullets must be array`);
    });
  }

  if (entry.keyProcedures && !Array.isArray(entry.keyProcedures)) {
    errors.push("keyProcedures must be an array");
  }

  if (entry.oralBullets && !Array.isArray(entry.oralBullets)) {
    errors.push("oralBullets must be an array");
  }

  // Check introduction and conclusion
  if (entry.introduction && typeof entry.introduction !== "string") {
    errors.push("introduction must be a string");
  }
  if (entry.conclusion && typeof entry.conclusion !== "string") {
    errors.push("conclusion must be a string");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a complete V2 entry from raw data
 * Combines detection, color processing, and validation
 * @param {Object} data - Raw entry data {id, title, sourceText, author, work, genre, sequence}
 * @returns {Object} Complete V2 entry with all derived fields
 */
export function createV2Entry(data = {}) {
  const genre = data.genre || guessGenre(data.sequence || {});

  // Detect procedures from source text
  const keyProcedures = detectProcedures(data.sourceText || "", genre);

  // Generate movements
  const movements = detectMotions(data.sourceText || "", genre);

  // Generate oral bullets
  const oralBullets = buildOralBullets(data.sourceText || "", genre, keyProcedures);

  // Create entry
  const entry = {
    id: data.id || `entry-${Date.now()}`,
    title: data.title || "Untitled",
    author: data.author || "Unknown",
    work: data.work || data.title || "Unknown Work",
    genre,
    sourceText: data.sourceText || "",
    movements,
    keyProcedures,
    oralBullets,
    introduction: generateIntro({ ...data, keyProcedures }, genre),
    conclusion: generateConclusion({ oralBullets }, genre),
  };

  // Apply color processing
  const colored = applyColorProcessing(entry);

  // Validate
  const validation = validateV2Output(colored);
  if (!validation.valid) {
    console.warn(`Validation warnings for entry ${colored.id}:`, validation.errors);
  }

  return {
    ...colored,
    _validation: validation,
  };
}

/**
 * Get color for a genre
 * @param {string} genre - Genre type
 * @returns {string} Hex color code
 */
export function getGenreColor(genre = "general") {
  return GENRE_COLORS[genre] || GENRE_COLORS.general;
}

/**
 * Get all supported genres
 * @returns {string[]} List of genres
 */
export function getSupportedGenres() {
  return Object.keys(GENRE_COLORS);
}

export default {
  generateIntro,
  generateConclusion,
  detectMotions,
  applyColorProcessing,
  validateV2Output,
  createV2Entry,
  getGenreColor,
  getSupportedGenres,
  GENRE_COLORS,
};

/**
 * Color Processing Module for Bac-Oral V2
 * 
 * Provides color mapping, CSS generation, and visual categorization
 * for different genres and text elements
 */

/**
 * Genre color palette
 */
const GENRE_PALETTE = {
  theatre: {
    primary: "#7B2CBF",    // Purple
    light: "#E0AAFF",      // Light purple
    dark: "#5A189A",       // Dark purple
    accent: "#C77DFF",     // Medium purple
  },
  poesie: {
    primary: "#3A86FF",    // Blue
    light: "#B4D7FF",      // Light blue
    dark: "#1B4DBE",       // Dark blue
    accent: "#5DADE2",     // Medium blue
  },
  roman: {
    primary: "#FF006E",    // Red/Pink
    light: "#FFB3D9",      // Light pink
    dark: "#C2185B",       // Dark red
    accent: "#FF4081",     // Medium pink
  },
  general: {
    primary: "#666666",    // Gray
    light: "#CCCCCC",      // Light gray
    dark: "#333333",       // Dark gray
    accent: "#999999",     // Medium gray
  },
};

/**
 * Element-specific color mappings
 */
const ELEMENT_COLORS = {
  movement: {
    bg: "rgba(255,255,255,0.05)",
    border: "currentColor",
    text: "inherit",
  },
  procedure: {
    bg: "rgba(255,255,255,0.1)",
    border: "currentColor",
    text: "inherit",
  },
  bullet: {
    bg: "rgba(255,255,255,0.03)",
    text: "inherit",
  },
  header: {
    bg: "rgba(0,0,0,0.2)",
    text: "white",
  },
};

/**
 * Get complete color palette for a genre
 * @param {string} genre - Genre type (theatre, poesie, roman, general)
 * @returns {Object} Color palette with primary, light, dark, accent
 */
export function getGenrePalette(genre = "general") {
  return GENRE_PALETTE[genre] || GENRE_PALETTE.general;
}

/**
 * Get CSS color value for genre
 * @param {string} genre - Genre type
 * @param {string} variant - 'primary' (default), 'light', 'dark', 'accent'
 * @returns {string} Hex color code
 */
export function getGenreColor(genre = "general", variant = "primary") {
  const palette = GENRE_PALETTE[genre] || GENRE_PALETTE.general;
  return palette[variant] || palette.primary;
}

/**
 * Create CSS class name for a genre
 * @param {string} genre - Genre type
 * @returns {string} CSS class name
 */
export function getGenreClass(genre = "general") {
  const classMap = {
    theatre: "genre-theatre",
    poesie: "genre-poetry",
    roman: "genre-novel",
    general: "genre-general",
  };
  return classMap[genre] || "genre-general";
}

/**
 * Create inline CSS styles for element with color
 * @param {string} genre - Genre type
 * @param {string} elementType - Type of element (movement, procedure, bullet, header)
 * @returns {Object} Style object for inline styles
 */
export function getElementStyles(genre = "general", elementType = "movement") {
  const palette = GENRE_PALETTE[genre] || GENRE_PALETTE.general;
  const elementConfig = ELEMENT_COLORS[elementType] || ELEMENT_COLORS.movement;

  // Replace 'currentColor' with actual genre color
  const styles = {};
  if (elementConfig.bg) {
    styles.backgroundColor = elementConfig.bg;
    if (elementConfig.bg.includes("rgba")) {
      // Replace with genre-specific opacity color
      styles.backgroundColor = elementConfig.bg.replace("currentColor", palette.primary);
    }
  }
  if (elementConfig.border) {
    styles.borderColor = elementConfig.border === "currentColor" ? palette.primary : elementConfig.border;
  }
  if (elementConfig.text) {
    styles.color = elementConfig.text === "inherit" ? "inherit" : elementConfig.text;
  }

  return styles;
}

/**
 * Generate CSS for a genre-themed movement
 * @param {string} genre - Genre type
 * @param {string} elementId - Element ID
 * @returns {string} CSS string
 */
export function generateMovementCSS(genre = "general", elementId = "") {
  const palette = getGenrePalette(genre);
  const cssClass = getGenreClass(genre);

  const css = `
.${cssClass} {
  --genre-color: ${palette.primary};
  --genre-light: ${palette.light};
  --genre-dark: ${palette.dark};
  --genre-accent: ${palette.accent};
}

.${cssClass} .movement {
  border-left: 4px solid var(--genre-color);
  background: linear-gradient(90deg, rgba(0,0,0,0.02), transparent);
}

.${cssClass} .movement-title {
  color: var(--genre-color);
  font-weight: 600;
  border-bottom: 1px solid var(--genre-light);
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.${cssClass} .procedure-tag {
  background: var(--genre-light);
  color: var(--genre-dark);
  border: 1px solid var(--genre-color);
  padding: 4px 12px;
  border-radius: 4px;
  display: inline-block;
  margin: 4px 4px 4px 0;
  font-size: 0.85em;
}

.${cssClass} .intro, .${cssClass} .conclusion {
  border-left: 3px solid var(--genre-color);
  background: rgba(0,0,0,0.02);
  padding: 12px;
  margin: 12px 0;
  border-radius: 2px;
}

.${cssClass} .section-header {
  background: var(--genre-color);
  color: white;
  padding: 8px 12px;
  margin: 16px 0 8px 0;
  border-radius: 2px;
  font-weight: 600;
}
`;

  return css.trim();
}

/**
 * Create a color swatch object for display
 * @param {string} genre - Genre type
 * @returns {Object} Swatch object with colors and label
 */
export function getGenreSwatch(genre = "general") {
  const genreLabels = {
    theatre: "Théâtre",
    poesie: "Poésie",
    roman: "Roman",
    general: "Autres",
  };

  const palette = GENRE_PALETTE[genre] || GENRE_PALETTE.general;

  return {
    genre,
    label: genreLabels[genre] || "Autres",
    primary: palette.primary,
    light: palette.light,
    dark: palette.dark,
    accent: palette.accent,
  };
}

/**
 * Apply color metadata to entry
 * @param {Object} entry - Entry object
 * @param {string} genre - Genre type (optional, will use entry.genre if not provided)
 * @returns {Object} Entry with added color metadata
 */
export function applyColorMetadata(entry = {}, genre = null) {
  const g = genre || entry.genre || "general";
  const palette = GENRE_PALETTE[g] || GENRE_PALETTE.general;

  return {
    ...entry,
    genre: g,
    color: palette.primary,
    colors: palette,
    cssClass: getGenreClass(g),
    swatch: getGenreSwatch(g),
  };
}

/**
 * Apply colors to all movements in an entry
 * @param {Object} entry - Entry with movements array
 * @returns {Object} Entry with colored movements
 */
export function colorizeMovements(entry = {}) {
  const genre = entry.genre || "general";

  if (!entry.movements || !Array.isArray(entry.movements)) {
    return entry;
  }

  const coloredMovements = entry.movements.map((motion, index) => ({
    ...motion,
    color: getGenreColor(genre, index % 2 === 0 ? "primary" : "accent"),
    cssClass: `motion-${index}`,
  }));

  return {
    ...entry,
    movements: coloredMovements,
  };
}

/**
 * Apply colors to procedures in an entry
 * @param {Object} entry - Entry with keyProcedures array
 * @returns {Object} Entry with colored procedures
 */
export function colorizeProcedures(entry = {}) {
  const genre = entry.genre || "general";

  if (!entry.keyProcedures || !Array.isArray(entry.keyProcedures)) {
    return entry;
  }

  const coloredProcedures = entry.keyProcedures.map((proc, index) => {
    const variants = ["primary", "accent", "dark"];
    const variant = variants[index % variants.length];
    return {
      ...proc,
      color: getGenreColor(genre, variant),
      cssClass: `procedure-${index}`,
    };
  });

  return {
    ...entry,
    keyProcedures: coloredProcedures,
  };
}

/**
 * Create complete color-enhanced entry
 * @param {Object} entry - Base entry
 * @param {string} genre - Genre type
 * @returns {Object} Fully color-enhanced entry
 */
export function createColorizedEntry(entry = {}, genre = null) {
  let enhanced = applyColorMetadata(entry, genre);
  enhanced = colorizeMovements(enhanced);
  enhanced = colorizeProcedures(enhanced);

  // Add generated CSS
  enhanced.css = generateMovementCSS(enhanced.genre, enhanced.id);

  return enhanced;
}

/**
 * Get all available genre colors as a lookup
 * @returns {Object} Lookup map of genre -> primary color
 */
export function getAllGenreColors() {
  const colors = {};
  for (const [genre, palette] of Object.entries(GENRE_PALETTE)) {
    colors[genre] = palette.primary;
  }
  return colors;
}

export default {
  GENRE_PALETTE,
  ELEMENT_COLORS,
  getGenrePalette,
  getGenreColor,
  getGenreClass,
  getElementStyles,
  generateMovementCSS,
  getGenreSwatch,
  applyColorMetadata,
  colorizeMovements,
  colorizeProcedures,
  createColorizedEntry,
  getAllGenreColors,
};

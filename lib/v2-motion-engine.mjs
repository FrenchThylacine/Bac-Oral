/**
 * Enhanced Motion Detection Engine for Bac-Oral V2
 * 
 * Advanced text analysis for detecting:
 * - Dramatic shifts and thematic movements
 * - Emotional progression
 * - Narrative structure
 * - Key turning points
 */

/**
 * Analyze text for emotional/dramatic intensity
 * @param {string} text - Text chunk to analyze
 * @param {string} genre - Genre type for context
 * @returns {number} Intensity score 0-10
 */
function analyzeIntensity(text = "", genre = "general") {
  let score = 0;
  const normalized = text.toLowerCase();

  // Punctuation intensity
  const questionMarks = (text.match(/\?/g) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  score += Math.min(questionMarks * 1.5, 3);
  score += Math.min(exclamations * 2, 3);

  // Emotional vocabulary
  const emotionalWords = /\b(amour|cœur|passion|souffrance|mort|bonheur|désir|douleur|joie|peur|colère|honte)\b/gi;
  score += Math.min((text.match(emotionalWords) || []).length, 2);

  // Action words
  const actionWords = /\b(fuit|court|crie|meurt|tue|brise|détruit|construit|échappe|revient)\b/gi;
  score += Math.min((text.match(actionWords) || []).length, 1.5);

  // Drama-specific markers
  if (genre === "theatre") {
    if (/\b(non|jamais|toujours|rien)\b/gi.test(text)) score += 1;
    if (/["«»]/.test(text)) score += 0.5;
  }

  return Math.min(score, 10);
}

/**
 * Detect major thematic shifts in text
 * @param {Array<string>} chunks - Text chunks to analyze
 * @returns {Array<number>} Indices of major transitions
 */
function detectTransitions(chunks = []) {
  if (chunks.length < 2) return [];

  const transitions = [];
  const sentiments = chunks.map(chunk => analyzeIntensity(chunk));

  for (let i = 1; i < sentiments.length; i++) {
    const change = Math.abs(sentiments[i] - sentiments[i - 1]);
    if (change > 3) {
      transitions.push(i);
    }
  }

  return transitions;
}

/**
 * Categorize text chunk by dominant theme
 * @param {string} text - Text chunk
 * @param {string} genre - Genre type
 * @returns {string} Theme category
 */
function categorizeTheme(text = "", genre = "general") {
  const normalized = text.toLowerCase();

  // Universal themes
  if (/\b(mort|mort|fin|termine|adieu|dernier)\b/gi.test(text)) return "Dénouement";
  if (/\b(commence|début|ouverture|premier|naissance)\b/gi.test(text)) return "Exposition";
  if (/\b(question|doute|cherche|ignore|sait)\b/gi.test(text)) return "Interrogation";

  // Emotional themes
  if (/\b(amour|passion|cœur|désir|tendresse)\b/gi.test(text)) return "Passion";
  if (/\b(colère|rage|fureur|haine|vengeance)\b/gi.test(text)) return "Conflit";
  if (/\b(peur|crainte|angoisse|tremble|tremblement)\b/gi.test(text)) return "Angoisse";
  if (/\b(joie|bonheur|rire|sourire|lumière)\b/gi.test(text)) return "Épanouissement";

  // Genre-specific themes
  if (genre === "theatre") {
    if (/\b(dit|répond|demand|parle|crie)\b/gi.test(text)) return "Dialogue";
    if (/\b(autre|contraire|oppose|mais|pourtant)\b/gi.test(text)) return "Opposition";
  }

  if (genre === "poesie") {
    if (/\b(route|voyage|horizon|chemin|errance)\b/gi.test(text)) return "Errance";
    if (/\b(beauté|merveille|splendeur|miracle|grâce)\b/gi.test(text)) return "Merveille";
    if (/\b(je|moi|liberté|rêve|rêve)\b/gi.test(text)) return "Affirmation du moi";
  }

  if (genre === "roman") {
    if (/\b(rencontre|aperçoit|voit|remarque|découvre)\b/gi.test(text)) return "Découverte";
    if (/\b(destin|sort|fatalité|chance|malheur)\b/gi.test(text)) return "Fatalité";
    if (/\b(portrait|apparence|regard|silence)\b/gi.test(text)) return "Caractérisation";
  }

  return "Développement";
}

/**
 * Enhanced motion detection combining intensity and theme analysis
 * @param {Array<string>} chunks - Text chunks
 * @param {string} genre - Genre type
 * @returns {Array<Object>} Enhanced motion objects
 */
export function analyzeMotionsAdvanced(chunks = [], genre = "general") {
  if (chunks.length === 0) return [];

  const transitions = detectTransitions(chunks);
  const motions = [];

  chunks.forEach((chunk, index) => {
    const intensity = analyzeIntensity(chunk, genre);
    const theme = categorizeTheme(chunk, genre);
    const isTransition = transitions.includes(index);

    motions.push({
      index,
      chunk,
      intensity,
      theme,
      isTransition,
    });
  });

  return motions;
}

/**
 * Generate motion titles based on analysis
 * @param {Array<Object>} analysisResults - Motion analysis results
 * @param {string} genre - Genre type
 * @returns {Array<string>} Motion titles
 */
export function generateMotionTitles(analysisResults = [], genre = "general") {
  if (analysisResults.length === 0) return [];

  const titles = [];

  analysisResults.forEach((result, index) => {
    const { theme, isTransition, intensity } = result;
    let title = theme;

    if (isTransition && index > 0) {
      title = `Bascule vers ${theme}`;
    }

    if (intensity > 7) {
      title += ` (paroxysme)`;
    }

    titles.push(title);
  });

  return titles;
}

/**
 * Create comprehensive motion report
 * @param {string} text - Full text
 * @param {Array<string>} chunks - Text chunks
 * @param {string} genre - Genre type
 * @returns {Object} Detailed motion report
 */
export function createMotionReport(text = "", chunks = [], genre = "general") {
  const analysis = analyzeMotionsAdvanced(chunks, genre);
  const titles = generateMotionTitles(analysis, genre);
  const avgIntensity = analysis.reduce((sum, m) => sum + m.intensity, 0) / Math.max(analysis.length, 1);
  const transitionCount = analysis.filter(m => m.isTransition).length;
  const themes = [...new Set(analysis.map(m => m.theme))];

  return {
    analysisResults: analysis,
    titles,
    statistics: {
      chunkCount: chunks.length,
      transitionCount,
      averageIntensity: Math.round(avgIntensity * 10) / 10,
      uniqueThemes: themes,
    },
  };
}

export default {
  analyzeIntensity,
  detectTransitions,
  categorizeTheme,
  analyzeMotionsAdvanced,
  generateMotionTitles,
  createMotionReport,
};

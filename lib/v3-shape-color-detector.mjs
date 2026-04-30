/**
 * V3 Shape & Color Detector - Identify procedures by visual markers
 * Maps colors/shapes to procedure types and generates confidence scores
 */

const COLOR_PALETTES = {
  purple: { hex: '#7B2CBF', rgb: [123, 44, 191], names: ['dialogue', 'speech', 'monologue'] },
  blue: { hex: '#3A86FF', rgb: [58, 134, 255], names: ['narrative', 'description', 'exposition'] },
  red: { hex: '#FF006E', rgb: [255, 0, 110], names: ['action', 'conflict', 'climax'] },
  yellow: { hex: '#FFB703', rgb: [255, 183, 3], names: ['highlight', 'key', 'important'] },
  green: { hex: '#06A77D', rgb: [6, 168, 125], names: ['analysis', 'conclusion', 'reflection'] },
  orange: { hex: '#FB5607', rgb: [251, 86, 7], names: ['transition', 'change', 'shift'] },
  gray: { hex: '#666666', rgb: [102, 102, 102], names: ['neutral', 'general', 'other'] },
};

const SHAPE_MARKERS = {
  highlight: { symbols: ['█', '▌', '◉', '✓'], meaning: 'highlighted', confidence: 0.9 },
  underline: { symbols: ['_', '─', '═', '—'], meaning: 'underlined', confidence: 0.8 },
  bracket: { symbols: ['[', ']', '{', '}', '(', ')'], meaning: 'bracketed', confidence: 0.7 },
  box: { symbols: ['■', '□', '◼', '◻'], meaning: 'boxed', confidence: 0.8 },
  circle: { symbols: ['●', '○', '◐', '◑'], meaning: 'circled', confidence: 0.7 },
  star: { symbols: ['★', '✦', '✧', '⭐'], meaning: 'starred', confidence: 0.85 },
};

export async function detectColorsAndShapes(imagePath) {
  // In production, this would analyze actual image pixels
  // For now, simulate detection from context
  
  const procedures = [];
  
  // Simulate detecting different colored regions
  for (const [colorName, colorData] of Object.entries(COLOR_PALETTES)) {
    if (Math.random() > 0.3) {
      procedures.push({
        color: colorData.hex,
        colorName,
        detectedTypes: colorData.names,
        confidence: 0.6 + Math.random() * 0.3,
        region: `simulated_region_${colorName}`,
        markers: detectMarkers(),
      });
    }
  }
  
  return {
    filePath: imagePath,
    detectedAt: new Date().toISOString(),
    procedures,
    overallConfidence: calculateOverallConfidence(procedures),
  };
}

export function mapColorToProcedureType(color) {
  const colorHex = normalizeColor(color);
  
  for (const [name, palette] of Object.entries(COLOR_PALETTES)) {
    if (palette.hex.toLowerCase() === colorHex.toLowerCase()) {
      return {
        type: palette.names[0],
        alternativeTypes: palette.names.slice(1),
        color: palette.hex,
        confidence: 0.85,
      };
    }
  }
  
  return {
    type: 'general',
    alternativeTypes: [],
    color: COLOR_PALETTES.gray.hex,
    confidence: 0.5,
  };
}

export function detectMarkers() {
  const foundMarkers = [];
  
  for (const [markerType, markerData] of Object.entries(SHAPE_MARKERS)) {
    if (Math.random() > 0.5) {
      foundMarkers.push({
        type: markerType,
        meaning: markerData.meaning,
        confidence: markerData.confidence,
        symbol: markerData.symbols[Math.floor(Math.random() * markerData.symbols.length)],
      });
    }
  }
  
  return foundMarkers;
}

export function detectColorsFromText(text) {
  const colors = {};
  
  // Detect color keywords in text
  const colorKeywords = {
    'souligné': 'yellow',
    'highlighted': 'yellow',
    'encadré': 'red',
    'boxed': 'red',
    'important': 'red',
    'clé': 'orange',
    'key': 'orange',
    'analyse': 'green',
    'analysis': 'green',
    'dialogue': 'purple',
    'speech': 'purple',
    'narration': 'blue',
    'narrative': 'blue',
  };
  
  for (const [keyword, color] of Object.entries(colorKeywords)) {
    if (text.toLowerCase().includes(keyword)) {
      colors[color] = (colors[color] || 0) + 1;
    }
  }
  
  return colors;
}

export function generateColorConfidenceScore(detectionData) {
  if (!detectionData || !detectionData.procedures) {
    return 0.3;
  }
  
  if (detectionData.procedures.length === 0) {
    return 0.2;
  }
  
  const avgConfidence = detectionData.procedures.reduce((sum, proc) => 
    sum + proc.confidence, 0) / detectionData.procedures.length;
  
  return Math.min(1, avgConfidence + 0.1);
}

export function normalizeColor(color) {
  if (!color) return COLOR_PALETTES.gray.hex;
  
  if (color.startsWith('#')) {
    return color;
  }
  
  const colorName = color.toLowerCase().trim();
  return COLOR_PALETTES[colorName]?.hex || COLOR_PALETTES.gray.hex;
}

export function getColorAnalysis(color) {
  const normalized = normalizeColor(color);
  
  for (const [name, palette] of Object.entries(COLOR_PALETTES)) {
    if (palette.hex.toLowerCase() === normalized.toLowerCase()) {
      return {
        name,
        hex: palette.hex,
        rgb: palette.rgb,
        possibleMeanings: palette.names,
        commonUsage: getMostLikelyMeaning(palette.names),
      };
    }
  }
  
  return {
    name: 'unknown',
    hex: normalized,
    rgb: [],
    possibleMeanings: [],
    commonUsage: 'general',
  };
}

export function getMostLikelyMeaning(meanings) {
  if (!meanings || meanings.length === 0) return 'general';
  return meanings[0];
}

export function calculateOverallConfidence(procedures) {
  if (procedures.length === 0) return 0;
  
  const totalConfidence = procedures.reduce((sum, proc) => 
    sum + proc.confidence, 0);
  
  return Math.min(1, totalConfidence / procedures.length);
}

export function buildColorTypeMap() {
  const map = {};
  
  for (const [colorName, colorData] of Object.entries(COLOR_PALETTES)) {
    map[colorData.hex] = {
      colorName,
      primaryType: colorData.names[0],
      allTypes: colorData.names,
    };
  }
  
  return map;
}

export function isHighConfidenceDetection(detection) {
  return detection && 
         detection.overallConfidence > 0.7 && 
         detection.procedures.length > 0;
}

export function flagLowConfidenceProcedures(procedures) {
  return procedures.map(proc => ({
    ...proc,
    flagged: proc.confidence < 0.6,
    reason: proc.confidence < 0.6 ? 'Low detection confidence' : null,
  }));
}

export default {
  detectColorsAndShapes,
  mapColorToProcedureType,
  detectMarkers,
  detectColorsFromText,
  generateColorConfidenceScore,
  normalizeColor,
  getColorAnalysis,
  getMostLikelyMeaning,
  calculateOverallConfidence,
  buildColorTypeMap,
  isHighConfidenceDetection,
  flagLowConfidenceProcedures,
  COLOR_PALETTES,
  SHAPE_MARKERS,
};

/**
 * V3 Analysis Generator - Auto-generate bullet-point analyses
 * Completes missing analyses, deduplicates common ones
 */

export async function generateAnalyses(procedure, context = {}) {
  const { type, name, color } = procedure;
  
  const templates = {
    dialogue: [
      'Characters express conflicting viewpoints',
      'Dialogue reveals underlying tensions',
      'Verbal exchange advances the plot',
      'Character motivations become clear',
      'Communication barriers are evident',
    ],
    narrative: [
      'Story progression is established',
      'Temporal or spatial context provided',
      'Background information clarifies events',
      'Narrative perspective shapes interpretation',
      'Events are positioned within larger arc',
    ],
    description: [
      'Sensory details create atmosphere',
      'Descriptive language suggests tone',
      'Setting influences character behavior',
      'Physical details carry symbolic weight',
      'Description builds emotional resonance',
    ],
    action: [
      'Physical actions reveal character',
      'Events create dramatic turning points',
      'Consequences unfold from decisions',
      'Conflict intensifies through action',
      'Movement drives narrative forward',
    ],
  };
  
  const baseAnalyses = templates[type] || templates.dialogue;
  const customized = baseAnalyses.slice(0, 3 + Math.floor(Math.random() * 3));
  
  return customized;
}

export async function deduplicateAnalyses(procedures) {
  const analysisMap = new Map();
  
  for (const proc of procedures) {
    for (const analysis of proc.analyses || []) {
      const key = analysis.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (!analysisMap.has(key)) {
        analysisMap.set(key, {
          text: analysis,
          procedures: [],
          count: 0,
        });
      }
      
      const entry = analysisMap.get(key);
      entry.procedures.push(proc.id);
      entry.count++;
    }
  }
  
  return Array.from(analysisMap.values())
    .filter(e => e.count > 1)
    .sort((a, b) => b.count - a.count);
}

export async function expandProcedureAnalysis(procedure, fullContext = {}) {
  const existing = procedure.analyses || [];
  
  if (existing.length >= 5) {
    return existing.slice(0, 5);
  }
  
  const generated = await generateAnalyses(procedure, fullContext);
  const needed = 5 - existing.length;
  
  return [
    ...existing,
    ...generated.slice(0, needed),
  ].slice(0, 5);
}

export async function generateMissingAnalyses(al) {
  const updated = { ...al };
  
  for (const movement of updated.movements || []) {
    for (let i = 0; i < (movement.procedures || []).length; i++) {
      const proc = movement.procedures[i];
      
      if (!proc.analyses || proc.analyses.length === 0) {
        proc.analyses = await generateAnalyses(proc, { movement: movement.name });
        proc.flagged = true;
        updated.metadata.flaggedCount++;
      }
    }
  }
  
  return updated;
}

export async function compactAnalyses(al) {
  const compacted = { ...al };
  
  for (const movement of compacted.movements || []) {
    for (const proc of movement.procedures || []) {
      if (proc.analyses && proc.analyses.length > 0) {
        proc.analyses = proc.analyses.slice(0, 5).map(a => 
          a.length > 100 ? a.substring(0, 97) + '...' : a
        );
      }
    }
  }
  
  return compacted;
}

export function getAnalysisConfidence(analysis, context) {
  if (!analysis) return 0;
  
  let confidence = 0.5;
  
  if (analysis.length > 30) confidence += 0.2;
  if (analysis.length > 60) confidence += 0.15;
  
  return Math.min(1, confidence);
}

export default {
  generateAnalyses,
  deduplicateAnalyses,
  expandProcedureAnalysis,
  generateMissingAnalyses,
  compactAnalyses,
  getAnalysisConfidence,
};

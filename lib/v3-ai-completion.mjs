/**
 * V3 AI Completion - Auto-complete missing procedures and analyses
 * Hybrid workflow: AI suggests, user approves
 */

export async function suggestMissingProcedures(movement, context = {}) {
  const suggestions = [];
  
  const procedureTemplates = {
    dialogue: ['Opening exchange', 'Confrontation', 'Resolution attempt'],
    narrative: ['Background exposition', 'Plot progression', 'Revelation'],
    description: ['Setting details', 'Character appearance', 'Atmosphere'],
    action: ['Physical action', 'Gesture', 'Blocking'],
  };
  
  const existing = (movement.procedures || []).map(p => p.name.toLowerCase());
  
  for (const [type, names] of Object.entries(procedureTemplates)) {
    for (const name of names) {
      if (!existing.includes(name.toLowerCase())) {
        suggestions.push({
          name,
          type,
          color: getColorForType(type),
          confidence: 0.6 + Math.random() * 0.2,
          suggestedBy: 'ai',
          requiresApproval: true,
        });
      }
    }
  }
  
  return suggestions.slice(0, 3);
}

export async function completeMissingProcedures(al) {
  const completed = { ...al };
  const flagged = [];
  
  for (let i = 0; i < (completed.movements || []).length; i++) {
    const movement = completed.movements[i];
    
    if (!movement.procedures || movement.procedures.length === 0) {
      const suggestions = await suggestMissingProcedures(movement);
      
      for (const suggestion of suggestions) {
        movement.procedures.push({
          ...suggestion,
          analyses: await generateDefaultAnalyses(suggestion),
          flagged: true,
        });
        
        flagged.push({
          type: 'procedure',
          itemId: suggestion.name,
          movementId: movement.id,
          reason: 'AI-suggested procedure - requires approval',
        });
      }
    }
  }
  
  completed.metadata.flaggedCount += flagged.length;
  
  return { al: completed, flaggedItems: flagged };
}

export async function generateDefaultAnalyses(procedure) {
  const typeMap = {
    dialogue: ['Characters exchange views', 'Conflict emerges'],
    narrative: ['Story context provided', 'Plot advances'],
    description: ['Atmosphere established', 'Details clarified'],
    action: ['Movement occurs', 'Change happens'],
  };
  
  return typeMap[procedure.type] || ['Key moment identified'];
}

function getColorForType(type) {
  const colorMap = {
    dialogue: '#7B2CBF',
    narrative: '#3A86FF',
    description: '#FF006E',
    action: '#FFB703',
  };
  
  return colorMap[type] || '#666666';
}

export async function flagForReview(al, flaggedItems) {
  const updated = { ...al };
  updated.metadata.flaggedCount = flaggedItems.length;
  
  return {
    alId: updated.id,
    title: updated.title,
    flaggedItems: flaggedItems.map(f => ({
      type: f.type,
      itemId: f.itemId,
      movementId: f.movementId,
      reason: f.reason,
    })),
  };
}

export async function approveSuggestions(al, approvals) {
  const updated = { ...al };
  
  for (const approval of approvals) {
    if (approval.action === 'reject') {
      for (const movement of updated.movements || []) {
        movement.procedures = (movement.procedures || [])
          .filter(p => p.name !== approval.itemId);
      }
    }
  }
  
  updated.metadata.flaggedCount -= approvals.length;
  updated.metadata.completionPercent = Math.min(100, 
    updated.metadata.completionPercent + (approvals.length * 5));
  
  return updated;
}

export function calculateCompletionScore(al) {
  let score = 50;
  
  if (al.intro && al.intro.length > 50) score += 10;
  if (al.conclusion && al.conclusion.length > 50) score += 10;
  
  const procedures = al.movements?.reduce((sum, m) => 
    sum + (m.procedures?.length || 0), 0) || 0;
  
  if (procedures > 0) score += 10;
  if (procedures > 3) score += 10;
  
  const analyses = al.movements?.reduce((sum, m) =>
    sum + (m.procedures || []).reduce((psum, p) =>
      psum + (p.analyses?.length || 0), 0), 0) || 0;
  
  if (analyses > 0) score += 10;
  if (analyses > 5) score += 10;
  
  return Math.min(100, score);
}

export default {
  suggestMissingProcedures,
  completeMissingProcedures,
  generateDefaultAnalyses,
  flagForReview,
  approveSuggestions,
  calculateCompletionScore,
};

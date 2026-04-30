/**
 * V3 Data Validator - Validation, confidence scoring, flagging for review
 */

export function validateAL(al) {
  const errors = [];
  const warnings = [];
  
  if (!al.id) errors.push('Missing: AL ID');
  if (!al.title || al.title.length < 2) errors.push('Invalid: Title must be at least 2 characters');
  if (!al.intro) warnings.push('Missing: Introduction');
  if (!al.conclusion) warnings.push('Missing: Conclusion');
  
  if (!al.movements || al.movements.length === 0) {
    errors.push('Invalid: Must have at least one movement');
  } else {
    for (let i = 0; i < al.movements.length; i++) {
      const mov = al.movements[i];
      if (!mov.name) errors.push(`Movement ${i}: Missing name`);
      if (!mov.procedures || mov.procedures.length === 0) {
        warnings.push(`Movement ${i}: Has no procedures`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function calculateConfidenceScore(al) {
  let score = 0;
  let maxScore = 0;
  
  // Title (10 points)
  if (al.title && al.title.length > 3) score += 10;
  maxScore += 10;
  
  // Intro/Conclusion (20 points)
  if (al.intro && al.intro.length > 50) score += 10;
  if (al.conclusion && al.conclusion.length > 50) score += 10;
  maxScore += 20;
  
  // Movements (30 points)
  const movementCount = al.movements?.length || 0;
  if (movementCount > 0) score += Math.min(15, movementCount * 3);
  maxScore += 15;
  
  // Procedures (20 points)
  const procedureCount = al.movements?.reduce((sum, m) => 
    sum + (m.procedures?.length || 0), 0) || 0;
  if (procedureCount > 0) score += Math.min(20, procedureCount * 2);
  maxScore += 20;
  
  // Analyses (20 points)
  const analysisCount = al.movements?.reduce((sum, m) =>
    sum + (m.procedures || []).reduce((psum, p) =>
      psum + (p.analyses?.length || 0), 0), 0) || 0;
  if (analysisCount > 0) score += Math.min(20, analysisCount * 1.5);
  maxScore += 20;
  
  // Color detection (5 points bonus)
  const coloredProcedures = al.movements?.reduce((sum, m) =>
    sum + ((m.procedures || []).filter(p => p.color && p.color !== '#666666').length), 0) || 0;
  if (coloredProcedures > 0) score += Math.min(5, coloredProcedures);
  maxScore += 5;
  
  return {
    score: score,
    maxScore: maxScore + 5,
    percentage: Math.round((score / (maxScore + 5)) * 100),
    breakdown: {
      title: al.title ? 10 : 0,
      intro: (al.intro?.length || 0) > 50 ? 10 : 0,
      conclusion: (al.conclusion?.length || 0) > 50 ? 10 : 0,
      movements: Math.min(15, movementCount * 3),
      procedures: Math.min(20, procedureCount * 2),
      analyses: Math.min(20, analysisCount * 1.5),
      colors: Math.min(5, coloredProcedures),
    },
  };
}

export function identifyFlaggedItems(al) {
  const flagged = [];
  
  if (!al.intro || al.intro.length < 30) {
    flagged.push({
      type: 'intro',
      itemId: 'intro',
      reason: 'Introduction is missing or too short',
      severity: 'high',
    });
  }
  
  if (!al.conclusion || al.conclusion.length < 30) {
    flagged.push({
      type: 'conclusion',
      itemId: 'conclusion',
      reason: 'Conclusion is missing or too short',
      severity: 'high',
    });
  }
  
  for (const movement of al.movements || []) {
    if (!movement.procedures || movement.procedures.length === 0) {
      flagged.push({
        type: 'movement',
        itemId: movement.id,
        reason: `Movement "${movement.name}" has no procedures`,
        severity: 'medium',
      });
    }
    
    for (const proc of movement.procedures || []) {
      if (!proc.analyses || proc.analyses.length === 0) {
        flagged.push({
          type: 'procedure',
          itemId: proc.id,
          reason: `Procedure "${proc.name}" has no analyses`,
          severity: 'medium',
        });
      }
      
      if (!proc.color || proc.color === '#666666') {
        flagged.push({
          type: 'procedure',
          itemId: proc.id,
          reason: `Procedure "${proc.name}" has no color detected`,
          severity: 'low',
        });
      }
      
      if ((proc.confidence || 0) < 0.6) {
        flagged.push({
          type: 'procedure',
          itemId: proc.id,
          reason: `Procedure "${proc.name}" has low confidence (${proc.confidence})`,
          severity: 'medium',
        });
      }
    }
  }
  
  return flagged;
}

export function getDataQualityReport(al) {
  const validation = validateAL(al);
  const confidence = calculateConfidenceScore(al);
  const flaggedItems = identifyFlaggedItems(al);
  
  return {
    alId: al.id,
    title: al.title,
    validation,
    confidence,
    flaggedItems,
    summary: {
      totalFlags: flaggedItems.length,
      criticalFlags: flaggedItems.filter(f => f.severity === 'high').length,
      completionScore: confidence.percentage,
      readyForExport: validation.valid && confidence.percentage > 70 && flaggedItems.length <= 3,
    },
  };
}

export function generateCompletionPlan(al) {
  const report = getDataQualityReport(al);
  const plan = [];
  
  if (report.flaggedItems.some(f => f.severity === 'high')) {
    plan.push('Priority: Resolve critical issues (intro/conclusion)');
  }
  
  if (report.confidence.percentage < 60) {
    plan.push('Needed: Add missing procedures and analyses');
  }
  
  if (report.confidence.percentage < 80) {
    plan.push('Optional: Improve color detection for procedures');
  }
  
  return {
    currentScore: report.confidence.percentage,
    targetScore: 90,
    steps: plan,
    estimatedEffort: `${plan.length} steps`,
  };
}

export default {
  validateAL,
  calculateConfidenceScore,
  identifyFlaggedItems,
  getDataQualityReport,
  generateCompletionPlan,
};

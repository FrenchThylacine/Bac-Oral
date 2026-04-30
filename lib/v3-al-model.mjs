/**
 * V3 AL Model - Data structure for literary analysis documents
 * Defines schema for movements, procedures, analyses
 */

export class AL {
  constructor(data = {}) {
    this.id = data.id || `AL_${Date.now()}`;
    this.title = data.title || 'Untitled';
    this.intro = data.intro || '';
    this.conclusion = data.conclusion || '';
    this.ouverture = data.ouverture || '';
    
    this.movements = data.movements || [];
    
    this.metadata = {
      source: data.metadata?.source || 'unknown',
      extractedAt: data.metadata?.extractedAt || new Date().toISOString(),
      completionPercent: data.metadata?.completionPercent || 50,
      flaggedCount: data.metadata?.flaggedCount || 0,
      isDemo: data.metadata?.isDemo || false,
    };
    
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
  
  addMovement(movement) {
    if (!movement.name) throw new Error('Movement must have a name');
    
    this.movements.push({
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: movement.name,
      procedures: movement.procedures || [],
      createdAt: new Date().toISOString(),
    });
    
    this.updatedAt = new Date().toISOString();
    return this;
  }
  
  getProcedureCount() {
    return this.movements.reduce((sum, mov) => sum + (mov.procedures?.length || 0), 0);
  }
  
  getAnalysisCount() {
    let count = 0;
    for (const mov of this.movements) {
      for (const proc of mov.procedures || []) {
        count += (proc.analyses?.length || 0);
      }
    }
    return count;
  }
  
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      intro: this.intro,
      conclusion: this.conclusion,
      ouverture: this.ouverture,
      movements: this.movements,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
  
  toCompact() {
    return {
      id: this.id,
      title: this.title,
      procedureCount: this.getProcedureCount(),
      analysisCount: this.getAnalysisCount(),
      completion: this.metadata.completionPercent,
      flagged: this.metadata.flaggedCount,
    };
  }
}

export class Procedure {
  constructor(data = {}) {
    this.id = data.id || `proc_${Date.now()}`;
    this.name = data.name || 'Unnamed';
    this.color = data.color || '#666666';
    this.type = data.type || 'general';
    this.analyses = data.analyses || [];
    this.confidence = data.confidence !== undefined ? data.confidence : 0.7;
    this.flagged = data.flagged || false;
    this.createdAt = new Date().toISOString();
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      type: this.type,
      analyses: this.analyses,
      confidence: this.confidence,
      flagged: this.flagged,
      createdAt: this.createdAt,
    };
  }
}

export class Movement {
  constructor(data = {}) {
    this.id = data.id || `mov_${Date.now()}`;
    this.name = data.name || 'Unnamed Movement';
    this.procedures = (data.procedures || []).map(proc => 
      proc instanceof Procedure ? proc : new Procedure(proc)
    );
    this.createdAt = new Date().toISOString();
  }
  
  addProcedure(procedure) {
    const proc = procedure instanceof Procedure ? procedure : new Procedure(procedure);
    this.procedures.push(proc);
    return this;
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      procedures: this.procedures.map(p => p.toJSON()),
      createdAt: this.createdAt,
    };
  }
  
  getProcedureCount() {
    return this.procedures.length;
  }
}

export class FlaggedItem {
  constructor(data = {}) {
    this.id = data.id || `flag_${Date.now()}`;
    this.alId = data.alId;
    this.itemType = data.itemType || 'procedure'; // procedure | analysis | movement
    this.itemId = data.itemId;
    this.reason = data.reason || 'Requires review';
    this.resolution = data.resolution || null; // approved | rejected | edited
    this.createdAt = new Date().toISOString();
    this.resolvedAt = null;
  }
  
  resolve(resolution, notes = '') {
    this.resolution = resolution;
    this.resolvedAt = new Date().toISOString();
    this.notes = notes;
    return this;
  }
  
  toJSON() {
    return {
      id: this.id,
      alId: this.alId,
      itemType: this.itemType,
      itemId: this.itemId,
      reason: this.reason,
      resolution: this.resolution,
      createdAt: this.createdAt,
      resolvedAt: this.resolvedAt,
      notes: this.notes,
    };
  }
}

export function createALFromExtraction(extractionData) {
  if (!extractionData) {
    throw new Error('Extraction data required');
  }
  
  const al = new AL({
    id: extractionData.id,
    title: extractionData.title,
    intro: extractionData.intro,
    conclusion: extractionData.conclusion,
    ouverture: extractionData.ouverture,
    metadata: extractionData.metadata,
  });
  
  for (const mov of extractionData.movements || []) {
    al.addMovement({
      name: mov.name,
      procedures: (mov.procedures || []).map(proc => new Procedure({
        name: proc.name,
        color: proc.color,
        type: proc.type,
        analyses: proc.analyses,
        confidence: proc.confidence,
        flagged: proc.flagged,
      })),
    });
  }
  
  return al;
}

export default {
  AL,
  Procedure,
  Movement,
  FlaggedItem,
  createALFromExtraction,
};

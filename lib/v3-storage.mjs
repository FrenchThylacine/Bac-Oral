/**
 * V3 Storage Layer - SQLite persistence for AL data
 * Manages in-memory + disk storage with query interface
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { AL, createALFromExtraction, FlaggedItem } from './v3-al-model.mjs';

const DATA_DIR = '.data';
const DB_PATH = path.join(DATA_DIR, 'als.db');

let db = null;
const cache = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initializeDatabase() {
  ensureDataDir();
  
  try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS als (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        intro TEXT,
        conclusion TEXT,
        ouverture TEXT,
        completionPercent INTEGER DEFAULT 50,
        flaggedCount INTEGER DEFAULT 0,
        sourceFile TEXT,
        isDemo BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data JSON
      );
      
      CREATE TABLE IF NOT EXISTS movements (
        id TEXT PRIMARY KEY,
        alId TEXT NOT NULL,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (alId) REFERENCES als(id)
      );
      
      CREATE TABLE IF NOT EXISTS procedures (
        id TEXT PRIMARY KEY,
        movementId TEXT NOT NULL,
        alId TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        type TEXT,
        confidence REAL DEFAULT 0.7,
        flagged BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data JSON,
        FOREIGN KEY (movementId) REFERENCES movements(id),
        FOREIGN KEY (alId) REFERENCES als(id)
      );
      
      CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        procedureId TEXT NOT NULL,
        text TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (procedureId) REFERENCES procedures(id)
      );
      
      CREATE TABLE IF NOT EXISTS flagged_items (
        id TEXT PRIMARY KEY,
        alId TEXT NOT NULL,
        itemType TEXT NOT NULL,
        itemId TEXT NOT NULL,
        reason TEXT,
        resolution TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolvedAt DATETIME,
        FOREIGN KEY (alId) REFERENCES als(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_als_createdAt ON als(createdAt);
      CREATE INDEX IF NOT EXISTS idx_movements_alId ON movements(alId);
      CREATE INDEX IF NOT EXISTS idx_procedures_alId ON procedures(alId);
      CREATE INDEX IF NOT EXISTS idx_flagged_alId ON flagged_items(alId);
    `);
    
    console.log('[Storage] Database initialized:', DB_PATH);
  } catch (err) {
    console.error('[Storage] Database init failed:', err.message);
    throw err;
  }
}

export async function storeAL(extractionData) {
  if (!db) initializeDatabase();
  
  try {
    const al = createALFromExtraction(extractionData);
    
    const stmt = db.prepare(`
      INSERT INTO als (id, title, intro, conclusion, ouverture, 
                       completionPercent, flaggedCount, sourceFile, isDemo, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      al.id,
      al.title,
      al.intro,
      al.conclusion,
      al.ouverture,
      al.metadata.completionPercent,
      al.metadata.flaggedCount,
      al.metadata.source,
      al.metadata.isDemo ? 1 : 0,
      JSON.stringify(al.toJSON())
    );
    
    for (const movement of al.movements) {
      const movStmt = db.prepare(`
        INSERT INTO movements (id, alId, name) VALUES (?, ?, ?)
      `);
      movStmt.run(movement.id, al.id, movement.name);
      
      for (const proc of movement.procedures) {
        const procStmt = db.prepare(`
          INSERT INTO procedures (id, movementId, alId, name, color, type, confidence, flagged, data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        procStmt.run(
          proc.id,
          movement.id,
          al.id,
          proc.name,
          proc.color,
          proc.type,
          proc.confidence,
          proc.flagged ? 1 : 0,
          JSON.stringify(proc.toJSON())
        );
        
        for (const analysis of proc.analyses) {
          const anaStmt = db.prepare(`
            INSERT INTO analyses (id, procedureId, text)
            VALUES (?, ?, ?)
          `);
          anaStmt.run(
            `ana_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            proc.id,
            analysis
          );
        }
      }
    }
    
    cache.set(al.id, al);
    
    console.log('[Storage] Stored AL:', al.id);
    return { success: true, alId: al.id, stats: getALStats(al.id) };
  } catch (err) {
    console.error('[Storage] Error storing AL:', err.message);
    throw err;
  }
}

export function getAL(alId) {
  if (cache.has(alId)) {
    return cache.get(alId);
  }
  
  if (!db) initializeDatabase();
  
  try {
    const row = db.prepare('SELECT data FROM als WHERE id = ?').get(alId);
    if (row) {
      const al = Object.assign(new AL(), JSON.parse(row.data));
      cache.set(alId, al);
      return al;
    }
  } catch (err) {
    console.error('[Storage] Error retrieving AL:', err.message);
  }
  
  return null;
}

export function getAllALs() {
  if (!db) initializeDatabase();
  
  try {
    const rows = db.prepare('SELECT id, title, completionPercent, flaggedCount FROM als ORDER BY createdAt DESC').all();
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      completion: row.completionPercent,
      flagged: row.flaggedCount,
    }));
  } catch (err) {
    console.error('[Storage] Error listing ALs:', err.message);
    return [];
  }
}

export function updateAL(alId, updates) {
  if (!db) initializeDatabase();
  
  try {
    const stmt = db.prepare(`
      UPDATE als SET 
        title = COALESCE(?, title),
        intro = COALESCE(?, intro),
        conclusion = COALESCE(?, conclusion),
        completionPercent = COALESCE(?, completionPercent),
        flaggedCount = COALESCE(?, flaggedCount),
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      updates.title || null,
      updates.intro || null,
      updates.conclusion || null,
      updates.completionPercent !== undefined ? updates.completionPercent : null,
      updates.flaggedCount !== undefined ? updates.flaggedCount : null,
      alId
    );
    
    cache.delete(alId);
    console.log('[Storage] Updated AL:', alId);
    return { success: true };
  } catch (err) {
    console.error('[Storage] Error updating AL:', err.message);
    throw err;
  }
}

export function flagItem(alId, itemType, itemId, reason) {
  if (!db) initializeDatabase();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO flagged_items (id, alId, itemType, itemId, reason)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      `flag_${Date.now()}`,
      alId,
      itemType,
      itemId,
      reason
    );
    
    console.log('[Storage] Flagged item:', itemId);
    return { success: true };
  } catch (err) {
    console.error('[Storage] Error flagging item:', err.message);
    throw err;
  }
}

export function getFlaggedItems(alId) {
  if (!db) initializeDatabase();
  
  try {
    const rows = db.prepare(`
      SELECT * FROM flagged_items 
      WHERE alId = ? AND resolution IS NULL
      ORDER BY createdAt DESC
    `).all(alId);
    
    return rows;
  } catch (err) {
    console.error('[Storage] Error retrieving flagged items:', err.message);
    return [];
  }
}

export function resolveFlaggedItem(flagId, resolution) {
  if (!db) initializeDatabase();
  
  try {
    const stmt = db.prepare(`
      UPDATE flagged_items 
      SET resolution = ?, resolvedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(resolution, flagId);
    console.log('[Storage] Resolved flag:', flagId);
    return { success: true };
  } catch (err) {
    console.error('[Storage] Error resolving flag:', err.message);
    throw err;
  }
}

export function getALStats(alId) {
  if (!db) initializeDatabase();
  
  try {
    const al = db.prepare('SELECT * FROM als WHERE id = ?').get(alId);
    const movementCount = db.prepare('SELECT COUNT(*) as count FROM movements WHERE alId = ?').get(alId).count;
    const procedureCount = db.prepare('SELECT COUNT(*) as count FROM procedures WHERE alId = ?').get(alId).count;
    const analysisCount = db.prepare('SELECT COUNT(*) as count FROM analyses WHERE procedureId IN (SELECT id FROM procedures WHERE alId = ?)').get(alId).count;
    const flaggedCount = db.prepare('SELECT COUNT(*) as count FROM flagged_items WHERE alId = ? AND resolution IS NULL').get(alId).count;
    
    return {
      alId,
      title: al.title,
      movements: movementCount,
      procedures: procedureCount,
      analyses: analysisCount,
      flagged: flaggedCount,
      completion: al.completionPercent,
    };
  } catch (err) {
    console.error('[Storage] Error getting stats:', err.message);
    return null;
  }
}

export function getStorageStats() {
  if (!db) initializeDatabase();
  
  try {
    const alCount = db.prepare('SELECT COUNT(*) as count FROM als').get().count;
    const movementCount = db.prepare('SELECT COUNT(*) as count FROM movements').get().count;
    const procedureCount = db.prepare('SELECT COUNT(*) as count FROM procedures').get().count;
    const analysisCount = db.prepare('SELECT COUNT(*) as count FROM analyses').get().count;
    const flaggedCount = db.prepare('SELECT COUNT(*) as count FROM flagged_items WHERE resolution IS NULL').get().count;
    
    const fileSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    
    return {
      als: alCount,
      movements: movementCount,
      procedures: procedureCount,
      analyses: analysisCount,
      flagged: flaggedCount,
      dbSize: `${(fileSize / 1024).toFixed(2)} KB`,
    };
  } catch (err) {
    console.error('[Storage] Error getting storage stats:', err.message);
    return null;
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[Storage] Database closed');
  }
}

export default {
  storeAL,
  getAL,
  getAllALs,
  updateAL,
  flagItem,
  getFlaggedItems,
  resolveFlaggedItem,
  getALStats,
  getStorageStats,
  closeDatabase,
};

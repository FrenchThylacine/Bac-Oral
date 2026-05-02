// lib/v3-storage.mjs — SQLite storage v3.2
// FIX: auto-migrates stale schema, guaranteed unique IDs, ON CONFLICT DO UPDATE
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

let db = null;

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function initializeDatabase(dataDir = ".data") {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "als.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Auto-migrate: if schema is stale (missing columns), drop and recreate
  try {
    const cols = db.prepare("PRAGMA table_info(als)").all().map(c => c.name);
    const needsMigration = cols.length > 0 &&
      (!cols.includes("author") || !cols.includes("created_at") || !cols.includes("label"));
    if (needsMigration) {
      console.log("[Storage] Stale schema — migrating (old data cleared)...");
      db.exec("DROP TABLE IF EXISTS procedures; DROP TABLE IF EXISTS movements; DROP TABLE IF EXISTS als;");
    }
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS als (
      id            TEXT PRIMARY KEY,
      label         TEXT,
      title         TEXT,
      author        TEXT,
      genre         TEXT,
      introduction  TEXT,
      conclusion    TEXT,
      oral_bullets  TEXT DEFAULT '[]',
      quality_flags TEXT DEFAULT '[]',
      source_text   TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS movements (
      id          TEXT PRIMARY KEY,
      al_id       TEXT NOT NULL REFERENCES als(id) ON DELETE CASCADE,
      number      INTEGER,
      title       TEXT,
      phrase_theme TEXT,
      lines       TEXT,
      bullets     TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS procedures (
      id             TEXT PRIMARY KEY,
      al_id          TEXT NOT NULL REFERENCES als(id) ON DELETE CASCADE,
      movement_id    TEXT REFERENCES movements(id) ON DELETE CASCADE,
      label          TEXT,
      quote          TEXT,
      analysis       TEXT,
      weight         INTEGER DEFAULT 3,
      color_detected TEXT DEFAULT 'none'
    );
  `);

  const movementCols = db.prepare("PRAGMA table_info(movements)").all().map(c => c.name);
  if (!movementCols.includes("phrase_theme")) {
    db.exec("ALTER TABLE movements ADD COLUMN phrase_theme TEXT;");
  }

  console.log(`[Storage] Database initialized: ${dbPath}`);
  return db;
}

function getDb() {
  if (!db) initializeDatabase();
  return db;
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : value;
  } catch {
    return value;
  }
}

export function storeAL(al) {
  const d = getDb();
  const alId = (al.id && !al.id.startsWith("demo")) ? al.id : uid("al");

  try {
    const introductionValue = typeof al.introduction === 'object' ? JSON.stringify(al.introduction) : (al.introduction || "");
    const conclusionValue = typeof al.conclusion === 'object' ? JSON.stringify(al.conclusion) : (al.conclusion || "");
    d.prepare(`
      INSERT INTO als (id, label, title, author, genre, introduction, conclusion, oral_bullets, quality_flags, source_text, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        label=excluded.label, title=excluded.title, author=excluded.author,
        genre=excluded.genre, introduction=excluded.introduction,
        conclusion=excluded.conclusion, oral_bullets=excluded.oral_bullets,
        quality_flags=excluded.quality_flags, source_text=excluded.source_text,
        updated_at=datetime('now')
    `).run(
      alId, al.label || alId, al.title || "Sans titre", al.author || "",
      al.genre || "general", introductionValue, conclusionValue,
      JSON.stringify(al.oralBullets || []), JSON.stringify(al.qualityFlags || []),
      (al.sourceText || "").slice(0, 2000)
    );

    // Delete old movements (cascade deletes procedures too)
    d.prepare("DELETE FROM movements WHERE al_id = ?").run(alId);

    for (const mov of al.movements || []) {
      const movId = uid("mov");
      d.prepare(`INSERT INTO movements (id, al_id, number, title, phrase_theme, lines, bullets) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(movId, alId, mov.number || 1, mov.title || `Mouvement ${mov.number || 1}`,
          mov.phraseTheme || mov.phrase_theme || "", mov.lines || "", JSON.stringify(mov.bullets || []));

      for (const proc of mov.procedures || []) {
        if (!proc.label) continue;
        // Always generate fresh unique ID — never reuse
        d.prepare(`INSERT INTO procedures (id, al_id, movement_id, label, quote, analysis, weight, color_detected) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uid("proc"), alId, movId, proc.label, proc.quote || "",
            proc.analysis || "", proc.weight || 3, proc.colorDetected || "none");
      }
    }

    console.log(`[Storage] AL stored: ${alId}`);
    return { success: true, alId };
  } catch (err) {
    console.error("[Storage] Error storing AL:", err.message);
    throw err;
  }
}

export function getAL(alId) {
  const d = getDb();
  const al = d.prepare("SELECT * FROM als WHERE id = ?").get(alId);
  if (!al) return null;
  const movements = d.prepare("SELECT * FROM movements WHERE al_id = ? ORDER BY number").all(alId);
  for (const m of movements) {
    m.bullets = JSON.parse(m.bullets || "[]");
    m.phraseTheme = m.phrase_theme || m.lines || "";
    m.procedures = d.prepare("SELECT * FROM procedures WHERE movement_id = ? ORDER BY weight DESC").all(m.id);
  }
  const movCount = movements.length;
  const procCount = d.prepare("SELECT COUNT(*) as n FROM procedures WHERE al_id = ?").get(alId).n;
  const missing = d.prepare("SELECT COUNT(*) as n FROM procedures WHERE al_id = ? AND (analysis='' OR analysis IS NULL)").get(alId).n;
  return { 
    ...al, 
    introduction: parseMaybeJson(al.introduction),
    conclusion: parseMaybeJson(al.conclusion),
    movements, 
    oralBullets: JSON.parse(al.oral_bullets || "[]"), 
    qualityFlags: JSON.parse(al.quality_flags || "[]"),
    movementCount: movCount,
    procedureCount: procCount,
    flaggedCount: missing,
    completionPercent: procCount > 0 ? Math.round(((procCount - missing) / procCount) * 100) : 0,
  };
}

export function getAllALs() {
  const d = getDb();
  return d.prepare("SELECT * FROM als ORDER BY created_at DESC").all().map(al => {
    const movCount = d.prepare("SELECT COUNT(*) as n FROM movements WHERE al_id = ?").get(al.id).n;
    const procCount = d.prepare("SELECT COUNT(*) as n FROM procedures WHERE al_id = ?").get(al.id).n;
    const missing = d.prepare("SELECT COUNT(*) as n FROM procedures WHERE al_id = ? AND (analysis='' OR analysis IS NULL)").get(al.id).n;
    return {
      ...al, 
      introduction: parseMaybeJson(al.introduction),
      conclusion: parseMaybeJson(al.conclusion),
      oralBullets: JSON.parse(al.oral_bullets || "[]"), 
      qualityFlags: JSON.parse(al.quality_flags || "[]"),
      movementCount: movCount,
      procedureCount: procCount,
      flaggedCount: missing,
      completionPercent: procCount > 0 ? Math.round(((procCount - missing) / procCount) * 100) : 0,
    };
  });
}

export function deleteAL(alId) {
  getDb().prepare("DELETE FROM als WHERE id = ?").run(alId);
}

export function getFlaggedItems(alId) {
  const d = getDb();
  return alId
    ? d.prepare("SELECT * FROM procedures WHERE al_id = ? AND (analysis='' OR analysis IS NULL)").all(alId)
    : d.prepare("SELECT * FROM procedures WHERE analysis='' OR analysis IS NULL").all();
}

export function resolveFlaggedItem(procId, resolution) {
  getDb().prepare("UPDATE procedures SET analysis = ? WHERE id = ?").run(resolution, procId);
}

export function getALStats(alId) {
  const d = getDb();
  const al = d.prepare("SELECT * FROM als WHERE id = ?").get(alId);
  if (!al) return null;
  const movCount = d.prepare("SELECT COUNT(*) as n FROM movements WHERE al_id = ?").get(alId).n;
  const procCount = d.prepare("SELECT COUNT(*) as n FROM procedures WHERE al_id = ?").get(alId).n;
  const missing = d.prepare("SELECT COUNT(*) as n FROM procedures WHERE al_id = ? AND (analysis='' OR analysis IS NULL)").get(alId).n;
  return { ...al, movementCount: movCount, procedureCount: procCount, missingAnalysisCount: missing,
    completionScore: procCount > 0 ? Math.round(((procCount - missing) / procCount) * 100) : 0 };
}

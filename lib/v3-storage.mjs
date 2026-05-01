// ============================================================
// lib/v3-storage.mjs — SQLite storage for V3 AL data
// FIX: ON CONFLICT DO UPDATE instead of INSERT (kills UNIQUE crash)
// FIX: unique IDs enforced, never reuse hardcoded IDs
// ============================================================
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

let db = null;

export function initializeDatabase(dataDir = ".data") {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "als.db");
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS als (
      id          TEXT PRIMARY KEY,
      title       TEXT,
      author      TEXT,
      genre       TEXT,
      introduction TEXT,
      conclusion  TEXT,
      oral_bullets TEXT,
      quality_flags TEXT,
      source_text TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movements (
      id      TEXT PRIMARY KEY,
      al_id   TEXT NOT NULL REFERENCES als(id) ON DELETE CASCADE,
      number  INTEGER,
      title   TEXT,
      lines   TEXT,
      bullets TEXT
    );

    CREATE TABLE IF NOT EXISTS procedures (
      id           TEXT PRIMARY KEY,
      al_id        TEXT NOT NULL REFERENCES als(id) ON DELETE CASCADE,
      movement_id  TEXT REFERENCES movements(id) ON DELETE CASCADE,
      label        TEXT,
      quote        TEXT,
      analysis     TEXT,
      weight       INTEGER DEFAULT 3,
      color_detected TEXT
    );
  `);

  console.log(`[Storage] Database initialized: ${dbPath}`);
  return db;
}

function getDb() {
  if (!db) initializeDatabase();
  return db;
}

// ── Unique ID generator ──────────────────────────────────────
function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Store a full AL object ────────────────────────────────────
export function storeAL(al) {
  const database = getDb();

  // Ensure AL has a unique ID
  const alId = al.id && al.id !== "demo" ? al.id : uid("al");

  try {
    // ── Upsert AL row ──
    database.prepare(`
      INSERT INTO als (id, title, author, genre, introduction, conclusion, oral_bullets, quality_flags, source_text, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        title        = excluded.title,
        author       = excluded.author,
        genre        = excluded.genre,
        introduction = excluded.introduction,
        conclusion   = excluded.conclusion,
        oral_bullets = excluded.oral_bullets,
        quality_flags = excluded.quality_flags,
        source_text  = excluded.source_text,
        updated_at   = datetime('now')
    `).run(
      alId,
      al.title || "Sans titre",
      al.author || "",
      al.genre || "general",
      al.introduction || "",
      al.conclusion || "",
      JSON.stringify(al.oralBullets || []),
      JSON.stringify(al.qualityFlags || []),
      al.sourceText || ""
    );

    // ── Delete old movements + procedures for this AL (clean replace) ──
    database.prepare("DELETE FROM movements WHERE al_id = ?").run(alId);

    // ── Insert movements and procedures ──
    for (const mov of al.movements || []) {
      const movId = mov.id && !mov.id.startsWith("mov-demo") ? mov.id : uid("mov");

      database.prepare(`
        INSERT INTO movements (id, al_id, number, title, lines, bullets)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        movId,
        alId,
        mov.number || 1,
        mov.title || `Mouvement ${mov.number || 1}`,
        mov.lines || "",
        JSON.stringify(mov.bullets || [])
      );

      for (const proc of mov.procedures || []) {
        // Always generate a fresh unique ID for procedures — never reuse
        const procId = uid("proc");

        if (!proc.label) {
          console.warn("[Storage] Skipping procedure with no label", proc);
          continue;
        }

        database.prepare(`
          INSERT INTO procedures (id, al_id, movement_id, label, quote, analysis, weight, color_detected)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          procId,
          alId,
          movId,
          proc.label || "",
          proc.quote || "",
          proc.analysis || "",
          proc.weight || 3,
          proc.colorDetected || "none"
        );
      }
    }

    return { success: true, alId };

  } catch (err) {
    console.error("[Storage] Error storing AL:", err.message);
    throw err;
  }
}

// ── Get single AL with all data ───────────────────────────────
export function getAL(alId) {
  const database = getDb();

  const al = database.prepare("SELECT * FROM als WHERE id = ?").get(alId);
  if (!al) return null;

  const movements = database.prepare(
    "SELECT * FROM movements WHERE al_id = ? ORDER BY number"
  ).all(alId);

  for (const mov of movements) {
    mov.bullets = JSON.parse(mov.bullets || "[]");
    mov.procedures = database.prepare(
      "SELECT * FROM procedures WHERE movement_id = ? ORDER BY weight DESC"
    ).all(mov.id);
  }

  return {
    ...al,
    oralBullets: JSON.parse(al.oral_bullets || "[]"),
    qualityFlags: JSON.parse(al.quality_flags || "[]"),
    movements,
  };
}

// ── Get all ALs (summary, no procedures) ─────────────────────
export function getAllALs() {
  const database = getDb();
  const als = database.prepare("SELECT * FROM als ORDER BY created_at DESC").all();
  return als.map(al => ({
    ...al,
    oralBullets: JSON.parse(al.oral_bullets || "[]"),
    qualityFlags: JSON.parse(al.quality_flags || "[]"),
  }));
}

// ── Get flagged items for review ──────────────────────────────
export function getFlaggedItems(alId) {
  const database = getDb();
  const query = alId
    ? "SELECT * FROM procedures WHERE al_id = ? AND (analysis = '' OR analysis IS NULL)"
    : "SELECT * FROM procedures WHERE analysis = '' OR analysis IS NULL";
  return alId ? database.prepare(query).all(alId) : database.prepare(query).all();
}

// ── Resolve a flagged item ────────────────────────────────────
export function resolveFlaggedItem(procId, resolution) {
  const database = getDb();
  database.prepare(
    "UPDATE procedures SET analysis = ? WHERE id = ?"
  ).run(resolution, procId);
}

// ── Get AL stats ──────────────────────────────────────────────
export function getALStats(alId) {
  const database = getDb();
  const al = database.prepare("SELECT * FROM als WHERE id = ?").get(alId);
  if (!al) return null;

  const movCount = database.prepare(
    "SELECT COUNT(*) as n FROM movements WHERE al_id = ?"
  ).get(alId).n;

  const procCount = database.prepare(
    "SELECT COUNT(*) as n FROM procedures WHERE al_id = ?"
  ).get(alId).n;

  const missingAnalysis = database.prepare(
    "SELECT COUNT(*) as n FROM procedures WHERE al_id = ? AND (analysis = '' OR analysis IS NULL)"
  ).get(alId).n;

  return {
    ...al,
    movementCount: movCount,
    procedureCount: procCount,
    missingAnalysisCount: missingAnalysis,
    completionScore: procCount > 0
      ? Math.round(((procCount - missingAnalysis) / procCount) * 100)
      : 0,
  };
}

// ── Delete AL ─────────────────────────────────────────────────
export function deleteAL(alId) {
  const database = getDb();
  database.prepare("DELETE FROM als WHERE id = ?").run(alId);
}

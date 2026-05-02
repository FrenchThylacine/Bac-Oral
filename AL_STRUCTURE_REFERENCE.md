# BAC ORAL V3 - AL STRUCTURE REFERENCE

## Complete AL Data Model

```javascript
{
  // ─── Metadata ────────────────────────────────────────────────────
  id: "al_timestamp_random",           // Unique ID
  label: "AL 1",                       // Display label (from filename)
  title: "Le Tartuffe - Acte III",     // Work title
  author: "Molière",                   // Author name
  work: "Le Tartuffe",                 // Full work reference
  genre: "theatre|poesie|roman|general", // Genre classification
  
  // ─── INTRODUCTION (REQUIRED - ALL 4 FIELDS) ──────────────────────
  introduction: {
    auteurContexte: "Molière (1622-1673) est un dramaturge français...",
    //^ 2-3 sentences: author + era + literary context
    
    oeuvrePassage: "Le Tartuffe (1669) est une pièce de critique sociale...",
    //^ 2-3 sentences: work + passage situation + brief plot summary
    
    problematique: "Comment Molière critique-t-il l'hypocrisie religieuse?",
    //^ 1 sentence NOMINAL (question form): the central issue
    
    annoncePlan: "Ce texte se divise en 3 mouvements: révélation / aveuglement / résolution"
    //^ 1 sentence: "This text divides into X movements: M1 / M2 / M3..."
  },
  
  // ─── MOVEMENTS (REQUIRED - MIN 3, MAX 4) ──────────────────────────
  movements: [
    {
      number: 1,
      title: "Révélation de l'imposture",     // Movement title
      phraseTheme: "Damis exposes Tartuffe's scheming...",
      //^ 1 sentence: summarize the movement's theme
      
      procedures: [
        {
          label: "métaphore",                 // Procedure name (REQUIRED)
          quote: "excerpt up to 5 words",     // Text citation (OPTIONAL)
          analysis: "image poétique frappante", // MAX 6 WORDS, NOMINAL (REQUIRED)
          weight: 4,                           // 1-5, higher = more important
          colorDetected: "jaune|rose|vert|bleu|none" // Color from image analysis
        },
        {
          label: "anaphore",
          quote: "repeated structure",
          analysis: "insistance rhétorique construite", // Max 6 words!
          weight: 5,
          colorDetected: "none"
        },
        // ... MINIMUM 5, MAXIMUM 10 procedures per movement
        // Multiple procedures CAN share same analysis (will be deduplicated)
      ]
    },
    {
      number: 2,
      title: "Aveuglement d'Orgon",
      phraseTheme: "Orgon refuses to believe Damis, worsening his blindness",
      procedures: [
        // ... 5-10 procedures
      ]
    },
    {
      number: 3,
      title: "Résolution par intervention",
      phraseTheme: "External authority intervention exposes Tartuffe and restores order",
      procedures: [
        // ... 5-10 procedures
      ]
    }
    // Additional movements (max 4)
  ],
  
  // ─── CONCLUSION (REQUIRED - ALL 3 FIELDS) ───────────────────────
  conclusion: {
    cheminement: "The text follows a progression: Damis attempts revelation, Orgon worsens blindness, external authority restores order.",
    //^ 1-2 lines: summary of the 3 movements
    
    reponse: "Molière demonstrates that truth and virtue triumph over hypocrisy.",
    //^ 1 line: DIRECT answer to the problématique
    
    ouverture: "This connects to other Molière plays exploring illusion vs reality."
    //^ 1 line (OPTIONAL): connection to other texts or literary context
  },
  
  // ─── Supporting Data ────────────────────────────────────────────────
  oralBullets: ["Critique de l'hypocrisie", "Escalade dramatique", "Triomphe de la vérité"],
  //^ 4 MAX oral memorization bullets
  
  qualityFlags: [],                     // ["ocr-insufficient"] if OCR < 50 chars
  sourceText: "original OCR text up to 1500 chars",
  
  // ─── Computed Fields (Added by DB) ──────────────────────────────────
  moveCount: 3,                        // Number of movements
  procedureCount: 17,                  // Total procedures
  completionPercent: 100               // % procedures with analysis
}
```

## Procedures (Details)

### Analysis Rules
- **MUST be NOMINAL** (no full sentences, no articles)
- **MINIMUM 1 word** (e.g., "critique")
- **MAXIMUM 6 words** (e.g., "critique douce du système bienveillant")
- **Examples of GOOD analysis:**
  - "satire par l'hyperbole"
  - "tension dramatique majeure"
  - "parodie du leibnizianisme"
  - "critique de la fausse piété"
  - "juxtaposition révélatrice"

### Examples of BAD analysis (TOO LONG):
```javascript
// ❌ 9 words - TOO LONG
"This passage demonstrates through repeated anaphoric structures"

// ❌ Needs to be nominal
"The character says something important here"

// ✅ CORRECT (5 words)
"anaphore → insistance rhétorique construite"
```

### Procedure Weight (1-5)

Priority procedures get weight 4-5:
- métaphore, métaphore filée, anaphore, antithèse, chiasme, oxymore
- hyperbole, champ lexical, registre, focalisation, ironie, gradation, allégorie

Secondary get weight 2-3:
- comparaison, personnification, parallélisme, énumération
- allitération, assonance, enjambement, discours direct/indirect

### Procedure Quote (OPTIONAL)
- Maximum 5 words from the original text
- If not found, can be the procedure name itself
- Used for memorization reference in PDF

## Genre Color Codes

```javascript
const GENRE_COLOR = {
  theatre: "#4C1D95",   // Purple - dark theatrical
  poesie:  "#1E3A8A",   // Blue - lyrical
  roman:   "#7F1D1D",   // Red - narrative passion
  general: "#14532D"    // Green - nature/general
}
```

## Database Schema

```sql
-- Main AL record
CREATE TABLE als (
  id            TEXT PRIMARY KEY,
  label         TEXT,
  title         TEXT,
  author        TEXT,
  genre         TEXT,
  introduction  TEXT,     -- JSON string
  conclusion    TEXT,     -- JSON string
  oral_bullets  TEXT,     -- JSON array
  quality_flags TEXT,     -- JSON array
  source_text   TEXT,
  created_at    TEXT,
  updated_at    TEXT
);

-- Movements linked to ALs
CREATE TABLE movements (
  id          TEXT PRIMARY KEY,
  al_id       TEXT REFERENCES als(id),
  number      INTEGER,
  title       TEXT,
  phrase_theme TEXT,
  lines       TEXT,
  bullets     TEXT      -- JSON array
);

-- Procedures linked to movements
CREATE TABLE procedures (
  id             TEXT PRIMARY KEY,
  al_id          TEXT REFERENCES als(id),
  movement_id    TEXT REFERENCES movements(id),
  label          TEXT,
  quote          TEXT,
  analysis       TEXT,
  weight         INTEGER,
  color_detected TEXT
);
```

## API Endpoints Reference

### POST /api/v3/upload
**Request:**
```json
{
  "images": [
    {
      "dataUrl": "data:image/png;base64,...",
      "name": "AL1_Moliere_Tartuffe.jpg"
    }
  ],
  "apiKey": "sk-..." (optional)
}
```

**Response:**
```json
{
  "success": true,
  "alId": "al_...",
  "title": "Le Tartuffe",
  "genre": "theatre",
  "movementCount": 3
}
```

### GET /api/v3/als
**Response:**
```json
{
  "als": [
    { id, label, title, author, genre, introduction, conclusion, movements... }
  ]
}
```

### GET /api/v3/als/:id
**Response:**
Full AL object with database-computed fields

### PUT /api/v3/als/:id
**Request:**
```json
{
  "title": "New title",
  "introduction": { ... },
  "conclusion": { ... }
}
```

### POST /api/v3/export
**PDF Request:**
```json
{ "format": "pdf", "alId": "al_..." }
```

**Excel Request:**
```json
{ "mode": "minimalist", "alId": "al_..." }
```

## Fallback Values (if extraction fails)

All fields are **ALWAYS** populated, even if extraction fails:

```javascript
// If no OCR text detected
introduction.auteurContexte = generateFromGenre(genre)
introduction.problematique = "Quel sens le texte met-il en valeur?"

// If no movements detected
movements = [
  { number: 1, title: "First part", procedures: [...5 generated] },
  { number: 2, title: "Second part", procedures: [...5 generated] },
  { number: 3, title: "Third part", procedures: [...5 generated] }
]

// If no procedures found
procedures = generateFromGenreBank(genre) // Pull from genre-specific bank

// If no conclusion detected
conclusion.reponse = "The text demonstrates the theme through literary devices."
```

## Testing Checklist

- [ ] introduction is object (not string)
- [ ] introduction has all 4 required fields
- [ ] problematique is nominative
- [ ] annoncePlan starts with "Ce texte se divise..."
- [ ] movements array has 3+ items
- [ ] each movement has phraseTheme (1 sentence)
- [ ] each movement has 5-10 procedures
- [ ] each procedure has: label, analysis, weight
- [ ] analysis is NOMINAL and ≤ 6 words
- [ ] weight is 1-5
- [ ] conclusion is object (not string)
- [ ] conclusion has all 3 required fields
- [ ] conclusion.reponse is 1 line
- [ ] oralBullets is array
- [ ] genre is one of: theatre, poesie, roman, general

All tests should pass ✅

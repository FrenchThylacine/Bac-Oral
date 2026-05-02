# BAC ORAL STUDIO — MEGA RECOVERY PROMPT v4
# Read entirely before touching ANY file.

---

## WHAT THIS PROJECT IS

A French Bac oral revision tool. Student uploads photos of handwritten AL sheets.
App digitizes them → structured PDF/Excel revision sheets ready for memorization.

Stack: Node.js server (server.mjs) + vanilla JS frontend (web/) + SQLite (better-sqlite3)
Repo: https://github.com/FrenchThylacine/Bac-Oral
Run: node server.mjs  |  Port: 4173

---

## EXACT AL STRUCTURE REQUIRED (from official methodology)

Each AL output MUST follow this exact oral exam structure:

### INTRODUCTION (4 parts)
1. Présentation auteur + contexte historique/littéraire (2-3 lignes)
2. Présentation de l'œuvre + situation du passage + bref résumé (2-3 lignes)
3. Problématique — question que le texte explore (1 ligne, nominale)
4. Annonce du plan — liste des mouvements (1 ligne)

### DÉVELOPPEMENT (3 mouvements minimum)
Per mouvement:
- Phrase-thème: 1 ligne résumant le thème du mouvement
- 5 à 10 procédés MAXIMUM, format STRICT:
  • procédé → analyse (SHORT, NOMINAL, max 6 mots)
  Examples:
  • métaphore → valorisation du sentiment
  • anaphore → insistance / amplification
  • hyperbole → intensité émotionnelle
  • champ lexical de la mort → omniprésence du tragique
RULES:
- Multiple procédés CAN share the same analysis
- Group similar procédés together
- Remove weak/redundant ones
- NO full sentences, NO paraphrase

### CONCLUSION (3 parts)
1. Rappel du cheminement (1-2 lignes résumant les 3 mouvements)
2. Réponse à la problématique (1 ligne claire et directe)
3. Ouverture facultative (1 ligne vers autre texte ou parcours associé)

---

## CURRENT STATUS (last test log)

WORKING:
- Server starts: node server.mjs OK
- Storage: AL stored with unique IDs (no more UNIQUE constraint errors)
- Windows OCR: working on most images (113–1880 chars extracted)
- Upload pipeline: /api/v3/upload returns 200

BROKEN:
- OCR text too short on some images (< 50 chars) → falls back to demo
- PDF export: not producing correctly structured output
- Frontend: AL cards show but movements/procédés not rendering
- Intro/conclusion: not displayed in UI cards
- Procédé detection: working but not selecting best ones

NEXT PRIORITY (in order):
1. lib/v3-extraction.mjs — improve procédé selection + generate missing intro/conclusion
2. lib/v3-pdf-exporter.mjs — produce clean memorization-ready PDF per AL
3. web/app-v3.js — show intro/conclusion/movements properly in AL cards
4. server.mjs — add PUT /api/v3/als/:id for inline editing

---

## EXACT FILE TO FIX: lib/v3-extraction.mjs

The extraction output MUST always return this exact structure (never empty fields):

```javascript
{
  id: "al-timestamp-random",
  label: "AL 1",           // from filename
  title: "string",          // text title
  author: "string",         // author name
  work: "string",           // full work name
  genre: "theatre|poesie|roman|general",
  introduction: {
    auteurContexte: "string",   // author + era
    oeuvrePassage: "string",    // work + passage situation
    problematique: "string",    // the question explored (nominal)
    annoncePlan: "string"       // "Ce texte se divise en X mouvements: ..."
  },
  movements: [
    {
      number: 1,
      title: "string",
      phraseTheme: "string",    // 1-line theme sentence
      procedures: [
        {
          label: "string",      // procédé name
          quote: "string",      // text citation (5 words max)
          analysis: "string",   // SHORT NOMINAL (max 6 words)
          weight: 1-5,
          colorDetected: "jaune|rose|vert|bleu|none"
        }
      ]
    }
  ],
  conclusion: {
    cheminement: "string",      // summary of 3 movements
    reponse: "string",          // direct answer to problématique
    ouverture: "string"         // optional opening
  },
  oralBullets: ["string"],      // 4 key oral bullets
  qualityFlags: [],
  sourceText: "string"
}
```

FALLBACK RULES (MANDATORY — never return empty fields):
- If OCR insufficient → generate plausible structure from filename + genre
- If movements not detected → split text into 3 equal parts
- If procédés missing → generate 5 relevant ones from genre-specific bank
- If intro missing → generate standard contextual intro from title + genre
- If conclusion missing → generate from movement titles

---

## EXACT FILE TO FIX: lib/v3-pdf-exporter.mjs

PDF must look EXACTLY like this (one page per AL, clean, scannable):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL 1 — [AUTEUR] — [TITRE DU TEXTE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTRODUCTION
• [auteur + contexte]
• [œuvre + passage + résumé]
• Problématique: [question nominale]
• Plan: [Mouvement 1: thème] / [Mouvement 2: thème] / [Mouvement 3: thème]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOUVEMENT 1 — [titre] (lignes X-Y)
[phrase-thème]

• procédé → analyse courte
• procédé → analyse courte
• procédé → analyse courte
[5-10 procédés]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOUVEMENT 2 — [titre]
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOUVEMENT 3 — [titre]
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONCLUSION
• [rappel cheminement]
• Réponse: [réponse à la problématique]
• Ouverture: [facultatif]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

PDF style rules:
- Font: Helvetica (built-in, no download)
- Title: 14pt bold
- Section headers: 11pt bold, dark background
- Body: 10pt
- Bullets: "•  procédé → analyse" format
- Page margins: 40px all sides
- Color: genre-aware header color
  theatre: #4C1D95, poesie: #1E3A8A, roman: #7F1D1D, general: #14532D
- Library: pdfkit (already installed)
- One AL per page (add page break between ALs)

---

## EXACT FILE TO FIX: web/app-v3.js

The AL card MUST show (in order):
1. Header: label + genre badge + title + author
2. Status indicators: OCR quality, procédé count, flags
3. INTRODUCTION section (collapsible, open by default):
   - Auteur/contexte
   - Œuvre/passage
   - Problématique
   - Annonce du plan
4. Per MOUVEMENT (color-coded by genre):
   - Movement title + phrase-thème
   - Procedures table: procédé | citation | analyse | weight dots
5. CONCLUSION section:
   - Cheminement
   - Réponse
   - Ouverture
6. Footer: Export PDF | Export Excel | Delete buttons

---

## HTML ID CONTRACT (do not change these IDs)

#v3-dropzone, #v3-file-input, #v3-queue, #v3-queue-title, #v3-queue-list,
#v3-clear-queue, #v3-process-btn, #v3-al-list, #v3-log, #v3-stat-total,
#v3-stat-ready, #v3-stat-flags, #v3-export-all, #v3-export-mode,
#v3-download-link, #v3-review-body, #v3-review-section,
#v3-api-key, #v3-save-key, #v3-key-status

---

## PROCÉDÉ SELECTION LOGIC

PRIORITIZE (weight 4-5):
métaphore, métaphore filée, anaphore, antithèse, chiasme, oxymore,
hyperbole, champ lexical, registre, focalisation, ironie, gradation, allégorie

SECONDARY (weight 2-3):
comparaison, personnification, parallélisme, énumération,
allitération, assonance, enjambement, discours direct/indirect

FILTER OUT if analysis duplicates another procédé's analysis.
LIMIT: 5 minimum, 10 maximum per movement.

---

## FIX ORDER (strict — do not skip)

1. lib/v3-extraction.mjs
   → structured intro/conclusion objects
   → better procédé selection (prioritized, filtered)
   → fallback generation always fills all fields

2. lib/v3-pdf-exporter.mjs
   → implement exact PDF format above using pdfkit
   → one page per AL, genre color headers
   → endpoint: POST /api/v3/export with format:"pdf"

3. web/app-v3.js
   → render structured intro/conclusion in cards
   → show procédés table in each movement
   → per-AL PDF export button

4. server.mjs
   → add PUT /api/v3/als/:id (inline editing save)
   → add format param to export endpoint

---

## ARCHITECTURE RULES (do not break)

- Keep multifile Node.js structure
- Do not add new npm packages (use pdfkit, exceljs, better-sqlite3 already installed)
- Keep all API endpoint paths unchanged
- After each file edit → append to CHANGELOG.md
- Test: node server.mjs must start clean, /api/health must return 200

---

## TEST PROCEDURE

After each fix:
1. node server.mjs → no errors
2. curl http://localhost:4173/api/health → {"ok":true}
3. Upload one image → check log for "[Storage] AL stored"
4. GET /api/v3/als → AL has intro.problematique and movements[0].phraseTheme
5. POST /api/v3/export {format:"pdf"} → PDF downloads with correct structure

---

## CONTINUITY RULE

After every file edit → append to CHANGELOG.md:
Date | File | What changed | What still needs fixing

If rate limited mid-session, CHANGELOG tells next AI exactly where to resume.
Never leave server in broken state — one complete fix before next file.

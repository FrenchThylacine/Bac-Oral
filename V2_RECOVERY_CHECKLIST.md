# V2 Recovery Checklist - Bac Oral Studio Elite Quality

**Status**: Rate Limit Recovery Point  
**Date**: 2026-04-29  
**Last Verified**: Entry processing works (oral bullets generated, 3+ movements, procedures detected)

## COMPLETED PHASES ✅

### Phase 1: Frontend Stabilization
- [x] Fixed `#toast-stack` missing → protected `showToast()` with null guard
- [x] Fixed DOM selector mismatch → `#sequence-dropzone` now `#global-sequence-dropzone`
- [x] Added missing UI containers (status banner, toast stack, preview sections)
- [x] Aligned all JS selectors to HTML

### Phase 2: Backend Bug Fixes
- [x] Fixed `eliteQualityTransform()` → changed `const eliteEntry` to `let eliteEntry`
- [x] Fixed OCR noise detection patterns
- [x] Fixed `cleanOcrText()` function
- [x] Verified `processEntries()` API route returns 200 OK

### Phase 3: Initial Functionality Validation
- [x] Recap PDF parsing works → produces sequence list
- [x] AL import with images works → 10 images attached successfully
- [x] Process button triggers backend successfully
- [x] Entry processing generates: oral bullets (4+), movements (3+), procedures

## NEXT PHASES - IN PROGRESS 🚀

### Phase 4: Visual Styling & Display (CURRENT)
- [ ] **Movement cards** with color coding
  - Theater: Purple/Magenta
  - Poetry: Blue/Indigo
  - Novel: Red/Crimson
  - General: Gray/Neutral
- [ ] **Procedure badges** with impact indicators
  - Visual color gradient (✓ = green, ≈ = yellow, ✗ = gray)
  - Weight/importance display
- [ ] **Status indicators** in entry cards
  - OCR progress bar
  - Structuring progress bar
  - Analysis progress bar
  - Export readiness checkmark

### Phase 5: Complete Testing
- [ ] Export XLSX/PDF functionality
- [ ] Smart actions (simplify, fix-weak, highlight)
- [ ] Dark mode persistence
- [ ] Recovery workflow (localStorage hydration)
- [ ] Placeholder file imports (from /inputs)
- [ ] All UI state transitions

### Phase 6: V2 Polish & Performance
- [ ] Optimize bundle size
- [ ] Cache processing results
- [ ] Add undo/redo support
- [ ] Performance monitoring

## ARCHITECTURE STATE

### Frontend (web/app.js)
- State model: ✅ Working
- Render pipeline: ✅ Working
- Event handlers: ✅ Wired
- API integration: ✅ Working (process, action, export routes)
- Toast notifications: ✅ Working
- DOM selectors: ✅ All aligned

### Backend (server.mjs)
- `/api/recap/parse`: ✅ Working (PDF → sequences)
- `/api/process`: ✅ Working (processEntries)
- `/api/action`: ✅ Working (applySmartAction)
- `/api/export`: ⚠️ Needs testing
- Static serving: ✅ Working

### Processing Engine (lib/revision-engine.mjs)
- OCR text cleaning: ✅ Working
- Noise detection: ✅ Working
- Movement generation: ✅ Working
- Procedure detection: ✅ Working
- Oral bullet generation: ✅ Working
- Elite quality transform: ✅ FIXED

## CURRENT ENTRY STATE (Sample)
```
AL-1 (Alfred de Musset - Acte II, scène 5)
├── Files: 0 (waiting for images)
├── Oral Bullets: 4 ✅
│   ├── "certitude mise en crise"
│   ├── "émotion portée au premier plan"
│   ├── "tension et renversement"
│   └── "parole transformée en affrontement"
├── Movements: 3 ✅
│   ├── "Conflit initial"
│   ├── "Montée de la tension"
│   └── "Vérité finale"
├── Procedures: Auto-detected ✅
└── Status: ocr=done, structuring=done, analysis=done, export=ready
```

## FILES TO MODIFY (Phase 4-5)

### Styling Updates Needed
1. `web/styles.css` - Add movement color classes, procedure badges
2. `web/app.js` - Add rendering for colored movement cards, procedure indicators
3. `web/index.html` - Add visual containers for movements/procedures preview

### Testing Checklist
- [ ] Test with all 3 placeholder PDFs in /inputs
- [ ] Verify all 12 entries process without errors
- [ ] Export single entry as XLSX
- [ ] Export sequence as PDF
- [ ] Apply all 3 smart actions
- [ ] Reload page → verify localStorage recovery
- [ ] Toggle dark mode → verify persistence
- [ ] Upload image for AL-1 → verify OCR flow

## QUICK RESTART COMMANDS

```bash
# Terminal 1: Start server
cd c:\Users\iyadf\Documents\Codex\2026-04-28\files-mentioned-by-the-user-r
node server.mjs
# Expected output: "Bac Oral Studio running on http://127.0.0.1:4173"

# Browser: Reload and test
http://127.0.0.1:4173
```

## IF RATE LIMIT HITS AGAIN
1. Mark which Phase/todo was in progress
2. Update this file with exact line where you stopped
3. Next continuation: Read this file first, restart server, run remaining tests
4. Don't reprocess everything - just continue from checkpoint

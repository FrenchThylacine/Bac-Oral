# BAC ORAL STUDIO V3 - TESTING GUIDE

## Available Test Data

### Text Files (OCR Simulation)
- **input/placeholder/sample_al_1.txt** - Molière "Le Tartuffe" analysis
  - Already structured with movements and procedures
  - Can be used to test extraction pipeline
  - Format: MOUVEMENT X / Procedure blocks / INTRODUCTION / CONCLUSION

### PDF Files (Récapitulatif)
- **input (placeholder)/Récapitulatif des oeuvres...pdf** - Summary of all works
  - Contains 3 sequences (Theatre, Poetry, Novel)
  - Multiple ALs per sequence
  - Use with `/api/recap/parse` endpoint (V1/V2)

### Sequence Folders
- **input (placeholder)/Sequence 1 - Le théâtre...** - Theatre texts
- **input (placeholder)/Sequence 2 - La poésie...** - Poetry texts  
- **input (placeholder)/Sequence 3 - Le roman...** - Novel texts

## Testing Options

### Option 1: Automated Tests (Recommended)

Run all validation tests:
```bash
node test-v3-complete.mjs
```

This single command tests:
- ✅ AL structure (introduction/conclusion/movements/procedures)
- ✅ Database storage and retrieval
- ✅ Roundtrip validation (data consistency)
- ✅ PDF export
- ✅ All data types (theatre, poetry, novel)

Output shows:
```
[STEP 1] Loading modules...
[STEP 2] Testing AL Structure (Introduction & Conclusion)...
  ✅ Introduction structure: valid
  ✅ Movements structure: valid
  ✅ Conclusion structure: valid
  
[STEP 3] Testing Storage in Database...
  ✅ AL stored with ID: al_complete_...

[STEP 4] Testing Retrieval & Roundtrip...
  ✅ introduction roundtrip: PASS
  ✅ conclusion roundtrip: PASS
  ✅ movements roundtrip: 3 movements

[STEP 5] Testing PDF Export...
  ✅ PDF generated successfully
  
[STEP 6] Final Statistics...
  📊 Total ALs in database: 1
  📊 Test AL stats:
     • Movements: 3
     • Procedures: 17
     • Completion: 100%

✅ ALL TESTS PASSED
```

### Option 2: Test Suite Runner

```bash
bash run-tests.sh
```

Runs:
1. test-integration.mjs - Database validation
2. test-v3-complete.mjs - Full integration
3. test-endpoints.mjs - API mock tests

### Option 3: Endpoint Mock Tests

```bash
node test-endpoints.mjs
```

Simulates API calls:
- POST /api/v3/upload
- GET /api/v3/als
- GET /api/v3/als/:id
- PUT /api/v3/als/:id
- POST /api/v3/export

### Option 4: Live Server Test

```bash
# Terminal 1: Start server
node server.mjs

# Terminal 2: Test health
curl http://localhost:4173/api/health

# Get all ALs
curl http://localhost:4173/api/v3/als | jq

# Get single AL
curl http://localhost:4173/api/v3/als/al_... | jq '.introduction'
```

## Test Data Structure

Each test AL includes:

### Introduction (Object with 4 parts)
```javascript
introduction: {
  auteurContexte: "Molière (1622-1673) is...",
  oeuvrePassage: "Le Tartuffe (1669) exposes...",
  problematique: "How does Molière critique...",
  annoncePlan: "This text divides into 3 movements..."
}
```

### Movements (Array with 3+ items)
```javascript
movements: [
  {
    number: 1,
    title: "Revelation of imposture",
    phraseTheme: "Damis exposes Tartuffe's scheming...",
    procedures: [
      {
        label: "apostrophe véhémente",
        quote: "excerpt from text",
        analysis: "short nominal analysis",
        weight: 5,
        colorDetected: "blue"
      },
      // ... 5-10 procedures per movement
    ]
  },
  // ... up to 3 movements
]
```

### Conclusion (Object with 3 parts)
```javascript
conclusion: {
  cheminement: "The text follows a dramatic arc...",
  reponse: "Molière demonstrates that truth...",
  ouverture: "This study connects to other works..."
}
```

## Genres Tested

- **theatre**: Uses theatre-specific vocabulary and color (#4C1D95, purple)
- **poesie**: Uses poetry-specific vocabulary and color (#1E3A8A, blue)
- **roman**: Uses novel-specific vocabulary and color (#7F1D1D, red)
- **general**: Generic color (#14532D, green)

## Expected Test Results

All tests should show:
```
✅ Introduction structure: valid
✅ Movements structure: valid  
✅ Procedures valid (5-10 per movement)
✅ Conclusion structure: valid
✅ Database storage: OK
✅ Retrieval roundtrip: PASS
✅ PDF export: successful
✅ ALL TESTS PASSED
```

## Troubleshooting

If tests fail:

1. **Module not found**
   ```bash
   npm install
   ```

2. **Database locked**
   ```bash
   rm -rf .data/
   ```

3. **PDF export fails**
   - This is non-critical; data validation still passes
   - Check: `npm list pdfkit`

4. **Structure validation fails**
   - Check error message shows which field is missing
   - Verify all 4 introduction parts are present
   - Verify all 3 conclusion parts are present
   - Verify procedures have analysis (max 6 words)

## File Locations

After running tests:
- Generated ALs: `.data/als.db` (SQLite database)
- Exported PDFs: `outputs/bac-oral-*.pdf`
- Test logs: Console output

## Next Steps After Testing

1. ✅ Tests pass → System ready
2. ✅ Upload real images with `/api/v3/upload`
3. ✅ Verify frontend displays ALs correctly
4. ✅ Test export formats (PDF, Excel)
5. ✅ Verify PDF visual formatting

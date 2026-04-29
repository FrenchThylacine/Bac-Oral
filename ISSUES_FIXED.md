# Issues Found & Fixed in Output Analysis

## Issues Identified

### 1. 🔴 **Merged Cells Duplicating Values**
**Symptom**: Every merged cell was repeating the value across ALL columns (A-H)
- "Séquence 1" appeared 8 times in row 1 instead of once in merged A1:H1
- "AL 1 - Alfred de Musset..." repeated 8 times in row 3

**Root Cause**: The `writeMerged()` function was setting cell.values to the entire merged range, causing the Workbook API to distribute the value to all cells.

**Fix Applied** in `lib/export-workbook.mjs`:
```javascript
// OLD (buggy):
function writeMerged(sheet, range, value, format) {
  const cell = sheet.getRange(range);
  cell.merge();
  cell.values = [[value]];  // Distributes to all cells!
  cell.format = format;
}

// NEW (fixed):
function writeMerged(sheet, range, value, format) {
  const startCell = range.split(":")[0];  // Get "A1" from "A1:G1"
  const cell = sheet.getRange(range);
  cell.merge();
  sheet.getRange(startCell).values = [[value]];  // Only first cell
  cell.format = format;
}
```

---

### 2. 🔴 **OCR Noise Not Being Cleaned in Export**
**Symptom**: Corrupted text appeared in exported cells
- "O SE O LLJ O O O O o 0 O fi C u) O Q)..."
- "03 asse\n\nCe endant j'ai fait out au monde..."
- "EAF — texte no 4 : le dénouement de Badine. PERDICAN - Insensés ue ou om !"

**Root Cause**: 
- The PDF text extraction was not cleaning OCR noise
- Corrupted text from PDF extraction needs validation before export

**Fixes Applied**:

#### Fix 1: Enhanced PDF text cleaning in `scripts/extract_recap.py`
```python
def collapse(value: str = "") -> str:
    cleaned = re.sub(r"\s+", " ", normalize_text(value)).strip()
    # Enlever les séquences OCR parasites
    cleaned = re.sub(r'[O0]{2,}[\s]*[LIJ]{2,}[\s]*[J]{1,}', '', cleaned, flags=re.IGNORECASE)
    # Enlever les caractères de contrôle
    cleaned = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F]', '', cleaned)
    # Enlever les lignes qui ne contiennent que du bruit
    cleaned = re.sub(r'^\W+$', '', cleaned, flags=re.MULTILINE)
    # Nettoyer les espaces restants
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned
```

#### Fix 2: Aggressive cleaning in `server.mjs`
```javascript
// Apply cleanOcrText to ALL source text (not just image OCR)
let sourceText = [incoming.manualText || "", ...sourceParts].filter(Boolean).join("\n\n");
sourceText = cleanOcrText(sourceText);  // Clean at the source
```

#### Fix 3: Validation before export in `lib/export-workbook.mjs`
```javascript
// Validate that sourceExcerpt isn't mostly noise
let sourceExcerpt = "";
if (entryCopy.sourceText) {
  const excerpt = entryCopy.sourceText.slice(0, options.mode === "detailed" ? 900 : 520);
  // Check that at least 30% is normal text (not noise)
  const cleanChars = excerpt.replace(/[^a-zà-ÿ0-9]/gi, "");
  const ratio = cleanChars.length / excerpt.length;
  if (ratio >= 0.3) {
    sourceExcerpt = excerpt;  // Use clean text
  }
}
if (!sourceExcerpt) {
  sourceExcerpt = "Source non fournie";  // Fallback for noisy text
}
```

---

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| `lib/export-workbook.mjs` | Fix `writeMerged()` to only set first cell | ✅ Eliminates duplicate merged cell values |
| `scripts/extract_recap.py` | Add OCR noise cleaning to `collapse()` | ✅ Cleans corrupted PDF text at source |
| `server.mjs` | Apply `cleanOcrText()` to ALL source text | ✅ Double protection against noise |
| `lib/export-workbook.mjs` | Add validation before writing sourceExcerpt | ✅ Rejects noise before export |

---

## Testing Checklist

- [ ] Export a new Excel file
- [ ] Verify headers are NOT duplicated (only appear once per merged cell)
- [ ] Verify each AL has correct unique bullet points
- [ ] Verify source text is clean (no "O SE O LLJ" corruption)
- [ ] If source is noisy, it shows "Source non fournie"
- [ ] Run extract_recap.py on test PDF and check output
- [ ] Verify legitimate French text is preserved
- [ ] Verify no data duplication between AL 1, AL 2, AL 3

---

## Files Modified
- `lib/export-workbook.mjs` - writeMerged() function, writeEntryBlock() validation
- `scripts/extract_recap.py` - collapse() function with OCR cleaning
- `server.mjs` - sourceText cleaning

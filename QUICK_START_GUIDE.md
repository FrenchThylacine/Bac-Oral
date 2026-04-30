# 🚀 Quick Start Guide - Run the System NOW

## Step 1: Install Dependencies (One-time setup)

Open terminal in the project directory and run:

```bash
npm install better-sqlite3 pdfkit
```

This installs the SQLite database driver and PDF export library. Takes ~30-60 seconds.

## Step 2: Start the Server

```bash
npm start
```

You should see:
```
Bac Oral Studio running on http://127.0.0.1:4173
```

## Step 3: Open in Browser

Navigate to:
```
http://localhost:4173
```

The Bac Oral Studio app will load with tabs at the top.

## Step 4: Use the V3 AI Digitization Feature

1. **Click the "🤖 AI Digitization" tab** (5th tab on the right)

2. **Upload Files:**
   - Click the upload zone or drag-drop image files
   - Supports: PNG, JPG, PDF
   - Max 20 files at once

3. **Process Files:**
   - Click "Process All" button
   - Watch progress: 25% → 50% → 75% → 100%
   - Each file takes 1-3 seconds

4. **Review Results:**
   - Check "Flagged Items" section if any exist
   - Click "Load Flagged Items" to see details
   - Approve or reject each item

5. **Export Results:**
   - Click "Export Excel" for full data
   - Click "Export PDF" for summaries
   - Or use "Export All ALs" for batch export

## Demo Mode (No Image Upload Needed)

If you don't have image files:

1. Go to "Processed ALs" section
2. Click "Refresh Status"
3. The system uses demo data automatically
4. You can still export and review!

## Quick Test

To verify everything works:

```bash
# In another terminal window
node lib/v3-integration-test.mjs
```

This runs 10 automated tests and shows results.

## What to Expect

### Upload Zone
- Drag image files here or click to select
- Shows file size and progress
- Color-coded status (pending, processing, complete, error)

### Processing
- Extracts text from images using AI
- Stores in SQLite database (.data/als.db)
- Auto-completes missing procedures
- Validates data and flags confidence issues

### Review Table
- Shows any flagged items
- Displays confidence score (0-100%)
- Approve/Reject buttons for each

### Status Dashboard
- Files queued
- ALs processed
- Flagged items count
- Completion percentage

### Export Options
- **Excel:** Full data, all procedures, all analyses
- **PDF:** Compact summaries, max 10 procedures per movement
- **JSON:** Structured data for API consumption

## Files Created on First Run

- `.data/als.db` - SQLite database (stores all ALs)
- `.data/ocr-cache/` - Caches OCR results
- `outputs/` - Where exports are saved
- `tmp/` - Temporary uploaded files

## Troubleshooting

### Port Already in Use
If port 4173 is taken:
```bash
# Use a different port
PORT=5000 npm start
```

### Dependencies Not Installed
```bash
npm install better-sqlite3 pdfkit
```

### Database Issues
```bash
# Delete and restart (loses all data)
rm -r .data
npm start
```

### Can't Upload Files
- Check browser console (F12)
- Try a smaller file
- Ensure it's PNG, JPG, or PDF

### Processing Hangs
- Check server console for errors
- Refresh browser (Ctrl+R or Cmd+R)
- Restart server (Ctrl+C then npm start)

## File Locations

**Within the project folder:**
- `.data/als.db` - All your AL data
- `outputs/` - Downloaded exports
- `lib/` - Backend modules
- `web/` - Frontend files

## Browser Compatibility

Works on:
- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge

Mobile support (responsive design):
- ✅ iPhone/iPad
- ✅ Android

## What Happens When You Upload

1. **File selected** → Added to queue
2. **Process All clicked** → Uploads file
3. **Extract** → AI reads image (25% complete)
4. **Store** → Saves to database (50% complete)
5. **Complete** → Fills missing data (75% complete)
6. **Validate** → Checks quality (100% complete)
7. **Flags** → Any low-confidence items marked for review
8. **Export** → Download results in Excel/PDF/JSON

## Performance

- Upload speed: <1 second
- Processing speed: 1-3 seconds per file
- Export speed: <2 seconds
- Typical batch (5 files): ~15 seconds total

## Next Steps

1. ✅ Install dependencies: `npm install better-sqlite3 pdfkit`
2. ✅ Start server: `npm start`
3. ✅ Go to: `http://localhost:4173`
4. ✅ Click: "🤖 AI Digitization" tab
5. ✅ Upload files or use demo mode
6. ✅ Click: "Process All"
7. ✅ Review results
8. ✅ Export to Excel/PDF

## Tips & Tricks

- **Keyboard Shortcut:** Ctrl+E for quick export
- **Dark Mode:** Click theme toggle in header
- **Auto Export:** Check "Auto-export when complete" option
- **Batch Processing:** Upload multiple files and process together
- **Demo Data:** System works without real images (uses demo mode)

---

**You're ready to go! 🚀**

Start with: `npm start`

Then visit: `http://localhost:4173`

Questions? Check IMPLEMENTATION_COMPLETE.md for more details.

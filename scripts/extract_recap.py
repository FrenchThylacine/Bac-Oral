# scripts/extract_recap.py
# FIX: pypdf fallback chain, never crashes, always returns valid JSON
import sys
import json
import re
import os

# ── PDF reader with fallback chain ────────────────────────────
PdfReader = None
try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        PdfReader = None

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF with fallback methods."""
    if PdfReader is None:
        # Last resort: read raw bytes and extract ASCII strings
        return extract_text_raw(pdf_path)
    try:
        reader = PdfReader(pdf_path)
        pages = []
        for page in reader.pages:
            try:
                text = page.extract_text()
                if text:
                    pages.append(text)
            except Exception:
                continue
        return "\n".join(pages)
    except Exception as e:
        sys.stderr.write(f"PDF read error: {e}\n")
        return extract_text_raw(pdf_path)

def extract_text_raw(pdf_path):
    """Fallback: extract readable strings from raw PDF bytes."""
    try:
        with open(pdf_path, "rb") as f:
            content = f.read()
        # Find readable text strings between parentheses (PDF format)
        strings = re.findall(rb'\(([^\)]{3,80})\)', content)
        readable = []
        for s in strings:
            try:
                decoded = s.decode("latin-1", errors="ignore")
                if sum(c.isalpha() for c in decoded) > len(decoded) * 0.5:
                    readable.append(decoded)
            except Exception:
                continue
        return "\n".join(readable)
    except Exception:
        return ""

# ── Parse structure from text ─────────────────────────────────
def parse_recap_structure(text):
    """Parse sequence and AL structure from recap text."""
    sequences = []
    current_seq = None
    al_counter = 1

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    for line in lines:
        line_lower = line.lower()

        # Detect sequence headers
        is_seq = (
            re.match(r"s[eé]quence\s*\d", line_lower) or
            re.match(r"^(th[eé][âa]tre|po[eé]sie|roman|lecture)", line_lower) or
            (len(line) < 80 and line.isupper() and len(line) > 10)
        )

        if is_seq:
            seq_num = len(sequences) + 1
            genre = detect_genre(line_lower)
            current_seq = {
                "id": f"seq-{seq_num}",
                "label": f"Séquence {seq_num} — {line[:60]}",
                "genre": genre,
                "oeuvre": "",
                "auteur": "",
                "texts": [],
            }
            sequences.append(current_seq)
            continue

        # Detect AL entries
        al_match = re.match(r"(al|texte|lecture)\s*(\d+)[:\.\-–]?\s*(.*)", line_lower)
        if al_match and current_seq is not None:
            al_num = int(al_match.group(2)) if al_match.group(2).isdigit() else al_counter
            al_title = al_match.group(3).strip() or line
            current_seq["texts"].append({
                "id": f"AL-{al_counter}",
                "label": f"AL {al_counter}",
                "title": al_title[:80],
                "author": current_seq.get("auteur", ""),
                "work": current_seq.get("oeuvre", ""),
            })
            al_counter += 1
            continue

        # Detect author/work lines
        if current_seq is not None and not current_seq.get("oeuvre"):
            if re.search(r"(musset|rimbaud|hugo|flaubert|molière|racine|baudelaire|verlaine|zola)", line_lower):
                current_seq["auteur"] = line[:60]

    # If no sequences detected, create a default one
    if not sequences:
        sequences = [{
            "id": "seq-1",
            "label": "Séquence 1",
            "genre": "general",
            "oeuvre": "",
            "auteur": "",
            "texts": [],
        }]
        # Try to extract any AL-like entries from the text
        for i, line in enumerate(lines[:30]):
            if len(line) > 10:
                sequences[0]["texts"].append({
                    "id": f"AL-{i+1}",
                    "label": f"AL {i+1}",
                    "title": line[:80],
                    "author": "",
                    "work": "",
                })

    return sequences

def detect_genre(text):
    if any(w in text for w in ["théâtre", "theatre", "scène", "acte", "comédie", "tragédie"]):
        return "theatre"
    if any(w in text for w in ["poésie", "poesie", "poème", "vers", "sonnet"]):
        return "poesie"
    if any(w in text for w in ["roman", "récit", "nouvelle", "chapitre"]):
        return "roman"
    return "general"

# ── Main ──────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided", "sequences": []}))
        return

    pdf_path = sys.argv[1]

    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}", "sequences": []}))
        return

    try:
        text = extract_text_from_pdf(pdf_path)
        sequences = parse_recap_structure(text)

        al_total = sum(len(s["texts"]) for s in sequences)

        result = {
            "fileName": os.path.basename(pdf_path),
            "sequenceCount": len(sequences),
            "textCount": al_total,
            "sequences": sequences,
        }

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        # Never crash — always return valid JSON
        sys.stderr.write(f"Fatal error: {e}\n")
        print(json.dumps({
            "error": str(e),
            "fileName": os.path.basename(pdf_path) if len(sys.argv) > 1 else "",
            "sequenceCount": 0,
            "textCount": 0,
            "sequences": [],
        }))

if __name__ == "__main__":
    main()

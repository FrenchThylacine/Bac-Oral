from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

from pypdf import PdfReader


def normalize_text(value: str = "") -> str:
    text = unicodedata.normalize("NFC", value or "")
    replacements = {
        "\r": "",
        "\u00a0": " ",
        "\u200b": "",
        "ï\x81·": "|",
        "": "|",
        "": "|",
        "•": "|",
        "\t": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def collapse(value: str = "") -> str:
    cleaned = re.sub(r"\s+", " ", normalize_text(value)).strip()
    # Nettoyer aussi le bruit OCR dans les extraits PDF
    # Enlever les séquences de caractères non-linguistiques
    cleaned = re.sub(r'[O0]{2,}[\s]*[LIJ]{2,}[\s]*[J]{1,}', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F]', '', cleaned)
    # Enlever les lignes qui ne contiennent que du bruit
    cleaned = re.sub(r'^\W+$', '', cleaned, flags=re.MULTILINE)
    # Nettoyer les espaces restants
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def unique_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        cleaned = collapse(item)
        if not cleaned:
            continue
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        output.append(cleaned)
    return output


def parse_work(value: str) -> dict[str, str]:
    cleaned = collapse(value)
    match = re.match(r"(?P<author>[^,]+),\s*(?P<title>.*?)(?:,\s*(?P<year>\d{4}))?$", cleaned)
    if not match:
        return {"author": "", "title": cleaned, "year": ""}
    return {
        "author": collapse(match.group("author")),
        "title": collapse(match.group("title")),
        "year": match.group("year") or "",
    }


def prune_section(section: str) -> str:
    object_hits = list(re.finditer(r"Objet d['’]étude\s*:", section, flags=re.IGNORECASE))
    if len(object_hits) > 1:
        return section[: object_hits[1].start()]
    return section


def extract_field(section: str, start_pattern: str, end_patterns: list[str]) -> str:
    end_fragment = "|".join(end_patterns)
    pattern = re.compile(
        rf"{start_pattern}\s*(?P<value>.*?)(?={end_fragment}|$)",
        flags=re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(section)
    return collapse(match.group("value")) if match else ""


def split_candidate_list(value: str) -> list[str]:
    raw = normalize_text(value)
    lines = [line.strip(" |-") for line in raw.splitlines() if line.strip()]
    merged: list[str] = []
    for line in lines:
        if line.startswith("|"):
            merged.append(line.lstrip("| ").strip())
            continue
        if merged:
            merged[-1] = f"{merged[-1]} {line}".strip()
        else:
            merged.append(line.strip())

    parts: list[str] = []
    for chunk in merged:
        parts.extend(re.split(r"\||;|(?:(?<=\d{4})|(?<=\d{4},))\s+(?=[A-ZÀ-ÖØ-Þ])", chunk))
    return unique_keep_order(parts)


def extract_lectures(section: str) -> list[str]:
    matches = re.findall(
        r"Lectures?\s+cursives?\s*:?\s*(.*?)(?=Séquence\s+\d+|Objet d['’]étude\s*:|Texte\s+\d+\s*:?\s*|$)",
        section,
        flags=re.IGNORECASE | re.DOTALL,
    )
    output: list[str] = []
    for match in matches:
        output.extend(split_candidate_list(match))
    return unique_keep_order(output)


def short_excerpt(value: str) -> str:
    text = collapse(value)
    scene_match = re.search(r"(Acte\s+[IVXLC]+(?:\s*,?\s*sc(?:ène|\.)?\s*\d+)?)", text, flags=re.IGNORECASE)
    if scene_match:
        return collapse(scene_match.group(1).replace("sc.", "scène"))
    quoted_match = re.search(r"[«\"]([^»\"]+)[»\"]", text)
    if quoted_match:
        return collapse(quoted_match.group(1))
    part_match = re.search(r"(Livre|Partie|Chapitre)\s+[IVXLC\d]+", text, flags=re.IGNORECASE)
    if part_match:
        return collapse(part_match.group(0))
    return collapse(re.split(r"[:;(]", text, maxsplit=1)[0])[:120]


def looks_like_author_prefix(value: str) -> bool:
    cleaned = collapse(value)
    if not cleaned:
        return False
    if re.match(r"^(Acte|Scène|Scene|Texte|Chapitre|Partie|Livre)\b", cleaned, flags=re.IGNORECASE):
        return False
    if len(cleaned.split()) > 5:
        return False
    return bool(re.search(r"[A-Za-zÀ-ÿ]", cleaned))


def build_title(author: str, excerpt: str, work: str = "") -> str:
    if excerpt:
        return " - ".join(part for part in [author, excerpt] if part)
    return " - ".join(part for part in [author, work] if part)


def parse_text_entry(raw_value: str, sequence_work: dict[str, str], sequence_parcours: str, al_index: int) -> dict[str, str]:
    cleaned = normalize_text(raw_value)
    cleaned = re.sub(r"Parcours associé\s*:.*$", "", cleaned, flags=re.IGNORECASE)
    if sequence_parcours:
        cleaned = cleaned.replace(sequence_parcours, " ")
    cleaned = collapse(cleaned)

    author = sequence_work.get("author", "")
    work = sequence_work.get("title", "")
    excerpt = short_excerpt(cleaned)

    if "," in cleaned:
        prefix = cleaned.split(",", 1)[0]
        if looks_like_author_prefix(prefix):
            parts = [collapse(part) for part in cleaned.split(",") if collapse(part)]
            if len(parts) >= 2:
                author = parts[0]
                work = parts[1]
                excerpt = short_excerpt(", ".join(parts[2:]) or work)

    title = build_title(author, excerpt, work)

    return {
        "id": f"AL-{al_index}",
        "label": f"AL {al_index}",
        "title": title or f"AL {al_index}",
        "author": author,
        "work": work,
        "excerpt": excerpt or work,
        "raw": cleaned,
        "fullName": " – ".join(part for part in [f"AL {al_index}", title] if part),
    }


def parse_sequence(section: str, sequence_number: int, start_index: int) -> tuple[dict[str, object], int]:
    pruned = prune_section(section)
    object_study = extract_field(
        pruned,
        r"Objet d['’]étude\s*:",
        [r"Œuvre intégrale\s*:", r"Oeuvre intégrale\s*:"],
    )
    work_value = extract_field(
        pruned,
        r"(?:Œuvre intégrale|Oeuvre intégrale)\s*:",
        [r"Parcours associé\s*:", r"Texte\s+\d+\s*:", r"Lectures?\s+cursives?"],
    )
    parcours = extract_field(
        pruned,
        r"Parcours associé\s*:",
        [r"(?:Œuvre intégrale|Oeuvre intégrale)\s*:", r"Texte\s+\d+\s*:", r"Lectures?\s+cursives?"],
    )
    work = parse_work(work_value)

    texts: list[dict[str, str]] = []
    current_index = start_index

    text_matches = re.finditer(
        r"Texte\s+\d+\s*:?\s*(.*?)(?=Texte\s+\d+\s*:?\s*|Lectures?\s+cursives?\s*:?\s*|$)",
        pruned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    for match in text_matches:
        texts.append(parse_text_entry(match.group(1), work, parcours, current_index))
        current_index += 1

    sequence = {
        "id": f"SEQ-{sequence_number}",
        "label": f"Séquence {sequence_number}",
        "objectStudy": object_study,
        "work": work,
        "parcours": parcours,
        "lecturesCursives": extract_lectures(pruned),
        "texts": texts,
    }
    return sequence, current_index


def parse_recap_text(full_text: str, file_name: str = "Saisie manuelle") -> dict[str, object]:
    normalized = normalize_text(full_text)
    sequence_blocks = re.split(r"(?=Séquence\s+\d+)", normalized, flags=re.IGNORECASE)

    sequences: list[dict[str, object]] = []
    lectures: list[str] = []
    al_index = 1

    for block in sequence_blocks:
        header = re.match(r"\s*Séquence\s+(\d+)", block, flags=re.IGNORECASE)
        if not header:
            continue
        sequence_number = int(header.group(1))
        sequence, al_index = parse_sequence(block, sequence_number, al_index)
        sequences.append(sequence)
        lectures.extend(sequence.get("lecturesCursives", []))

    return {
        "fileName": file_name,
        "sequenceCount": len(sequences),
        "textCount": sum(len(sequence.get("texts", [])) for sequence in sequences),
        "lectureCursives": unique_keep_order(lectures),
        "sequences": sequences,
    }


def parse_pdf(pdf_path: Path) -> dict[str, object]:
    reader = PdfReader(str(pdf_path))
    pages = [normalize_text(page.extract_text() or "") for page in reader.pages]
    full_text = "\n".join(pages)
    return parse_recap_text(full_text, pdf_path.name)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("PDF path is required")

    pdf_path = Path(sys.argv[1])
    payload = parse_pdf(pdf_path)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()

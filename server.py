from __future__ import annotations

import base64
import json
import mimetypes
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import datetime
from html import escape
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
OUTPUT_DIR = ROOT / "outputs"
TMP_DIR = ROOT / "tmp"
NODE = Path(r"C:\Users\iyadf\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
OCR_SCRIPT = ROOT / "scripts" / "ocr_image.ps1"
EXPORT_SCRIPT = ROOT / "scripts" / "export_cli.mjs"

sys.path.insert(0, str(ROOT / "scripts"))
from extract_recap import parse_pdf, parse_recap_text  # noqa: E402


GENRE_DEFAULTS = {
    "theatre": {
        "movement_titles": ["Conflit initial", "Montée de la tension", "Vérité finale"],
        "oral_templates": [
            "parole transformée en affrontement",
            "sentiment mis à nu",
            "jeu de pouvoir amoureux",
            "bascule dramatique",
        ],
        "procedure_defaults": [
            "parole vive",
            "opposition des voix",
            "tension dramatique",
            "registre pathétique",
        ],
    },
    "poesie": {
        "movement_titles": ["Élan poétique", "Renversement des valeurs", "Liberté créatrice"],
        "oral_templates": [
            "liberté du poète",
            "réel transformé en matière poétique",
            "beauté paradoxale",
            "énergie de la voix",
        ],
        "procedure_defaults": [
            "images frappantes",
            "rythme expressif",
            "lexique sensoriel",
            "provocation créatrice",
        ],
    },
    "roman": {
        "movement_titles": ["Entrée dans l'enjeu", "Tension romanesque", "Portée du passage"],
        "oral_templates": [
            "naissance du désir",
            "portrait révélateur",
            "bascule du destin",
            "intensité romanesque",
        ],
        "procedure_defaults": [
            "point de vue marqué",
            "dramatisation du récit",
            "lexique affectif",
            "portrait valorisant ou dévalorisant",
        ],
    },
    "general": {
        "movement_titles": ["Ouverture du passage", "Tension du passage", "Sens final du passage"],
        "oral_templates": [
            "enjeu majeur du passage",
            "émotion dominante",
            "progression de l'argument",
            "effet produit sur le lecteur",
        ],
        "procedure_defaults": [
            "contraste fort",
            "rythme expressif",
            "champ lexical dominant",
        ],
    },
}


def clean_text(value: str = "") -> str:
    return str(value or "").replace("\r", "").replace("\u00a0", " ").strip()


def normalize_multiline(value: str = "") -> str:
    return re.sub(r"\n{3,}", "\n\n", clean_text(value))


def collapse(value: str = "") -> str:
    return re.sub(r"\s+", " ", normalize_multiline(value)).strip()


def decode_bytes(raw: bytes) -> str:
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="ignore")


def slugify(value: str = "") -> str:
    text = collapse(value).lower()
    text = (
        text.replace("à", "a")
        .replace("â", "a")
        .replace("ç", "c")
        .replace("é", "e")
        .replace("è", "e")
        .replace("ê", "e")
        .replace("ë", "e")
        .replace("î", "i")
        .replace("ï", "i")
        .replace("ô", "o")
        .replace("ù", "u")
        .replace("û", "u")
        .replace("ü", "u")
        .replace("œ", "oe")
    )
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def guess_genre(sequence: dict[str, Any]) -> str:
    target = collapse(
        f"{sequence.get('objectStudy', '')} {sequence.get('work', {}).get('title', '')} {sequence.get('parcours', '')}"
    ).lower()
    if any(token in target for token in ("théâtre", "theatre", "scène", "scene")):
        return "theatre"
    if any(token in target for token in ("poésie", "poesie", "poète", "poete")):
        return "poesie"
    if any(token in target for token in ("roman", "récit", "recit")):
        return "roman"
    return "general"


def split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?;:])\s+", normalize_multiline(text)) if part.strip()]


def chunk_text(text: str, target_count: int = 3) -> list[str]:
    sentences = split_sentences(text)
    if not sentences:
        return []
    chunk_count = min(target_count, 3 if len(sentences) >= 8 else 2)
    chunk_size = max(1, -(-len(sentences) // chunk_count))
    return [
        " ".join(sentences[index:index + chunk_size])
        for index in range(0, len(sentences), chunk_size)
    ][:chunk_count]


def simplify_phrase(value: str = "") -> str:
    output = normalize_multiline(value)
    for pattern in [
        r"\bon voit que\b",
        r"\bcela montre que\b",
        r"\bil y a\b",
        r"\bpermet de voir\b",
        r"\bl['’]auteur utilise\b",
        r"\ble texte montre que\b",
    ]:
        output = re.sub(pattern, "", output, flags=re.IGNORECASE)
    output = re.sub(r"\s+,", ",", output)
    output = re.sub(r"\s+\.", ".", output)
    output = re.sub(r"\s{2,}", " ", output).strip(" ,:;-")
    if not output:
        return ""
    return output[:1].lower() + output[1:]


def detect_repetitions(text: str) -> list[str]:
    words = re.findall(r"[A-Za-zÀ-ÿœ'-]{5,}", collapse(text).lower())
    counts: dict[str, int] = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return [
        word
        for word, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)
        if count >= 3
    ][:3]


def detect_procedures(text: str, genre: str) -> list[dict[str, Any]]:
    source = normalize_multiline(text)
    lowered = source.lower()
    procedures: list[dict[str, Any]] = []

    def add(label: str, impact: str, weight: int) -> None:
        procedures.append({"label": label, "impact": impact, "weight": weight})

    if "?" in source:
        add("interrogations", "certitude mise en crise", 3)
    if "!" in source:
        add("exclamations", "émotion portée au premier plan", 3)
    if re.search(r'[«»"]', source):
        add("discours direct", "parole rendue plus vive", 2)
    if re.search(r"\b(mais|pourtant|cependant|or|tandis que)\b", lowered):
        add("oppositions", "tension et renversement", 3)
    if re.search(r"\b(je|moi|me|mon|ma)\b", lowered):
        add("première personne", "subjectivité pleinement assumée", 2)
    if re.search(r"\b(amour|coeur|cœur|désir|desir|passion|souffrance|bonheur)\b", lowered):
        add("lexique affectif", "sentiment mis au centre", 3)
    if re.search(r"\b(non|jamais|rien|plus|aucun)\b", lowered):
        add("négations", "refus radical mis en avant", 2)
    if re.search(r"\b(ciel|terre|route|fontaine|soleil|nuit|bois|vent|eau|abîme|abime)\b", lowered):
        add("images du monde sensible", "réel transformé en image forte", 2)
    if re.search(r"\b(va|viens|laisse|regarde|écoute|retourne|dis|dites)\b", lowered):
        add("impératifs", "volonté d'agir ou de dominer", 2)

    repetitions = detect_repetitions(source)
    if repetitions:
        add(f"répétitions ({', '.join(repetitions)})", "obsession ou insistance", 2)

    for fallback in GENRE_DEFAULTS.get(genre, GENRE_DEFAULTS["general"])["procedure_defaults"]:
        add(fallback, "effet structurant du passage", 1)

    unique: list[dict[str, Any]] = []
    seen = set()
    for item in sorted(procedures, key=lambda current: current["weight"], reverse=True):
        if item["label"] in seen:
            continue
        seen.add(item["label"])
        unique.append(item)
    return unique[:6]


def infer_focus_title(chunk: str, genre: str, index: int) -> str:
    lowered = chunk.lower()
    defaults = GENRE_DEFAULTS.get(genre, GENRE_DEFAULTS["general"])["movement_titles"]
    if genre == "theatre":
        if "?" in chunk:
            return "Questionnement conflictuel"
        if "adieu" in lowered or "sort" in lowered:
            return "Rupture dramatique"
    if genre == "poesie":
        if "route" in lowered or "voyage" in lowered or "bohème" in lowered:
            return "Errance poétique"
        if re.search(r"\b(je|moi)\b", lowered):
            return "Affirmation de soi"
    if genre == "roman":
        if "rencontre" in lowered or "aperç" in lowered:
            return "Naissance du romanesque"
        if "mort" in lowered or "malheur" in lowered:
            return "Issue tragique"
    return defaults[index] if index < len(defaults) else f"Mouvement {index + 1}"


def build_movements(text: str, genre: str) -> list[dict[str, Any]]:
    chunks = chunk_text(text)
    if not chunks:
        defaults = GENRE_DEFAULTS.get(genre, GENRE_DEFAULTS["general"])["movement_titles"]
        return [
            {"title": defaults[0], "bullets": ["entrée dans l'enjeu du passage"], "excerpt": ""},
            {"title": defaults[1], "bullets": ["progression du conflit ou de l'idée"], "excerpt": ""},
            {"title": defaults[2], "bullets": ["sens final du passage"], "excerpt": ""},
        ]

    output: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunks):
        procedures = detect_procedures(chunk, genre)[:2]
        output.append(
            {
                "title": infer_focus_title(chunk, genre, index),
                "bullets": [simplify_phrase(item["impact"]) for item in procedures if simplify_phrase(item["impact"])] or ["enjeu du mouvement"],
                "excerpt": chunk,
            }
        )
    return output


def build_oral_bullets(text: str, genre: str, procedures: list[dict[str, Any]]) -> list[str]:
    items = [simplify_phrase(item.get("impact", "")) for item in procedures[:3]]
    items.extend(GENRE_DEFAULTS.get(genre, GENRE_DEFAULTS["general"])["oral_templates"])
    output: list[str] = []
    for item in items:
        if item and item not in output:
            output.append(item)
    return output[:4]


def sharpen_bullet(bullet: str, fallbacks: list[str]) -> str:
    cleaned = simplify_phrase(bullet)
    if not cleaned:
        return fallbacks[0] if fallbacks else ""
    if len(cleaned.split()) <= 7 and not re.search(r"\b(montre|voit|utilise|permet)\b", cleaned, flags=re.IGNORECASE):
        return cleaned
    return next((item for item in fallbacks if item), cleaned)


def ensure_complete_entry(entry: dict[str, Any], sequence: dict[str, Any]) -> dict[str, Any]:
    genre = entry.get("genre") or guess_genre(sequence)
    source_text = normalize_multiline(entry.get("sourceText") or "")
    procedures = entry.get("keyProcedures") or detect_procedures(source_text or entry.get("title", ""), genre)
    movements = entry.get("movements") or build_movements(source_text or entry.get("title", ""), genre)
    oral_bullets = entry.get("oralBullets") or build_oral_bullets(source_text, genre, procedures)

    normalized_movements = []
    for index, movement in enumerate(movements[:3]):
        bullets = [simplify_phrase(bullet) for bullet in movement.get("bullets", []) if simplify_phrase(bullet)][:3]
        normalized_movements.append(
            {
                "title": normalize_multiline(movement.get("title") or f"Mouvement {index + 1}"),
                "bullets": bullets or ["enjeu du mouvement"],
                "excerpt": normalize_multiline(movement.get("excerpt") or ""),
            }
        )

    normalized_procedures = []
    for index, procedure in enumerate(procedures[:6]):
        label = normalize_multiline(procedure.get("label") or "procédé")
        impact = simplify_phrase(procedure.get("impact") or "effet à préciser")
        normalized_procedures.append(
            {
                "label": label,
                "impact": impact,
                "weight": procedure.get("weight", 1),
                "oralLabel": f"{'Procédé-clé' if index == 0 else 'Procédé'} : {label} -> {impact}",
            }
        )

    reinforcements = [
        normalized_procedures[0]["impact"] if normalized_procedures else "",
        normalized_procedures[1]["impact"] if len(normalized_procedures) > 1 else "",
        *GENRE_DEFAULTS.get(genre, GENRE_DEFAULTS["general"])["oral_templates"],
    ]
    reinforcements = [simplify_phrase(item) for item in reinforcements if simplify_phrase(item)]

    normalized_movements = [
        {
            **movement,
            "bullets": [sharpen_bullet(bullet, reinforcements) for bullet in movement["bullets"]][:3],
        }
        for movement in normalized_movements
    ]

    normalized_oral = []
    for bullet in oral_bullets[:4]:
        cleaned = sharpen_bullet(bullet, reinforcements)
        if cleaned and cleaned not in normalized_oral:
            normalized_oral.append(cleaned)

    quality_flags = []
    if not source_text:
        quality_flags.append("missing-source-text")
    if any(len(bullet) > 60 for bullet in normalized_oral):
        quality_flags.append("bullet-too-long")
    if len(normalized_movements) < 2:
        quality_flags.append("missing-movements")

    return {
        **entry,
        "genre": genre,
        "sourceText": source_text,
        "sequenceLabel": entry.get("sequenceLabel") or sequence.get("label", ""),
        "movements": normalized_movements,
        "keyProcedures": normalized_procedures,
        "oralBullets": normalized_oral,
        "qualityFlags": quality_flags,
    }


def compute_entry_status(entry: dict[str, Any]) -> dict[str, Any]:
    has_source = bool(entry.get("sourceText"))
    has_analysis = bool(entry.get("oralBullets"))
    has_movements = bool(entry.get("movements"))
    has_export = has_analysis and has_movements
    stage_map = {
        "ocr": "done" if has_source else "waiting",
        "structuring": "done" if has_movements else "waiting",
        "analysis": "done" if has_analysis else "waiting",
        "export": "ready" if has_export else "waiting",
    }
    completed = sum(1 for value in stage_map.values() if value in {"done", "ready"})
    overall = int(completed / 4 * 100)
    if has_analysis and has_source:
        message = "Fiche prête à relire"
    elif has_source:
        message = "Source détectée, structuration en cours"
    else:
        message = "Ajoute une image ou une transcription"
    return {
        **stage_map,
        "overall": overall,
        "message": message,
        "updatedAt": datetime.utcnow().isoformat() + "Z",
    }


def apply_action(entries: list[dict[str, Any]], action: str) -> list[dict[str, Any]]:
    updated: list[dict[str, Any]] = []
    for entry in entries:
        if action == "highlight":
            entry["keyProcedures"] = sorted(
                entry.get("keyProcedures", []),
                key=lambda item: item.get("weight", 0),
                reverse=True,
            )
        elif action == "simplify":
            entry["oralBullets"] = [simplify_phrase(bullet) for bullet in entry.get("oralBullets", []) if simplify_phrase(bullet)][:4]
            for movement in entry.get("movements", []):
                movement["bullets"] = [simplify_phrase(bullet) for bullet in movement.get("bullets", []) if simplify_phrase(bullet)][:3]
        elif action == "fix-weak":
            fallbacks = [item.get("impact", "") for item in entry.get("keyProcedures", [])[:2]]
            fallbacks = [simplify_phrase(item) for item in fallbacks if simplify_phrase(item)]
            for movement in entry.get("movements", []):
                movement["bullets"] = [sharpen_bullet(bullet, fallbacks) for bullet in movement.get("bullets", [])][:3]
            entry["oralBullets"] = [sharpen_bullet(bullet, fallbacks) for bullet in entry.get("oralBullets", [])][:4]
        updated.append(entry)
    return updated


def data_url_to_bytes(data_url: str) -> bytes:
    if "," not in data_url:
        return b""
    return base64.b64decode(data_url.split(",", 1)[1])


def run_ocr(file_name: str, data_url: str) -> str:
    suffix = Path(file_name or "upload.png").suffix or ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=TMP_DIR) as handle:
        handle.write(data_url_to_bytes(data_url))
        temp_path = Path(handle.name)
    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(OCR_SCRIPT),
                "-Path",
                str(temp_path),
            ],
            capture_output=True,
            check=True,
        )
        return normalize_multiline(decode_bytes(result.stdout))
    finally:
        temp_path.unlink(missing_ok=True)


def process_project(project: dict[str, Any], run_ocr_flag: bool = True) -> dict[str, Any]:
    sequence_map = {sequence["id"]: sequence for sequence in project.get("sequences", [])}
    processed_entries = []

    for incoming in project.get("entries", []):
        sequence = sequence_map.get(incoming.get("sequenceId"), incoming.get("sequenceMeta", {}) or {})
        files = []
        source_parts = [incoming.get("manualText", "")]

        for file in incoming.get("files", []):
            ocr_text = file.get("ocrText", "")
            if run_ocr_flag and file.get("dataUrl"):
                try:
                    ocr_text = run_ocr(file.get("name", ""), file.get("dataUrl", ""))
                except Exception:
                    ocr_text = file.get("ocrText", "")
            file_status = "done" if ocr_text else "waiting"
            files.append({**file, "ocrText": ocr_text, "status": file_status})
            if ocr_text:
                source_parts.append(ocr_text)

        draft = ensure_complete_entry(
            {
                **incoming,
                "files": files,
                "sequenceMeta": sequence,
                "sequenceLabel": sequence.get("label", incoming.get("sequenceLabel", "")),
                "sourceText": "\n\n".join(part for part in source_parts if part).strip(),
            },
            sequence,
        )
        draft["status"] = compute_entry_status(draft)
        processed_entries.append(draft)

    project_summary = build_project_summary(processed_entries)
    return {**project, "entries": processed_entries, "projectSummary": project_summary}


def build_project_summary(entries: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(entries)
    ready = len([entry for entry in entries if len(entry.get("oralBullets", [])) >= 3])
    with_source = len([entry for entry in entries if entry.get("sourceText")])
    average_progress = int(sum(entry.get("status", {}).get("overall", 0) for entry in entries) / total) if total else 0
    return {
        "total": total,
        "ready": ready,
        "withSource": with_source,
        "averageProgress": average_progress,
    }


def export_workbook_from_python(payload: dict[str, Any]) -> dict[str, Any]:
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json", dir=TMP_DIR, encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)
        temp_json = Path(handle.name)
    try:
        result = subprocess.run(
            [str(NODE), str(EXPORT_SCRIPT), str(temp_json), str(OUTPUT_DIR)],
            capture_output=True,
            check=True,
        )
        return json.loads(decode_bytes(result.stdout))
    finally:
        temp_json.unlink(missing_ok=True)


def filter_entries_for_scope(project: dict[str, Any], scope: dict[str, Any]) -> list[dict[str, Any]]:
    entries = project.get("entries", [])
    scope_type = scope.get("type", "full")
    scope_value = scope.get("value")
    if scope_type == "single":
        return [entry for entry in entries if entry.get("id") == scope_value]
    if scope_type == "sequence":
        return [entry for entry in entries if entry.get("sequenceId") == scope_value]
    return entries


def build_pdf_export(payload: dict[str, Any]) -> dict[str, Any]:
    project = payload.get("project", {})
    scope = payload.get("scope", {"type": "full"})
    options = payload.get("options", {})
    entries = filter_entries_for_scope(project, scope)
    entries = [ensure_complete_entry(entry, entry.get("sequenceMeta", {})) for entry in entries]

    file_name = f"bac-oral-{slugify(scope.get('value') or scope.get('type') or 'full')}-{int(datetime.utcnow().timestamp() * 1000)}.pdf"
    file_path = OUTPUT_DIR / file_name

    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    title_style.textColor = colors.HexColor("#17324D")
    heading_style = ParagraphStyle(
        "SequenceHeading",
        parent=styles["Heading1"],
        textColor=colors.HexColor("#0F766E"),
        spaceBefore=10,
        spaceAfter=8,
    )
    al_style = ParagraphStyle(
        "AlHeading",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#B45309"),
        spaceBefore=8,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyCopy",
        parent=styles["BodyText"],
        fontSize=9.5,
        leading=12,
    )

    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=A4,
        leftMargin=1.3 * cm,
        rightMargin=1.3 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )

    story: list[Any] = []
    story.append(Paragraph("Bac Oral Studio - Révision complète", title_style))
    story.append(Spacer(1, 0.25 * cm))
    story.append(
        Paragraph(
            escape(
                " | ".join(
                    [
                        f"Séquence active : {project.get('selectedSequenceLabel') or 'Toutes'}",
                        f"Lecture cursive : {project.get('selectedLectureCursive') or 'Non renseignée'}",
                        f"Mode : {options.get('mode', 'minimalist')}",
                    ]
                )
            ),
            body_style,
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        grouped[entry.get("sequenceId") or "sequence"].append(entry)

    first_group = True
    for sequence_entries in grouped.values():
        if not first_group:
            story.append(PageBreak())
        first_group = False

        first_entry = sequence_entries[0]
        sequence_label = first_entry.get("sequenceLabel") or first_entry.get("sequenceMeta", {}).get("label", "Séquence")
        meta_parts = [
            first_entry.get("sequenceMeta", {}).get("objectStudy", ""),
            first_entry.get("sequenceMeta", {}).get("work", {}).get("author", ""),
            first_entry.get("sequenceMeta", {}).get("work", {}).get("title", ""),
            first_entry.get("sequenceMeta", {}).get("parcours", ""),
        ]

        story.append(Paragraph(escape(sequence_label), heading_style))
        story.append(Paragraph(escape(" | ".join(part for part in meta_parts if part)), body_style))
        story.append(Spacer(1, 0.2 * cm))

        for entry in sequence_entries:
            story.append(Paragraph(escape(f"{entry.get('label')} - {entry.get('title')}"), al_style))

            movement_lines = "<br/>".join(
                escape(f"{movement.get('title')}: " + " / ".join(movement.get("bullets", [])))
                for movement in entry.get("movements", [])[:3]
            ) or "Mouvements à compléter"
            procedure_lines = "<br/>".join(
                escape(f"{procedure.get('label')} -> {procedure.get('impact')}")
                for procedure in entry.get("keyProcedures", [])[:5]
            ) or "Procédés à générer"
            oral_lines = "<br/>".join(escape(f"• {bullet}") for bullet in entry.get("oralBullets", [])[:4]) or "Version orale à compléter"

            table = Table(
                [
                    ["Mouvements", "Procédés clés", "Réemploi oral"],
                    [
                        Paragraph(movement_lines, body_style),
                        Paragraph(procedure_lines, body_style),
                        Paragraph(oral_lines, body_style),
                    ],
                ],
                colWidths=[5.9 * cm, 5.4 * cm, 5.2 * cm],
            )
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF4")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#17324D")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#C9D6E1")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(table)
            story.append(Spacer(1, 0.18 * cm))

            source_text = entry.get("sourceText") or "Source non fournie"
            story.append(
                Paragraph(
                    escape(f"Rappel du passage : {source_text[:500]}"),
                    ParagraphStyle("SourceText", parent=body_style, textColor=colors.HexColor("#486581"), italic=True),
                )
            )
            story.append(Spacer(1, 0.26 * cm))

    doc.build(story)
    return {"fileName": file_name, "filePath": str(file_path)}


class BacOralHandler(BaseHTTPRequestHandler):
    server_version = "BacOralStudio/0.2"

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json({"ok": True})
            return
        if parsed.path.startswith("/outputs/"):
            self.serve_file(OUTPUT_DIR / unquote(parsed.path.replace("/outputs/", "", 1)))
            return
        if parsed.path == "/":
            self.serve_file(WEB_DIR / "index.html")
            return
        self.serve_file(WEB_DIR / parsed.path.lstrip("/"))

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            payload = self.read_json_body()
            if parsed.path == "/api/recap/parse":
                self.handle_recap_parse(payload)
                return
            if parsed.path == "/api/process":
                processed = process_project(payload.get("project", {}), payload.get("options", {}).get("runOcr", True))
                self.send_json(processed)
                return
            if parsed.path == "/api/action":
                project = payload.get("project", {})
                project["entries"] = apply_action(project.get("entries", []), payload.get("action", ""))
                project["projectSummary"] = build_project_summary(project["entries"])
                self.send_json(project)
                return
            if parsed.path == "/api/export":
                export_format = payload.get("format", "xlsx")
                if export_format == "pdf":
                    exported = build_pdf_export(payload)
                else:
                    exported = export_workbook_from_python(payload)
                self.send_json({**exported, "downloadUrl": f"/outputs/{exported['fileName']}"})
                return
            self.send_json({"error": "Not found"}, status=404)
        except Exception as error:  # noqa: BLE001
            self.send_json({"error": str(error)}, status=500)

    def handle_recap_parse(self, payload: dict[str, Any]) -> None:
        manual_text = payload.get("manualText", "")
        if manual_text:
            self.send_json(parse_recap_text(manual_text, "Saisie manuelle"))
            return

        data = data_url_to_bytes(payload.get("fileBase64", ""))
        suffix = Path(payload.get("fileName") or "recap.pdf").suffix or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=TMP_DIR) as handle:
            handle.write(data)
            temp_pdf = Path(handle.name)
        try:
            self.send_json(parse_pdf(temp_pdf))
        finally:
            temp_pdf.unlink(missing_ok=True)

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = decode_bytes(self.rfile.read(length)) if length else "{}"
        return json.loads(raw or "{}")

    def serve_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_json({"error": "Not found"}, status=404)
            return
        content_type, _ = mimetypes.guess_type(str(path))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.end_headers()
        self.wfile.write(path.read_bytes())

    def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    TMP_DIR.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 4173), BacOralHandler)
    print("Bac Oral Studio running on http://127.0.0.1:4173")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

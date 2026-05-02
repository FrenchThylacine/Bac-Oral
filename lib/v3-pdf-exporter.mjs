// lib/v3-pdf-exporter.mjs — Clean PDF output for AL memorization v4.0
import path from "node:path";
import fs from "node:fs/promises";
import PDFDocument from 'pdfkit';

const GENRE_COLORS = {
  theatre: "#4C1D95",
  poesie: "#1E3A8A",
  roman: "#7F1D1D",
  general: "#14532D",
};

function getGenreColor(genre) {
    return GENRE_COLORS[genre] || GENRE_COLORS.general;
}

function drawHeader(doc, al) {
    const color = getGenreColor(al.genre);
    const headerText = `${al.label || 'AL'} — ${al.author?.toUpperCase()} — ${al.title}`;

    doc.font('Helvetica-Bold').fontSize(14).fillColor(color)
       .text(headerText, 40, 40, { align: 'center' });

    doc.moveTo(40, 65).lineTo(doc.page.width - 40, 65).strokeColor('#333333').stroke();
    return 80;
}

function drawSection(doc, y, title) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
       .text(title, 40, y);
    return y + 20;
}

function drawBullet(doc, y, text) {
    const height = doc.heightOfString(text, { width: doc.page.width - 100 });
    if (y + height > doc.page.height - 40) {
        doc.addPage({ margin: 40 });
        y = 40;
    }
    doc.font('Helvetica').fontSize(10).text(`•  ${text}`, 60, y, { width: doc.page.width - 100 });
    return y + height + 5;
}

function renderALPage(doc, al) {
    doc.addPage({ margin: 40 });
    let y = drawHeader(doc, al);

    // Introduction
    y = drawSection(doc, y, 'INTRODUCTION');
    const intro = al.introduction;
    y = drawBullet(doc, y, intro.auteurContexte);
    y = drawBullet(doc, y, intro.oeuvrePassage);
    const problematiqueText = `Problématique: ${intro.problematique}`;
    y = drawBullet(doc, y, problematiqueText);
    const planText = `Plan: ${al.movements.map(m => m.title).join(' / ')}`;
    y = drawBullet(doc, y, planText);
    y += 15;

    // Mouvements
    for (const mov of al.movements) {
        y = drawSection(doc, y, `MOUVEMENT ${mov.number} — ${mov.title.toUpperCase()}`);
        doc.font('Helvetica-Oblique').fontSize(10).text(mov.phraseTheme, 60, y, { width: doc.page.width - 100 });
        y += doc.heightOfString(mov.phraseTheme, { width: doc.page.width - 100 }) + 10;

        for (const proc of mov.procedures) {
            const procText = `${proc.label} → ${proc.analysis}`;
            y = drawBullet(doc, y, procText);
        }
        y += 15;
    }

    // Conclusion
    y = drawSection(doc, y, 'CONCLUSION');
    const concl = al.conclusion;
    y = drawBullet(doc, y, concl.cheminement);
    const reponseText = `Réponse: ${concl.reponse}`;
    y = drawBullet(doc, y, reponseText);
    if (concl.ouverture) {
        const ouvertureText = `Ouverture: ${concl.ouverture}`;
        y = drawBullet(doc, y, ouvertureText);
    }
}

export async function exportPDF({ entries = [], outputDir, alId }) {
    if (!entries.length) {
        throw new Error("No ALs to export");
    }

    let toExport = alId ? entries.filter(e => e.id === alId) : entries;
    if (!toExport.length) {
        throw new Error(`No AL found with id ${alId}`);
    }

    const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: { Title: "Bac Oral Studio — Fiches de révision", Author: "Bac Oral Studio" },
    });

    const fileName = `bac-oral-full-${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);
    await fs.mkdir(outputDir, { recursive: true });

    const { createWriteStream } = await import("node:fs");
    const stream = createWriteStream(filePath);
    doc.pipe(stream);
    
    // Remove the default first page
    doc.on('pageAdded', () => {
        if (doc.bufferedPageRange().count === 1 && doc.bufferedPageRange().start === 0) {
            delete doc._pageBuffer[0];
            doc._pageBuffer.shift();
        }
    });

    toExport.forEach(al => renderALPage(doc, al));

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on("finish", () => resolve({ fileName, filePath }));
        stream.on("error", reject);
    });
}

/**
 * V3 Claude-based Extraction - Use Claude vision to extract AL structure
 * Provides elite-quality extraction with AI reasoning
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `Tu es un expert en analyse littéraire française pour le Bac oral de Première.
Analyse cette image d'une feuille d'analyse littéraire manuscrite.

Détecte et retourne UNIQUEMENT ce JSON (sans markdown, sans bloc de code):
{
  "title": "titre du texte",
  "author": "auteur ou Inconnu",
  "genre": "theatre|poesie|roman|general",
  "introduction": "texte de l'introduction (2-3 phrases)",
  "conclusion": "texte de la conclusion (2-3 phrases)",
  "movements": [
    {
      "number": 1,
      "title": "titre du mouvement",
      "lines": "vers/lignes concernés",
      "procedures": [
        {
          "label": "nom du procédé",
          "quote": "citation du texte",
          "analysis": "interprétation en formulation orale nominale",
          "weight": 1,
          "colorDetected": "couleur du surlignage si visible"
        }
      ]
    }
  ],
  "oralBullets": ["formulation orale 1", "formulation orale 2"],
  "qualityFlags": []
}

Règles:
- Analyses: formulations NOMINALES oralement réutilisables (ex: "tension dramatique déployée")
- PAS de phrases descriptives, seulement bilans interprétatifs
- Si procédé manque d'analyse, génère-en une cohérente
- Si intro/conclusion absente, génère-en une contextuelle
- Max 4 bullets par mouvement
- Regroupe les procédés similaires
- Retourne UNIQUEMENT le JSON, rien d'autre`;

export async function extractWithClaude(imagePath) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[Claude Extractor] No API key - falling back to demo mode');
    return getDemoAL(imagePath);
  }

  try {
    const imageData = readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Analyse cette image',
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('No text response from Claude');

    const jsonText = content.text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
    const parsed = JSON.parse(jsonText);

    return {
      id: `AL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: parsed.title || 'Untitled AL',
      author: parsed.author || 'Unknown',
      genre: parsed.genre || 'general',
      intro: parsed.introduction || '',
      conclusion: parsed.conclusion || '',
      ouverture: `Analysis of ${parsed.title || 'Untitled'}`,
      movements: (parsed.movements || []).map(m => ({
        number: m.number || 0,
        name: m.title || 'Untitled Movement',
        lines: m.lines || '',
        procedures: (m.procedures || []).map(p => ({
          label: p.label || p.name || 'Procédé',
          name: p.label || p.name || 'Procédé',
          quote: p.quote || '',
          analysis: p.analysis || '',
          analyses: p.analysis ? [p.analysis] : [],
          weight: p.weight || 1,
          colorDetected: p.colorDetected || '',
        })),
      })),
      oralBullets: parsed.oralBullets || [],
      qualityFlags: parsed.qualityFlags || [],
      metadata: {
        source: imagePath,
        extractedAt: new Date().toISOString(),
        method: 'claude-vision',
        completionPercent: 85,
        flaggedCount: 0,
      },
    };
  } catch (err) {
    console.error('[Claude Extractor] Error:', err.message);
    return getDemoAL(imagePath);
  }
}

function getDemoAL(sourceFile) {
  return {
    id: `AL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: 'Analyse Littéraire - Démonstration',
    author: 'Auteur inconnu',
    genre: 'general',
    intro: 'Cet extrait illustre les thèmes centraux de l\'œuvre avec une attention particulière aux procédés littéraires.',
    conclusion: 'Cette analyse révèle la complexité narrative et les techniques employées pour créer l\'impact émotionnel.',
    ouverture: 'Analyse de la structure narrative',
    movements: [
      {
        number: 1,
        name: 'Mise en place',
        lines: 'Vers/Lignes 1-20',
        procedures: [
          {
            label: 'Métaphore',
            name: 'Métaphore',
            quote: 'La vie est un voyage...',
            analysis: 'Assimilation de la vie au voyage',
            analyses: ['Assimilation de la vie au voyage'],
            weight: 3,
            colorDetected: 'blue',
          },
          {
            label: 'Énumération',
            name: 'Énumération',
            quote: '...',
            analysis: 'Énumération du contexte',
            analyses: ['Énumération du contexte'],
            weight: 2,
            colorDetected: 'yellow',
          },
        ],
      },
      {
        number: 2,
        name: 'Développement',
        lines: 'Vers/Lignes 21-40',
        procedures: [
          {
            label: 'Paradoxe',
            name: 'Paradoxe',
            quote: '...',
            analysis: 'Tension entre deux éléments opposés',
            analyses: ['Tension entre deux éléments opposés'],
            weight: 4,
            colorDetected: 'red',
          },
        ],
      },
    ],
    oralBullets: [
      'Tension narrative construite progressivement',
      'Personnages évoluant dans le conflit',
      'Résolution thématique en fin de séquence',
    ],
    qualityFlags: [],
    metadata: {
      source: sourceFile,
      extractedAt: new Date().toISOString(),
      method: 'demo',
      completionPercent: 85,
      flaggedCount: 0,
    },
  };
}

export { getDemoAL };

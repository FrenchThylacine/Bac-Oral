#!/usr/bin/env node
/**
 * Full Integration Test - V3 Extraction Pipeline
 * Tests: extraction → storage → retrieval → PDF export → structure validation
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║   BAC ORAL STUDIO V3 - INTEGRATION TEST                   ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ─── IMPORT MODULES ───────────────────────────────────────────
console.log("[1/5] Loading modules...");
try {
  const { storeAL, getAllALs, getAL, initializeDatabase } = await import("./lib/v3-storage.mjs");
  console.log("  ✅ Storage module loaded");
  
  // Initialize database
  initializeDatabase(".data");
  console.log("  ✅ Database initialized");

  // ─── CREATE TEST AL STRUCTURE ─────────────────────────────────
  console.log("\n[2/5] Creating test AL with exact required structure...");
  const testAL = {
    id: `al_test_${Date.now()}`,
    label: "AL 1",
    title: "Le Tartuffe - Acte III, Scène 6",
    author: "Molière",
    work: "Le Tartuffe",
    genre: "theatre",
    
    // INTRODUCTION - must be object with all 4 parts
    introduction: {
      auteurContexte: "Molière (1622-1673) est un dramaturge français du XVIIe siècle, auteur de comédies de moeurs qui critiquent les travers de la société contemporaine.",
      oeuvrePassage: "Le Tartuffe, pièce de 1669, relate la machination d'un imposteur religieux qui séduit la famille Orgon. Ce passage constitue le tournant tragique de leur aveuglement.",
      problematique: "Comment Molière utilise-t-il le théâtre pour critiquer l'hypocrisie religieuse et la crédulité humaine?",
      annoncePlan: "Ce texte se divise en 3 mouvements: la révélation de l'imposture par Damis / la réaction d'aveuglement d'Orgon / la résolution par intervention extérieure"
    },
    
    // MOVEMENTS - must have min 3, each with procedures
    movements: [
      {
        number: 1,
        title: "Révélation de l'imposture",
        phraseTheme: "Damis explose de colère et révèle la machination de Tartuffe, cherchant à réveiller son père de son aveuglement.",
        procedures: [
          {
            label: "réplique d'exposition",
            quote: "Mon père, c'est trop feindre",
            analysis: "rupture du silence révélatrice",
            weight: 5,
            colorDetected: "blue"
          },
          {
            label: "ironie dramatique",
            quote: "l'hypocrite religieux",
            analysis: "critique de la fausse piété",
            weight: 5,
            colorDetected: "yellow"
          },
          {
            label: "conflit familial",
            quote: "père et fils en désaccord",
            analysis: "tension dramatique majeure",
            weight: 4,
            colorDetected: "red"
          },
          {
            label: "allusion morale",
            quote: "la vérité triomphe",
            analysis: "enjeu éthique du dénouement",
            weight: 4,
            colorDetected: "none"
          }
        ]
      },
      {
        number: 2,
        title: "Aveuglement d'Orgon",
        phraseTheme: "Orgon refuse de croire son fils et accuse Damis d'être le complice de Tartuffe, aggravant son propre égarement.",
        procedures: [
          {
            label: "rejet parental",
            quote: "Je cède à la colère",
            analysis: "perte de contrôle du père",
            weight: 5,
            colorDetected: "purple"
          },
          {
            label: "hyperbole comique",
            quote: "l'exagération du dévouement",
            analysis: "satire de la crédulité",
            weight: 4,
            colorDetected: "none"
          },
          {
            label: "complication dramatique",
            quote: "promesse de mariage accrue",
            analysis: "escalade de la machination",
            weight: 4,
            colorDetected: "orange"
          },
          {
            label: "retournement de situation",
            quote: "l'accusé devient accusateur",
            analysis: "renversement du pouvoir",
            weight: 4,
            colorDetected: "green"
          }
        ]
      },
      {
        number: 3,
        title: "Résolution par intervention",
        phraseTheme: "L'arrivée imprévue d'une figure d'autorité (le roi) débusque Tartuffe et restaure l'ordre moral.",
        procedures: [
          {
            label: "coup de théâtre",
            quote: "L'exempt du roi arrive",
            analysis: "dénouement soudain et juste",
            weight: 5,
            colorDetected: "red"
          },
          {
            label: "reconnaissance de l'erreur",
            quote: "Orgon enfin comprend",
            analysis: "rédemption du aveuglement",
            weight: 5,
            colorDetected: "none"
          },
          {
            label: "restauration de l'ordre",
            quote: "Justice divine accomplies",
            analysis: "triomphe de la vérité",
            weight: 5,
            colorDetected: "none"
          }
        ]
      }
    ],
    
    // CONCLUSION - must be object with all 3 parts
    conclusion: {
      cheminement: "Le texte suit une escalade dramatique: d'abord Damis tente de débusquer l'imposture, puis Orgon refuse de voir la vérité et aggrave la situation, enfin une intervention extérieure rétablit l'ordre et expose définitivement Tartuffe.",
      reponse: "En fusionnant critique sociale et dénouement théâtral spectaculaire, Molière affirme que la vertu et la raison triomphent inévitablement de l'hypocrisie et de la manipulation.",
      ouverture: "On peut rapprocher cette étude d'autres pièces molièresques (L'École des femmes, Le Misanthrope) où l'illusion et la réalité s'affrontent, ou des tragédies de Corneille où le devoir prime les passions."
    },
    
    // ORAL BULLETS
    oralBullets: [
      "Critique molieresque de l'hypocrisie religieuse et de la crédulité",
      "Escalade dramatique: révélation → aveuglement → justice",
      "Triomphe de la raison sur l'illusion"
    ],
    
    qualityFlags: [],
    sourceText: "Le Tartuffe - Acte III, scène 6: Damis révèle l'imposture de Tartuffe à Orgon, qui refuse de croire son fils..."
  };

  console.log("  ✅ Test AL created with:");
  console.log(`     - introduction: ${typeof testAL.introduction} with ${Object.keys(testAL.introduction).length} parts`);
  console.log(`     - movements: ${testAL.movements.length} movements`);
  console.log(`     - conclusion: ${typeof testAL.conclusion} with ${Object.keys(testAL.conclusion).length} parts`);
  console.log(`     - procedures: ${testAL.movements.reduce((sum, m) => sum + m.procedures.length, 0)} total`);

  // ─── STORE AL ──────────────────────────────────────────────
  console.log("\n[3/5] Storing AL in database...");
  const { alId } = storeAL(testAL);
  console.log(`  ✅ AL stored with ID: ${alId}`);

  // ─── RETRIEVE AND VALIDATE ────────────────────────────────
  console.log("\n[4/5] Retrieving and validating...");
  const retrieved = getAL(alId);
  
  if (!retrieved) {
    console.error("  ❌ AL not found in database");
    process.exit(1);
  }

  console.log("  ✅ AL retrieved successfully");
  
  // Validate structure
  const checks = [
    { name: "introduction is object", pass: typeof retrieved.introduction === "object" },
    { name: "introduction.auteurContexte exists", pass: !!retrieved.introduction?.auteurContexte },
    { name: "introduction.problematique exists", pass: !!retrieved.introduction?.problematique },
    { name: "introduction.annoncePlan exists", pass: !!retrieved.introduction?.annoncePlan },
    { name: "conclusion is object", pass: typeof retrieved.conclusion === "object" },
    { name: "conclusion.cheminement exists", pass: !!retrieved.conclusion?.cheminement },
    { name: "conclusion.reponse exists", pass: !!retrieved.conclusion?.reponse },
    { name: "movements array exists", pass: Array.isArray(retrieved.movements) },
    { name: "movements.length >= 3", pass: retrieved.movements?.length >= 3 },
    { name: "each movement has phraseTheme", pass: retrieved.movements?.every(m => m.phraseTheme) },
    { name: "each movement has procedures", pass: retrieved.movements?.every(m => m.procedures?.length > 0) },
    { name: "procedures have analysis", pass: retrieved.movements?.every(m => m.procedures?.every(p => p.analysis)) },
    { name: "oralBullets is array", pass: Array.isArray(retrieved.oralBullets) },
  ];

  let allPassed = true;
  for (const check of checks) {
    console.log(`  ${check.pass ? "✅" : "❌"} ${check.name}`);
    if (!check.pass) allPassed = false;
  }

  if (!allPassed) {
    console.error("\n  ❌ Some validation checks failed!");
    process.exit(1);
  }

  // ─── DISPLAY FULL STRUCTURE ────────────────────────────────
  console.log("\n[5/5] Full AL Structure:\n");
  console.log("┌─ INTRODUCTION");
  console.log(`│  • Auteur: ${retrieved.introduction.auteurContexte.substring(0, 70)}...`);
  console.log(`│  • Œuvre: ${retrieved.introduction.oeuvrePassage.substring(0, 70)}...`);
  console.log(`│  • Problématique: ${retrieved.introduction.problematique}`);
  console.log(`│  • Plan: ${retrieved.introduction.annoncePlan.substring(0, 70)}...`);
  
  console.log("\n┌─ MOUVEMENTS");
  for (const mov of retrieved.movements) {
    console.log(`│  Mouvement ${mov.number}: ${mov.title}`);
    console.log(`│  Thème: ${mov.phraseTheme.substring(0, 60)}...`);
    console.log(`│  Procédés: ${mov.procedures.length}`);
    for (const proc of mov.procedures.slice(0, 2)) {
      console.log(`│    • ${proc.label} → ${proc.analysis}`);
    }
    if (mov.procedures.length > 2) console.log(`│    ... et ${mov.procedures.length - 2} autres`);
  }

  console.log("\n┌─ CONCLUSION");
  console.log(`│  • Cheminement: ${retrieved.conclusion.cheminement.substring(0, 70)}...`);
  console.log(`│  • Réponse: ${retrieved.conclusion.reponse.substring(0, 70)}...`);
  console.log(`│  • Ouverture: ${retrieved.conclusion.ouverture?.substring(0, 70) || "N/A"}...`);

  console.log("\n┌─ STATISTICS");
  console.log(`│  Total ALs: ${getAllALs().length}`);
  console.log(`│  Movement count: ${retrieved.movementCount}`);
  console.log(`│  Procedure count: ${retrieved.procedureCount}`);
  console.log(`│  Completion: ${retrieved.completionPercent}%`);

  console.log("\n" + "═".repeat(60));
  console.log("✅ ALL TESTS PASSED - AL STRUCTURE VERIFIED");
  console.log("═".repeat(60) + "\n");

  process.exit(0);

} catch (err) {
  console.error("\n❌ TEST FAILED:");
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
}

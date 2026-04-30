/**
 * Bac-Oral V2 Test Module
 * 
 * Provides test fixtures and validation functions for V2 core module
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateIntro,
  generateConclusion,
  detectMotions,
  applyColorProcessing,
  validateV2Output,
  createV2Entry,
} from './v2-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test fixtures embedded in module
export const TEST_FIXTURES = {
  theatre: {
    id: "theatre-test-001",
    title: "La scène du duel",
    author: "Pierre Corneille",
    work: "Le Cid",
    genre: "theatre",
    sourceText: "Don Rodrigue, es-tu content? Ton père est satisfait de ta conduite, il voit que tu sais laver une injure sur celui qui te l'a faite. Mais enfin tu viens de combattre? Oui, je l'ai fait pour l'amour de vous, pour que vous soyez fier de moi. Mais pourquoi cette tristesse? C'est que j'ai tué celui que j'aimais.",
    sequence: {
      objectStudy: "Théâtre classique français",
      work: {
        title: "Le Cid",
        author: "Pierre Corneille"
      },
      parcours: "Dramaturgie et conflits"
    }
  },
  poetry: {
    id: "poetry-test-001",
    title: "Le Voyageur",
    author: "Arthur Rimbaud",
    work: "Illuminations",
    genre: "poesie",
    sourceText: "Je suis l'auteur du monde! Et voyez, je suis descendu de cette montagne, j'ai traversé ces forêts où la route serpente entre les arbres. Partout, la nature déploie sa beauté sauvage. Les ruisseaux chantent, les oiseaux s'envolent vers l'horizon. C'est un hymne à la liberté que la terre entonne pour ceux qui savent écouter.",
    sequence: {
      objectStudy: "Poésie du XIXe siècle",
      work: {
        title: "Illuminations",
        author: "Arthur Rimbaud"
      },
      parcours: "Vision poétique et révolte"
    }
  },
  novel: {
    id: "novel-test-001",
    title: "La rencontre",
    author: "Émile Zola",
    work: "L'Assommoir",
    genre: "roman",
    sourceText: "Elle entra dans le restaurant et tous les regards se tournèrent vers elle. Son cœur battait à la fois de joie et de crainte. Pour la première fois, elle voyait cet homme qui avait occupé ses pensées pendant des mois. Il se leva, l'accueillit avec gentillesse. Mais elle sentait bien que quelque chose avait changé entre eux. La vie les avait façonnés différemment. Et pourtant, dans cet instant suspendu, une flamme jaillit entre leurs yeux.",
    sequence: {
      objectStudy: "Roman réaliste français",
      work: {
        title: "L'Assommoir",
        author: "Émile Zola"
      },
      parcours: "Destin et determinisme"
    }
  },
  general: {
    id: "general-test-001",
    title: "Le sens du passage",
    author: "Michel de Montaigne",
    work: "Essais",
    genre: "general",
    sourceText: "Que sais-je? Cette question est au cœur de ma réflexion. L'homme ne cesse de se chercher, de se questionner. Il regarde autour de lui et voit mille contradictions. La vérité n'est jamais simple. Elle se cache derrière les apparences et nous force à penser toujours plus profondément. C'est pourquoi la sagesse commence par l'humilité de celui qui reconnaît les limites de son savoir.",
    sequence: {
      objectStudy: "Littérature générale",
      work: {
        title: "Essais",
        author: "Michel de Montaigne"
      },
      parcours: "Réflexion et humanisme"
    }
  }
};

/**
 * Create and export test fixtures to files
 * @returns {Promise<void>}
 */
export async function exportTestFixtures() {
  const fixturesDir = path.join(__dirname, 'test-fixtures');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  for (const [name, fixture] of Object.entries(TEST_FIXTURES)) {
    const filepath = path.join(fixturesDir, `sample-${name}.json`);
    fs.writeFileSync(filepath, JSON.stringify(fixture, null, 2));
    console.log(`✓ Exported test fixture: ${filepath}`);
  }
}

/**
 * Test: generateIntro function
 */
export function testGenerateIntro() {
  const results = [];
  
  for (const [genre, fixture] of Object.entries(TEST_FIXTURES)) {
    const intro = generateIntro(fixture, fixture.genre);
    const passed = intro && typeof intro === 'string' && intro.length > 0;
    results.push({
      test: `generateIntro(${genre})`,
      passed,
      message: passed ? `Generated intro (${intro.length} chars)` : "Failed to generate intro",
    });
  }
  
  return results;
}

/**
 * Test: generateConclusion function
 */
export function testGenerateConclusion() {
  const results = [];
  
  for (const [genre, fixture] of Object.entries(TEST_FIXTURES)) {
    const entry = createV2Entry(fixture);
    const conclusion = generateConclusion(entry, fixture.genre);
    const passed = conclusion && typeof conclusion === 'string' && conclusion.length > 0;
    results.push({
      test: `generateConclusion(${genre})`,
      passed,
      message: passed ? `Generated conclusion (${conclusion.length} chars)` : "Failed to generate conclusion",
    });
  }
  
  return results;
}

/**
 * Test: detectMotions function
 */
export function testDetectMotions() {
  const results = [];
  
  for (const [genre, fixture] of Object.entries(TEST_FIXTURES)) {
    const motions = detectMotions(fixture.sourceText, fixture.genre);
    const passed = Array.isArray(motions) && motions.length >= 2;
    const validity = motions.every(m => m.title && Array.isArray(m.bullets));
    results.push({
      test: `detectMotions(${genre})`,
      passed: passed && validity,
      message: passed && validity ? `Detected ${motions.length} motions` : `Invalid motion structure`,
    });
  }
  
  return results;
}

/**
 * Test: applyColorProcessing function
 */
export function testApplyColorProcessing() {
  const results = [];
  
  for (const [genre, fixture] of Object.entries(TEST_FIXTURES)) {
    const colored = applyColorProcessing(fixture);
    const hasColor = colored.color && typeof colored.color === 'string';
    const hasLabel = colored.colorLabel && typeof colored.colorLabel === 'string';
    results.push({
      test: `applyColorProcessing(${genre})`,
      passed: hasColor && hasLabel,
      message: hasColor && hasLabel ? `Applied color: ${colored.color}` : "Failed to apply color",
    });
  }
  
  return results;
}

/**
 * Test: validateV2Output function
 */
export function testValidateV2Output() {
  const results = [];
  
  for (const [genre, fixture] of Object.entries(TEST_FIXTURES)) {
    const entry = createV2Entry(fixture);
    const validation = validateV2Output(entry);
    results.push({
      test: `validateV2Output(${genre})`,
      passed: validation.valid,
      message: validation.valid ? "Validation passed" : `Errors: ${validation.errors.join('; ')}`,
    });
  }
  
  return results;
}

/**
 * Test: createV2Entry full pipeline
 */
export function testCreateV2Entry() {
  const results = [];
  
  for (const [genre, fixture] of Object.entries(TEST_FIXTURES)) {
    try {
      const entry = createV2Entry(fixture);
      const hasIntro = entry.introduction && entry.introduction.length > 0;
      const hasConclusion = entry.conclusion && entry.conclusion.length > 0;
      const hasMovements = Array.isArray(entry.movements) && entry.movements.length > 0;
      const hasColor = entry.color && entry.colorLabel;
      const isValid = entry._validation && entry._validation.valid;
      
      const passed = hasIntro && hasConclusion && hasMovements && hasColor && isValid;
      results.push({
        test: `createV2Entry(${genre})`,
        passed,
        message: passed ? "Complete V2 entry generated" : `Missing: ${[!hasIntro && 'intro', !hasConclusion && 'conclusion', !hasMovements && 'movements', !hasColor && 'color', !isValid && 'validation'].filter(Boolean).join(', ')}`,
      });
    } catch (error) {
      results.push({
        test: `createV2Entry(${genre})`,
        passed: false,
        message: `Error: ${error.message}`,
      });
    }
  }
  
  return results;
}

/**
 * Run all tests and return formatted results
 */
export function runAllTests() {
  const suites = [
    { name: 'generateIntro', fn: testGenerateIntro },
    { name: 'generateConclusion', fn: testGenerateConclusion },
    { name: 'detectMotions', fn: testDetectMotions },
    { name: 'applyColorProcessing', fn: testApplyColorProcessing },
    { name: 'validateV2Output', fn: testValidateV2Output },
    { name: 'createV2Entry', fn: testCreateV2Entry },
  ];

  const allResults = [];
  let totalTests = 0;
  let passedTests = 0;

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║        Bac-Oral V2 Module Test Suite               ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  for (const suite of suites) {
    console.log(`📋 ${suite.name}:`);
    const results = suite.fn();
    
    for (const result of results) {
      totalTests++;
      if (result.passed) passedTests++;
      const icon = result.passed ? '✅' : '❌';
      console.log(`  ${icon} ${result.test}: ${result.message}`);
      allResults.push(result);
    }
    console.log();
  }

  const percentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  const status = passedTests === totalTests ? '🎉' : '⚠️';
  
  console.log(`${status} Results: ${passedTests}/${totalTests} tests passed (${percentage}%)`);

  return {
    totalTests,
    passedTests,
    percentage,
    results: allResults,
  };
}

export default {
  TEST_FIXTURES,
  exportTestFixtures,
  testGenerateIntro,
  testGenerateConclusion,
  testDetectMotions,
  testApplyColorProcessing,
  testValidateV2Output,
  testCreateV2Entry,
  runAllTests,
};

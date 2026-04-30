#!/usr/bin/env node

/**
 * Bac-Oral V2 Integration Test Suite
 * 
 * Comprehensive testing of all V2 modules working together
 * Tests core functionality, color processing, frontend/backend integration
 */

import {
  generateIntro,
  generateConclusion,
  detectMotions,
  applyColorProcessing,
  validateV2Output,
  createV2Entry,
} from './v2-core.mjs';

import {
  analyzeMotionsAdvanced,
  generateMotionTitles,
  createMotionReport,
} from './v2-motion-engine.mjs';

import {
  getGenreColor,
  getGenrePalette,
  createColorizedEntry,
  getAllGenreColors,
} from './v2-colors.mjs';

import {
  enhanceEntryWithV2,
  applyV2Processing,
  validateProjectV2,
  generateV2Summary,
  exportV2Data,
} from './v2-backend.mjs';

// Test fixtures
const TEST_ENTRIES = [
  {
    id: 'entry-1',
    title: 'Le Cid - Scène du duel',
    author: 'Pierre Corneille',
    work: 'Le Cid',
    genre: 'theatre',
    sourceText: 'Don Rodrigue, es-tu content? Ton père est satisfait de ta conduite. Mais enfin tu viens de combattre? Oui, je l\'ai fait pour l\'amour de vous. Mais pourquoi cette tristesse? C\'est que j\'ai tué celui que j\'aimais.',
    movements: [
      { title: 'Conflit initial', bullets: ['tension dramatique'], excerpt: 'Don Rodrigue...' },
      { title: 'Montée de tension', bullets: ['affrontement'], excerpt: 'Mais enfin...' },
      { title: 'Révélation finale', bullets: ['sacrifice'], excerpt: 'C\'est que j\'ai...' },
    ],
    keyProcedures: [
      { label: 'interrogations', impact: 'certitude mise en crise', weight: 3 },
      { label: 'oppositions', impact: 'tension et renversement', weight: 3 },
    ],
    oralBullets: ['conflit honneur/amour', 'parole transformée en affrontement', 'bascule dramatique'],
  },
  {
    id: 'entry-2',
    title: 'Le Voyageur',
    author: 'Arthur Rimbaud',
    work: 'Illuminations',
    genre: 'poesie',
    sourceText: 'Je suis l\'auteur du monde! Et voyez, je suis descendu de cette montagne. Partout la nature déploie sa beauté. C\'est un hymne à la liberté.',
    movements: [
      { title: 'Affirmation du moi', bullets: ['première personne'], excerpt: 'Je suis...' },
      { title: 'Merveille de la nature', bullets: ['images du monde sensible'], excerpt: 'Partout la nature...' },
    ],
    keyProcedures: [
      { label: 'première personne', impact: 'subjectivité pleinement assumée', weight: 2 },
      { label: 'images frappantes', impact: 'beauté paradoxale', weight: 3 },
    ],
    oralBullets: ['liberté du poète', 'beauté paradoxale', 'liberté créatrice'],
  },
];

// Color constants
const COLORS = getAllGenreColors();

// Test suite
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertExists(obj, message) {
  if (!obj) {
    throw new Error(`${message}: expected object to exist`);
  }
}

// Color Tests
test('Colors: Get genre colors', () => {
  assert(getGenreColor('theatre') === '#7B2CBF', 'Theatre color should be purple');
  assert(getGenreColor('poesie') === '#3A86FF', 'Poetry color should be blue');
  assert(getGenreColor('roman') === '#FF006E', 'Novel color should be red');
});

test('Colors: Get genre palette', () => {
  const palette = getGenrePalette('theatre');
  assertExists(palette.primary, 'Palette should have primary color');
  assertExists(palette.light, 'Palette should have light color');
  assertExists(palette.dark, 'Palette should have dark color');
  assertExists(palette.accent, 'Palette should have accent color');
});

test('Colors: Get all genre colors', () => {
  assert(Object.keys(COLORS).length === 4, 'Should have 4 genres');
  assert(Object.values(COLORS).every(c => typeof c === 'string'), 'All values should be strings');
});

// Core V2 Tests
test('Core: Generate intro', () => {
  const entry = TEST_ENTRIES[0];
  const intro = generateIntro(entry, 'theatre');
  assert(typeof intro === 'string', 'Intro should be a string');
  assert(intro.length > 0, 'Intro should not be empty');
  assert(intro.includes('Corneille'), 'Intro should include author');
});

test('Core: Generate conclusion', () => {
  const entry = TEST_ENTRIES[0];
  const conclusion = generateConclusion(entry, 'theatre');
  assert(typeof conclusion === 'string', 'Conclusion should be a string');
  assert(conclusion.length > 0, 'Conclusion should not be empty');
  assert(conclusion.includes('conclusion'), 'Conclusion should include word "conclusion"');
});

test('Core: Detect motions', () => {
  const text = TEST_ENTRIES[0].sourceText;
  const motions = detectMotions(text, 'theatre');
  assert(Array.isArray(motions), 'Should return array');
  assert(motions.length > 0, 'Should detect at least one motion');
  assert(motions[0].title, 'Motion should have title');
  assert(Array.isArray(motions[0].bullets), 'Motion should have bullets array');
});

test('Core: Apply color processing', () => {
  const entry = TEST_ENTRIES[0];
  const colored = applyColorProcessing(entry);
  assertExists(colored.color, 'Should have color');
  assertExists(colored.colorLabel, 'Should have color label');
  assert(colored.color === COLORS.theatre, 'Color should match genre');
});

test('Core: Validate V2 output', () => {
  const entry = createV2Entry(TEST_ENTRIES[0]);
  const validation = validateV2Output(entry);
  assert(typeof validation.valid === 'boolean', 'Should have valid property');
  assert(Array.isArray(validation.errors), 'Should have errors array');
});

test('Core: Create V2 entry', () => {
  const entry = createV2Entry(TEST_ENTRIES[0]);
  assertExists(entry.introduction, 'Should have introduction');
  assertExists(entry.conclusion, 'Should have conclusion');
  assertExists(entry.movements, 'Should have movements');
  assertExists(entry.color, 'Should have color');
  assert(entry.color === COLORS.theatre, 'Color should be applied');
});

// Motion Engine Tests
test('Motion Engine: Analyze motions advanced', () => {
  const text = TEST_ENTRIES[0].sourceText;
  const chunks = text.split('. ');
  const analysis = analyzeMotionsAdvanced(chunks, 'theatre');
  assert(Array.isArray(analysis), 'Should return array');
  assert(analysis.every(m => m.intensity !== undefined), 'Each should have intensity');
  assert(analysis.every(m => m.theme), 'Each should have theme');
});

test('Motion Engine: Generate motion titles', () => {
  const text = TEST_ENTRIES[0].sourceText;
  const chunks = text.split('. ');
  const analysis = analyzeMotionsAdvanced(chunks, 'theatre');
  const titles = generateMotionTitles(analysis, 'theatre');
  assert(Array.isArray(titles), 'Should return array');
  assert(titles.length === analysis.length, 'Should have same length as analysis');
  assert(titles.every(t => typeof t === 'string'), 'All titles should be strings');
});

test('Motion Engine: Create motion report', () => {
  const text = TEST_ENTRIES[0].sourceText;
  const chunks = text.split('. ');
  const report = createMotionReport(text, chunks, 'theatre');
  assertExists(report.analysisResults, 'Should have analysis results');
  assertExists(report.titles, 'Should have titles');
  assertExists(report.statistics, 'Should have statistics');
  assert(typeof report.statistics.averageIntensity === 'number', 'Should have average intensity');
});

// Backend Integration Tests
test('Backend: Enhance entry with V2', () => {
  let entry = { ...TEST_ENTRIES[0] };
  entry = enhanceEntryWithV2(entry);
  assertExists(entry.introduction, 'Should have introduction');
  assertExists(entry.conclusion, 'Should have conclusion');
  assertExists(entry.color, 'Should have color');
});

test('Backend: Apply V2 processing to project', () => {
  const project = { entries: TEST_ENTRIES };
  const processed = applyV2Processing(project);
  assert(processed.entries.length === 2, 'Should process all entries');
  assert(processed.entries.every(e => e.color), 'All entries should have colors');
});

test('Backend: Validate project V2', () => {
  const project = { entries: TEST_ENTRIES.map(e => createV2Entry(e)) };
  const validation = validateProjectV2(project);
  assert(typeof validation.valid === 'boolean', 'Should have valid property');
  assert(validation.valid === true, 'Should be valid');
});

test('Backend: Generate V2 summary', () => {
  const project = { entries: TEST_ENTRIES.map(e => createV2Entry(e)) };
  const summary = generateV2Summary(project);
  assert(summary.totalEntries === 2, 'Should count entries');
  assert(summary.genreDistribution.theatre === 1, 'Should count theatre');
  assert(summary.genreDistribution.poesie === 1, 'Should count poetry');
  assert(typeof summary.completeness === 'number', 'Should have completeness');
});

test('Backend: Export V2 data as JSON', () => {
  const project = { entries: TEST_ENTRIES.map(e => createV2Entry(e)) };
  const exported = exportV2Data(project, 'json');
  assertExists(exported.metadata, 'Should have metadata');
  assertExists(exported.entries, 'Should have entries');
  assert(exported.entries.length === 2, 'Should export all entries');
});

// Run all tests
async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║        Bac-Oral V2 Integration Test Suite           ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  for (const { name, fn } of tests) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  const total = passed + failed;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
  const status = failed === 0 ? '🎉' : '⚠️';

  console.log(`\n${status} Results: ${passed}/${total} tests passed (${percentage}%)\n`);

  return failed === 0 ? 0 : 1;
}

// Run if executed directly
const exitCode = await runTests();
process.exit(exitCode);

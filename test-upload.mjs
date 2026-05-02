import { initializeDatabase, storeAL } from './lib/v3-storage.mjs';
import { extractHybrid } from './lib/v3-hybrid-extractor.mjs';
import fs from 'node:fs';

console.log('=== FULL PIPELINE TEST ===\n');

// Clean start
if (fs.existsSync('.data/als.db')) fs.unlinkSync('.data/als.db');

// Initialize
initializeDatabase();
console.log('✓ Database initialized\n');

// Extract
console.log('Extracting from sample_al_1.txt...');
const result = await extractHybrid('input/placeholder/sample_al_1.txt');
console.log(`✓ Extracted: ${result.title}`);
console.log(`  Movements: ${result.movements.length}`);
console.log(`  Total procedures: ${result.movements.reduce((s,m) => s + m.procedures.length, 0)}\n`);

// Store
console.log('Storing AL...');
try {
  const stored = await storeAL(result);
  console.log(`✓ Stored: ${stored.alId}\n`);
} catch (err) {
  console.error(`✗ ERROR: ${err.message}\n`);
  process.exit(1);
}

// Verify
const { getAL, getAllALs } = await import('./lib/v3-storage.mjs');
const all = getAllALs();
const first = getAL(all[0].id);

console.log(`Verification:`);
console.log(`✓ Total ALs: ${all.length}`);
console.log(`✓ Title: ${first.title}`);
console.log(`✓ Movements: ${first.movementCount}`);
console.log(`✓ Procedures: ${first.procedureCount}`);
console.log(`✓ Completion: ${first.completionPercent}%`);
console.log(`\n=== ALL TESTS PASSED ===`);

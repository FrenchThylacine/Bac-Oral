import { initializeDatabase, storeAL, getAL, getAllALs } from './lib/v3-storage.mjs';
import { extractFromImage } from './lib/v3-extraction.mjs';

console.log('=== END-TO-END TEST ===\n');

// 1. Initialize database
console.log('1. Initializing database...');
initializeDatabase();

// 2. Extract from sample file  
console.log('2. Extracting from sample_al_1.txt...');
const extracted = await extractFromImage('input/placeholder/sample_al_1.txt');

console.log('   Title:', extracted.title);
console.log('   Movements:', extracted.movements.length);
console.log('   Total procedures:', extracted.movements.reduce((s, m) => s + m.procedures.length, 0));

// 3. Store in database
console.log('\n3. Storing in database...');
const storeResult = storeAL(extracted);
console.log('   Stored:', storeResult.success ? '✅' : '❌');
console.log('   AL ID:', storeResult.alId);

// 4. Retrieve from database
console.log('\n4. Retrieving from database...');
const retrieved = getAL(storeResult.alId);
console.log('   Retrieved title:', retrieved.title);
console.log('   Retrieved movements:', retrieved.movements.length);
retrieved.movements.forEach(m => {
  console.log(`     Movement ${m.number}: ${m.title} (${m.procedures.length} procedures)`);
});

// 5. Get all ALs
console.log('\n5. Getting all ALs...');
const allALs = getAllALs();
console.log('   Total ALs in DB:', allALs.length);
console.log('   Latest AL ID:', allALs[0]?.id);
console.log('   Latest AL title:', allALs[0]?.title);

console.log('\n✅ End-to-end test complete!');
console.log('Result:', JSON.stringify({
  stored: storeResult.success,
  retrieved: !!retrieved,
  movementsMatch: retrieved.movements.length === extracted.movements.length,
  proceduresMatch: retrieved.movements.reduce((s, m) => s + m.procedures.length, 0) === 
                   extracted.movements.reduce((s, m) => s + m.procedures.length, 0),
}, null, 2));

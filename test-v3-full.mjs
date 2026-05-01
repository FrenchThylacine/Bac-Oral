#!/usr/bin/env node
/**
 * V3 Full Integration Test - Test extraction, storage, and retrieval
 */

import { extractFromImage, getDemoAL } from './lib/v3-extraction.mjs';
import { storeAL, getAllALs, initializeDatabase } from './lib/v3-storage.mjs';

async function runTest() {
  console.log('=== V3 Full Integration Test ===\n');
  
  try {
    // Init database
    initializeDatabase();
    
    // Test 1: Extract from placeholder file
    console.log('1. Extracting from placeholder file...');
    const placeholderPath = './input/placeholder/sample_al_1.txt';
    const extracted = await extractFromImage(placeholderPath);
    
    console.log(`   ✓ Title: ${extracted.title}`);
    console.log(`   ✓ Movements: ${extracted.movements.length}`);
    
    // Analyze movements
    let procCount = 0;
    let analysisCount = 0;
    extracted.movements.forEach((m, i) => {
      console.log(`     ${i + 1}. ${m.name}`);
      m.procedures.forEach((p, j) => {
        procCount++;
        analysisCount += p.analyses.length;
        console.log(`        → ${p.name} [${p.type}] (${p.analyses.length} analyses)`);
        p.analyses.slice(0, 2).forEach(a => console.log(`           • ${a}`));
      });
    });
    
    console.log(`   ✓ Total procedures: ${procCount}`);
    console.log(`   ✓ Total analyses: ${analysisCount}\n`);
    
    // Test 2: Store in database
    console.log('2. Storing in database...');
    const stored = await storeAL(extracted);
    console.log(`   ✓ Stored with ID: ${stored.id}\n`);
    
    // Test 3: Retrieve from database
    console.log('3. Retrieving from database...');
    const allALs = getAllALs();
    console.log(`   ✓ Total ALs: ${allALs.length}`);
    if (allALs.length > 0) {
      console.log(`   ✓ First AL: "${allALs[0].title}"\n`);
    }
    
    // Test 4: Validate quality
    console.log('4. Validating extraction quality...');
    const issues = [];
    
    if (extracted.movements.length === 0) issues.push('No movements');
    if (extracted.movements.some(m => m.procedures.length === 0)) issues.push('Some movements have no procedures');
    if (procCount === 0) issues.push('No procedures extracted');
    if (analysisCount === 0) issues.push('No analyses extracted');
    
    if (issues.length === 0) {
      console.log(`   ✓ SUCCESS! All validations passed.\n`);
    } else {
      console.log(`   ✗ ISSUES: ${issues.join(', ')}\n`);
    }
    
    console.log('=== Test Results ===');
    console.log(`Movements: ${extracted.movements.length}`);
    console.log(`Procedures: ${procCount}`);
    console.log(`Analyses: ${analysisCount}`);
    console.log(`Database ALs: ${allALs.length}`);
    console.log(`Status: ${issues.length === 0 ? 'PASS' : 'FAIL'}`);
    
    process.exit(issues.length > 0 ? 1 : 0);
  } catch (err) {
    console.error('✗ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTest();

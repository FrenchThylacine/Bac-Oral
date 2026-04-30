#!/usr/bin/env node

/**
 * Simple test runner for V2 module
 */

import { runAllTests, exportTestFixtures } from './lib/v2-test.mjs';

async function main() {
  try {
    // Export test fixtures to disk
    console.log('📁 Exporting test fixtures...');
    await exportTestFixtures();
    
    // Run tests
    const results = runAllTests();
    
    // Exit with appropriate code
    process.exit(results.passedTests === results.totalTests ? 0 : 1);
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  }
}

main();

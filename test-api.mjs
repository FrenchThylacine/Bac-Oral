#!/usr/bin/env node
import http from 'node:http';

const PORT = 4173;

async function testAPI() {
  const tests = [
    { name: 'Health', method: 'GET', path: '/api/health' },
    { name: 'V3 ALS List', method: 'GET', path: '/api/v3/als' },
  ];

  for (const test of tests) {
    try {
      const response = await fetch(`http://localhost:${PORT}${test.path}`);
      const data = await response.json();
      console.log(`✓ ${test.name}: ${response.status}`);
      if (data.als && Array.isArray(data.als)) console.log(`  → ${data.als.length} ALs`);
    } catch (err) {
      console.error(`✗ ${test.name}: ${err.message}`);
    }
  }
  
  console.log('\n=== All API tests completed ===');
  process.exit(0);
}

// Wait for server to start
setTimeout(testAPI, 2000);

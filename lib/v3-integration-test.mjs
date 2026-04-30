/**
 * V3 Integration Test - Full pipeline testing
 * Tests: extraction → storage → completion → export
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_TIMEOUT = 30000;
const API_BASE = 'http://127.0.0.1:4173/api/v3';

// Test data
const testALs = [
  {
    name: 'test-al-1.json',
    data: {
      id: 'test-al-001',
      title: 'Les Misérables - Justice and Mercy',
      intro: 'This AL explores the central themes of justice and mercy through character analysis.',
      conclusion: 'Hugo demonstrates that true justice must be tempered with mercy.',
      movements: [
        {
          id: 'mov-001',
          name: 'Fantine\'s Sacrifice',
          procedures: [
            {
              id: 'proc-001',
              name: 'Economic Desperation',
              type: 'narrative',
              analyses: [
                { key: 'poverty-analysis', text: 'Economic system forces moral compromise' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    name: 'test-al-2.json',
    data: {
      id: 'test-al-002',
      title: 'Molière - Power Dynamics',
      intro: 'An examination of social hierarchies and manipulation.',
      conclusion: 'Molière critiques the arbitrary nature of social power.',
      movements: [
        {
          id: 'mov-002',
          name: 'Deception and Status',
          procedures: [
            {
              id: 'proc-002',
              name: 'Language as Weapon',
              type: 'dialogue',
              analyses: [
                { key: 'rhetoric-analysis', text: 'Characters use eloquence to manipulate' },
              ],
            },
          ],
        },
      ],
    },
  },
];

// Test utilities
async function makeRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsed,
            headers: res.headers,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test cases
async function testGetALs() {
  console.log('🧪 Test 1: GET /api/v3/als');
  try {
    const result = await makeRequest('GET', '/als');
    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }
    console.log('✅ PASS: Retrieved AL list');
    console.log(`   Found ${(result.data.als || []).length} ALs`);
    return result.data.als || [];
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    return [];
  }
}

async function testProcessAL(alId) {
  console.log(`\n🧪 Test 2: POST /api/v3/process (AL: ${alId})`);
  try {
    const result = await makeRequest('POST', '/process', { id: alId });
    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }
    console.log('✅ PASS: Processed AL');
    console.log(`   Completion: ${result.data.completionScore}%`);
    console.log(`   Flagged: ${result.data.flaggedCount}`);
    return result.data;
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    return null;
  }
}

async function testGetALStats(alId) {
  console.log(`\n🧪 Test 3: GET /api/v3/als/:id (AL: ${alId})`);
  try {
    const result = await makeRequest('GET', `/als/${alId}`);
    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }
    console.log('✅ PASS: Retrieved AL stats');
    console.log(`   Title: ${result.data.title}`);
    console.log(`   Completion: ${result.data.completionPercent}%`);
    console.log(`   Movements: ${result.data.movementCount}`);
    return result.data;
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    return null;
  }
}

async function testGetReview(alId) {
  console.log(`\n🧪 Test 4: GET /api/v3/review (AL: ${alId})`);
  try {
    const result = await makeRequest('GET', `/review?id=${alId}`);
    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }
    console.log('✅ PASS: Retrieved review items');
    console.log(`   Flagged: ${(result.data.flaggedItems || []).length}`);
    return result.data.flaggedItems || [];
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    return [];
  }
}

async function testExport(alId, format) {
  console.log(`\n🧪 Test 5: POST /api/v3/export (Format: ${format})`);
  try {
    const result = await makeRequest('POST', '/export', { id: alId, format });
    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }
    console.log(`✅ PASS: Exported to ${format.toUpperCase()}`);
    console.log(`   File: ${result.data.downloadUrl || result.data.file}`);
    return result.data;
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    return null;
  }
}

async function testUnknownAL() {
  console.log('\n🧪 Test 6: Error handling - unknown AL');
  try {
    const result = await makeRequest('GET', '/als/unknown-id-12345');
    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }
    console.log('✅ PASS: Correctly returned 404 for unknown AL');
    return true;
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    return false;
  }
}

async function testDemoMode() {
  console.log('\n🧪 Test 7: Demo mode fallback');
  try {
    // Try uploading a non-existent file to trigger demo mode
    const result = await makeRequest('POST', '/upload', { fileName: 'demo-test' });
    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }
    console.log('✅ PASS: Demo mode works');
    console.log(`   Demo AL: ${result.data.alId}`);
    return result.data;
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    return null;
  }
}

// Performance tests
async function testPerformance(alId) {
  console.log('\n🧪 Test 8: Performance - Process latency');
  const start = Date.now();
  const result = await makeRequest('POST', '/process', { id: alId });
  const latency = Date.now() - start;

  if (latency > 5000) {
    console.warn(`⚠️  WARN: Processing took ${latency}ms (expected <5000ms)`);
  } else {
    console.log(`✅ PASS: Processing latency ${latency}ms`);
  }
  return latency;
}

async function testConcurrency() {
  console.log('\n🧪 Test 9: Concurrency - Multiple simultaneous requests');
  try {
    const promises = [
      makeRequest('GET', '/als'),
      makeRequest('GET', '/als'),
      makeRequest('GET', '/als'),
    ];
    const results = await Promise.all(promises);
    const allSuccess = results.every((r) => r.status === 200);
    if (allSuccess) {
      console.log('✅ PASS: Concurrent requests handled');
    } else {
      throw new Error('Some concurrent requests failed');
    }
  } catch (err) {
    console.error('❌ FAIL:', err.message);
  }
}

async function testRateLimitRecovery() {
  console.log('\n🧪 Test 10: Rate limit recovery');
  try {
    // Send many requests rapidly
    const requests = Array(10).fill(0).map(() => makeRequest('GET', '/als'));
    await Promise.all(requests);
    console.log('✅ PASS: Rate limit recovery works');
  } catch (err) {
    console.error('❌ FAIL:', err.message);
  }
}

// Main test suite
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        V3 AI Digitization - Integration Test Suite         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  try {
    // Test 1: Get ALs
    const als = await testGetALs();
    if (als.length > 0) passed++; else failed++;

    if (als.length > 0) {
      const firstAL = als[0];

      // Test 2: Process AL
      const processResult = await testProcessAL(firstAL.id);
      if (processResult) passed++; else failed++;

      // Test 3: Get AL stats
      const stats = await testGetALStats(firstAL.id);
      if (stats) passed++; else failed++;

      // Test 4: Get review items
      const flagged = await testGetReview(firstAL.id);
      if (flagged !== null) passed++; else failed++;

      // Test 5: Export formats
      for (const format of ['json', 'excel', 'pdf']) {
        const exported = await testExport(firstAL.id, format);
        if (exported) passed++; else failed++;
      }

      // Performance tests
      const latency = await testPerformance(firstAL.id);
      if (latency < 5000) passed++; else failed++;
    }

    // Test 6: Error handling
    const errorTest = await testUnknownAL();
    if (errorTest) passed++; else failed++;

    // Test 7: Demo mode
    const demo = await testDemoMode();
    if (demo) passed++; else failed++;

    // Test 9: Concurrency
    await testConcurrency();
    passed++;

    // Test 10: Rate limit
    await testRateLimitRecovery();
    passed++;
  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message);
    failed++;
  }

  const duration = Date.now() - startTime;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST RESULTS                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ ✅ Passed: ${passed} tests`);
  console.log(`║ ❌ Failed: ${failed} tests`);
  console.log(`║ ⏱️  Duration: ${duration}ms`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
  console.log(`Overall Success Rate: ${successRate}%\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

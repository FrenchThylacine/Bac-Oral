#!/usr/bin/env node
/**
 * SANITY CHECK - Verify all modules can be loaded
 * Run this first before running full tests
 */

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║   MODULE SANITY CHECK                                    ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

const modules = [
  { name: "v3-storage.mjs", path: "./lib/v3-storage.mjs" },
  { name: "v3-extraction.mjs", path: "./lib/v3-extraction.mjs" },
  { name: "v3-pdf-exporter.mjs", path: "./lib/v3-pdf-exporter.mjs" },
];

let passed = 0;
let failed = 0;

for (const mod of modules) {
  try {
    console.log(`[Check] Loading ${mod.name}...`);
    await import(mod.path);
    console.log(`  ✅ Success\n`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }
}

console.log("═".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));

if (failed > 0) {
  console.error("\n❌ Module loading failed!");
  process.exit(1);
}

console.log("\n✅ All modules loaded successfully!");
console.log("Ready to run: node test-v3-complete.mjs\n");
process.exit(0);

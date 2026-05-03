#!/usr/bin/env node
// Quick syntax verification - checks if main modules import without errors

console.log("[Verify] Checking server.mjs imports...");
try {
  await import("./server.mjs");
  console.log("[Verify] ✓ server.mjs imports OK");
} catch(e) {
  console.error("[Verify] ✗ server.mjs error:", e.message);
  process.exit(1);
}

console.log("[Verify] All syntax checks passed ✓");

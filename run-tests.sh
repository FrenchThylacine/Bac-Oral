#!/bin/bash
# BAC ORAL V3 - AUTOMATED TEST SUITE
# Run all validation tests to verify system is working correctly

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   BAC ORAL STUDIO V3 - TEST SUITE                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

run_test() {
  local test_name=$1
  local test_file=$2
  
  echo -e "${YELLOW}[TEST]${NC} Running: $test_name"
  echo "  File: $test_file"
  
  if node "$test_file" 2>&1; then
    echo -e "${GREEN}✅ PASSED${NC}: $test_name\n"
    return 0
  else
    echo -e "${RED}❌ FAILED${NC}: $test_name\n"
    return 1
  fi
}

# Make sure we're in the right directory
cd "$(dirname "$0")"

echo "Starting test suite..."
echo ""

# Counter for results
PASSED=0
FAILED=0

# Test 1: Integration Test (Database + Structure)
if run_test "Integration Test" "test-integration.mjs"; then
  ((PASSED++))
else
  ((FAILED++))
fi

# Test 2: Complete Validation (Extraction + Storage + PDF)
if run_test "Complete Validation" "test-v3-complete.mjs"; then
  ((PASSED++))
else
  ((FAILED++))
fi

# Test 3: Endpoint Mocks (API Simulation)
if run_test "Endpoint Mocks" "test-endpoints.mjs"; then
  ((PASSED++))
else
  ((FAILED++))
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   TEST SUITE SUMMARY                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Failed: $FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}❌ Failed: 0${NC}"
fi
echo ""
echo "Next steps:"
echo "  1. Start the server: node server.mjs"
echo "  2. Test health: curl http://localhost:4173/api/health"
echo "  3. Upload test image"
echo "  4. Verify AL structure"
echo ""

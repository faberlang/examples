#!/usr/bin/env bash
# W4-09b regression: BUILD_STATUS capture honesty.
#
# The `if ! cmd; then STATUS=$?; fi` pattern always captures 0 because bash
# `!` inverts the exit status before $? is read in the `then` block. This
# test verifies that the canonical form `cmd || STATUS=$?` (used in
# proof-driver.sh S-01 build step) correctly captures non-zero exit codes.
#
# See 5fec531, triga/docs/factory/hello-voxel/goals/08-proof-matrix.md §15

set -euo pipefail

PASS=0
FAIL=0
pass() { echo "  [PASS] $1"; ((PASS++)) || true; }
fail() { echo "  [FAIL] $1"; ((FAIL++)) || true; }

echo "=== W4-09b regression: BUILD_STATUS capture honesty ==="

# --- Canonical form: cmd || STATUS=$? ---

# Test 1: failure captured
STATUS=0
false 2>/dev/null || STATUS=$?
if [[ "$STATUS" -eq 1 ]]; then
  pass "canonical: 'false || STATUS=\$?' captures exit code 1"
else
  fail "canonical: expected STATUS=1, got STATUS=$STATUS"
fi

# Test 2: success preserves pre-initialized 0 (as in proof-driver.sh S-01)
STATUS=0
true || STATUS=$?
if [[ "$STATUS" -eq 0 ]]; then
  pass "canonical: 'true || STATUS=\$?' leaves STATUS=0 (no-op on success)"
else
  fail "canonical: expected STATUS=0, got STATUS=$STATUS"
fi

# Test 3: command substitution form (as used in proof-driver.sh S-01)
STATUS=0
OUT="$(false 2>&1)" || STATUS=$?
if [[ "$STATUS" -eq 1 ]]; then
  pass "canonical: '\$(false) || STATUS=\$?' captures exit code 1"
else
  fail "canonical: expected STATUS=1, got STATUS=$STATUS"
fi

# --- Canary: the mask pattern always gives 0 ---
# If someone reverts proof-driver.sh to `if ! ...; then BUILD_STATUS=$?`,
# this canary will document why it's wrong.

STATUS=42
if ! false 2>/dev/null; then
  STATUS=$?
fi
if [[ "$STATUS" -eq 0 ]]; then
  pass "canary: 'if ! ...; then STATUS=\$?' yields STATUS=0 (masking failure)"
else
  fail "canary: mask pattern yielded STATUS=$STATUS (unexpected — bash behavior may have changed)"
fi

# --- Summary ---
echo ""
TOTAL=$((PASS + FAIL))
echo "W4-09b regression: $PASS/$TOTAL pass"
if [[ "$FAIL" -gt 0 ]]; then
  echo "FAIL: BUILD_STATUS capture regression detected"
  exit 1
fi
exit 0

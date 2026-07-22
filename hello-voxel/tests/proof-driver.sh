#!/usr/bin/env bash
# Goal 08 proof driver: runs all matrix rows and reports a single exit code.
#
# Evidence families (from 08-proof-matrix.md):
#   S-01..S-07  Structural
#   B-01..B-08  Browser DOM attributes
#   I-01..I-06  Interaction sequences
#   P-01..P-03  Pixel samples (when HV_GPU_CHECK=1)
#   R-01..R-04  Resource lifecycle
#   D-01..D-06  Dependency scan (pre/post clean-break)
#
# Usage:
#   FABER_BIN=faber HV_GPU_CHECK=0 bash proof-driver.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"

# ---- env vars ----------------------------------------------------------------
FABER_BIN="${FABER_BIN:-faber}"
HV_BROWSER="${HV_BROWSER:-}"
HV_GPU_CHECK="${HV_GPU_CHECK:-0}"

# ---- counters ----------------------------------------------------------------
PASS=0
FAIL=0
SKIP=0

PASS_MARK="[PASS]"
FAIL_MARK="[FAIL]"
SKIP_MARK="[SKIP]"

# ---- helpers -----------------------------------------------------------------
pass()  { echo "  $PASS_MARK $1"; ((PASS++)); }
fail()  { echo "  $FAIL_MARK $1"; ((FAIL++)); }
skip()  { echo "  $SKIP_MARK $1"; ((SKIP++)); }
column() { echo "[$1] $2"; }

check_exit() {
  local row="$1" label="$2"
  if [[ $? -eq 0 ]]; then pass "$row $label"; else fail "$row $label"; fi
}

# ---- preamble ----------------------------------------------------------------
echo "=== Goal 08 proof driver ==="
echo "  FABER_BIN=$FABER_BIN HV_GPU_CHECK=$HV_GPU_CHECK"
echo "  APP_DIR=$APP_DIR"
echo ""

# ---- Step 1: Build -----------------------------------------------------------
echo "=== Step 1: Build (S-01) ==="
column "node-dom" "S-01 $FABER_BIN build --package ."

BUILD_OUT=""
BUILD_STATUS=0
if ! BUILD_OUT="$("$FABER_BIN" build --package . 2>&1)"; then
  BUILD_STATUS=$?
fi
printf '%s\n' "$BUILD_OUT"

if [[ $BUILD_STATUS -ne 0 ]]; then
  fail "S-01 build"
  echo ""
  echo "=== Summary ==="
  echo "  Proof matrix: $PASS/$((PASS+FAIL)) rows pass (node-dom column)."
  echo "  Build failed — further checks not attempted."
  exit 3
fi
pass "S-01 build"

BUILD_DIR="$APP_DIR/dist"

# ---- Step 2: Structural assertions (S-02..S-07) ------------------------------
echo "=== Step 2: Structural assertions (S-02..S-07) ==="

# S-02: build artifact directory exists and is non-empty
if [[ -d "$BUILD_DIR" ]]; then
  FILE_COUNT="$(ls -1 "$BUILD_DIR" 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$FILE_COUNT" -ge 3 ]]; then
    pass "S-02 build dir ($BUILD_DIR) has $FILE_COUNT files"
  else
    fail "S-02 build dir ($BUILD_DIR) has $FILE_COUNT files (expected >= 3)"
  fi
else
  fail "S-02 build dir ($BUILD_DIR) missing"
fi

# S-03: controllers.json schema — controller count >= 1
CONTROLLERS="$BUILD_DIR/controllers.json"
if [[ -f "$CONTROLLERS" ]]; then
  CC="$(jq '. | length' "$CONTROLLERS" 2>/dev/null || echo 0)"
  if [[ "$CC" -ge 1 ]]; then
    pass "S-03 controllers.json has $CC controller(s)"
  else
    fail "S-03 controllers.json has $CC controller(s) (expected >= 1)"
  fi
else
  fail "S-03 controllers.json missing"
fi

# S-04: emitted .js controller artifact present (build emits .js from TS target)
ESM_COUNT="$(find "$BUILD_DIR" -maxdepth 2 -name '*.js' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$ESM_COUNT" -ge 1 ]]; then
  pass "S-04 $ESM_COUNT emitted .js artifact(s)"
else
  fail "S-04 no emitted .js artifacts"
fi

# S-05: emitted .d.ts type declaration present
DTS_COUNT="$(find "$BUILD_DIR" -maxdepth 2 -name '*.d.ts' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$DTS_COUNT" -ge 1 ]]; then
  pass "S-05 $DTS_COUNT emitted .d.ts declaration(s)"
else
  fail "S-05 no emitted .d.ts declarations"
fi

# S-06: build timestamp present in metadata
if [[ -f "$CONTROLLERS" ]]; then
  BT="$(jq -r '."build-timestamp" // ""' "$CONTROLLERS" 2>/dev/null)"
  if [[ -n "$BT" ]]; then
    pass "S-06 build-timestamp=$BT"
  else
    fail "S-06 build-timestamp missing or empty"
  fi
fi

# S-07: data-hv-residual-path matches admitted multi-draw
HV_RESIDUAL="$(grep -l 'per-chunk-multi-draw' "$BUILD_DIR" -r 2>/dev/null || true)"
if [[ -n "$HV_RESIDUAL" ]]; then
  pass "S-07 per-chunk-multi-draw found in build artifacts"
else
  fail "S-07 per-chunk-multi-draw not found in build artifacts"
fi

# ---- Step 3: Dependency scan pre-clean-break (D-01..D-06) --------------------
echo "=== Step 3: Dependency scan — pre-clean-break (D-01..D-06) ==="
column "node-dom" "D-01..D-06 check-hello-voxel-runtime-deps"
if bash "$WORKSPACE/triga/scripta/check-hello-voxel-runtime-deps" 2>&1; then
  pass "D-01..D-06 pre-clean-break scan exit 0"
else
  fail "D-01..D-06 pre-clean-break scan exit non-zero"
fi

# ---- Step 4: Browser + interaction evidence (B-01..B-08, I-01..I-06) ---------
echo "=== Step 4: Browser + interaction evidence (B-01..B-08, I-01..I-06) ==="
column "node-dom" "B-01..I-06 hv06c-interaction-test.mjs"
if node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/tests/hv06c-interaction-test.mjs" 2>&1; then
  pass "B-01..I-06 interaction test exit 0"
else
  fail "B-01..I-06 interaction test exit non-zero"
fi

# ---- Step 5: Resource-lifecycle evidence (R-01..R-04) ------------------------
echo "=== Step 5: Resource-lifecycle evidence (R-01..R-04) ==="
column "node-dom" "R-01..R-04 hv07c-resource-cycle-test.mjs"
if node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/tests/hv07c-resource-cycle-test.mjs" 2>&1; then
  pass "R-01..R-04 resource-cycle test exit 0"
else
  fail "R-01..R-04 resource-cycle test exit non-zero"
fi

# ---- Step 6: Pixel evidence (P-01..P-03) -------------------------------------
echo "=== Step 6: Pixel evidence (P-01..P-03) ==="
if [[ "$HV_GPU_CHECK" == "1" ]]; then
  column "node-dom" "P-01..P-03 cube-proof-test.mjs (HV_GPU_CHECK=1)"
  if node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
    "$APP_DIR/tests/cube-proof-test.mjs" 2>&1; then
    pass "P-01..P-03 pixel proof exit 0"
  else
    fail "P-01..P-03 pixel proof exit non-zero"
  fi
else
  skip "P-01..P-03 pixel proof (HV_GPU_CHECK=0, structural primary gate)"
fi

# ---- Step 7: Dependency scan post-clean-break (D-01..D-06) -------------------
echo "=== Step 7: Dependency scan — post-clean-break (D-01..D-06) ==="
column "node-dom" "D-01..D-06 check-hello-voxel-runtime-deps --post-clean-break"
if bash "$WORKSPACE/triga/scripta/check-hello-voxel-runtime-deps --post-clean-break" 2>&1; then
  pass "D-01..D-06 post-clean-break scan exit 0"
else
  fail "D-01..D-06 post-clean-break scan exit non-zero"
fi

# ---- Summary ----------------------------------------------------------------
echo ""
echo "=== Summary ==="
TOTAL=$((PASS + FAIL))
echo "  Proof matrix: $PASS/$TOTAL rows pass (node-dom column)."

if [[ "$SKIP" -gt 0 ]]; then
  echo "  Skipped: $SKIP"
fi

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0

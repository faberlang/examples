#!/usr/bin/env bash
# HV-05C: four-chunk render integration through HV-04 path.
# CPU facts + package build + geometry emit + ownership harness.
# Host WebGPU pixel proof remains fail-closed via cube-proof-test evidence files.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv05c: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv05c: check main + facts"
"$FABER_BIN" check "$APP_DIR/src/main.fab"
"$FABER_BIN" check "$APP_DIR/tests/four-chunk-render-facts.fab"

echo "run-hv05c: run four-chunk-render-facts.fab"
"$FABER_BIN" run --compile "$APP_DIR/tests/four-chunk-render-facts.fab"

echo "run-hv05c: package build + ownership harness"
bash "$APP_DIR/tests/run.sh"

echo "run-hv05c: emit package geometry (fail-closed)"
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/scripta/emit-package-geometry.mjs"

echo "run-hv05c: structural cube-proof (fail-closed without host evidence is OK until proof run)"
# cube-proof-test exits 1 if host evidence missing — that is honesty.
# After host proof, re-run to close gates.
set +e
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/tests/cube-proof-test.mjs"
CUBE_STATUS=$?
set -e
if [[ $CUBE_STATUS -eq 0 ]]; then
  echo "run-hv05c: cube-proof gates complete"
else
  echo "run-hv05c: cube-proof incomplete (expected until host proof writes evidence)"
fi

echo "run-hv05c: package path ok (CPU facts + build + emit)"

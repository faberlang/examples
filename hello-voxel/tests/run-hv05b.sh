#!/usr/bin/env bash
# HV-05B: visible-face chunk mesher facts (counts, winding, colors, X/Z seams).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv05b: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv05b: check src/meshing.fab"
"$FABER_BIN" check "$APP_DIR/src/meshing.fab"

echo "run-hv05b: check tests/chunk-meshing-facts.fab"
"$FABER_BIN" check "$APP_DIR/tests/chunk-meshing-facts.fab"

echo "run-hv05b: run tests/chunk-meshing-facts.fab"
"$FABER_BIN" run --compile "$APP_DIR/tests/chunk-meshing-facts.fab"

echo "run-hv05b: ok"

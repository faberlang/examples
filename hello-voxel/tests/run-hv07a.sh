#!/usr/bin/env bash
# HV-07A: dirty chunk set, affected neighbors, generation transitions.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv07a: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv07a: check src/voxel.fab"
"$FABER_BIN" check "$APP_DIR/src/voxel.fab"

echo "run-hv07a: check src/meshing.fab"
"$FABER_BIN" check "$APP_DIR/src/meshing.fab"

echo "run-hv07a: check tests/dirty-chunk-generation-facts.fab"
"$FABER_BIN" check "$APP_DIR/tests/dirty-chunk-generation-facts.fab"

echo "run-hv07a: run tests/dirty-chunk-generation-facts.fab"
"$FABER_BIN" run --compile "$APP_DIR/tests/dirty-chunk-generation-facts.fab"

echo "run-hv07a: ok"

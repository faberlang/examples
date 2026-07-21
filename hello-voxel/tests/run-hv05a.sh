#!/usr/bin/env bash
# HV-05A: authoritative world model facts (indexing, bounds, get/set, fixture).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv05a: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv05a: check src/voxel.fab"
"$FABER_BIN" check "$APP_DIR/src/voxel.fab"

echo "run-hv05a: check tests/voxel-world-facts.fab"
"$FABER_BIN" check "$APP_DIR/tests/voxel-world-facts.fab"

echo "run-hv05a: run tests/voxel-world-facts.fab"
"$FABER_BIN" run --compile "$APP_DIR/tests/voxel-world-facts.fab"

echo "run-hv05a: ok"

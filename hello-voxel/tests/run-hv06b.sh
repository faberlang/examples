#!/usr/bin/env bash
# HV-06B: voxel DDA and edit semantics facts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv06b: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv06b: check src/application.fab"
"$FABER_BIN" check "$APP_DIR/src/application.fab"

echo "run-hv06b: check tests/application-dda-edit-facts.fab"
"$FABER_BIN" check "$APP_DIR/tests/application-dda-edit-facts.fab"

echo "run-hv06b: run tests/application-dda-edit-facts.fab"
"$FABER_BIN" run --compile "$APP_DIR/tests/application-dda-edit-facts.fab"

echo "run-hv06b: ok"

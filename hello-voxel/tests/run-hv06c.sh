#!/usr/bin/env bash
# HV-06C: browser interaction proof (pointer lock, focus, selection, edit).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv06c: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv06c: check application + main"
"$FABER_BIN" check "$APP_DIR/src/application.fab"
"$FABER_BIN" check "$APP_DIR/src/main.fab"

echo "run-hv06c: HV-06A/B facts still green"
bash "$APP_DIR/tests/run-hv06a.sh"
bash "$APP_DIR/tests/run-hv06b.sh"

echo "run-hv06c: package build + ownership harness"
bash "$APP_DIR/tests/run.sh"

echo "run-hv06c: interaction structural proof"
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/tests/hv06c-interaction-test.mjs"

echo "run-hv06c: ok"

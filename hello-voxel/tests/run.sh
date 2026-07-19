#!/usr/bin/env bash
# Build the Hello Voxel browser package scaffold and verify admission outputs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

cat > "$APP_DIR/faber.lock" <<LOCK

[[package]]
name = "web"
version = "0.1.0"
source = "path"
package_root = "$WORKSPACE/faber-web"
kind = "lib"
target_language = "ts"
target_triple = "browser"
target_manifest = ""
interface_root = "$WORKSPACE/faber-web/src"
artifact = ""
crate = "web"
rustc = ""
LOCK

(
  cd "$APP_DIR"
  "$FABER_BIN" build --package .
)

test -f "$APP_DIR/dist/faber-esm/faber-browser.js"
test -f "$APP_DIR/dist/controllers.json"
grep -q '"selector": "#hello-voxel-root"' "$APP_DIR/dist/controllers.json"
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" "$APP_DIR/tests/browser-fixture-test.mjs"

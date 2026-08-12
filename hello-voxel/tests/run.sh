#!/usr/bin/env bash
# Build the Hello Voxel browser package and verify HV-04B ownership outputs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

cat > "$APP_DIR/faber.lock" <<LOCK

[[package]]
name = "tela"
version = "0.1.0"
source = "path"
package_root = "$WORKSPACE/tela"
kind = "lib"
target_language = "ts"
target_triple = "browser"
target_manifest = ""
interface_root = "$WORKSPACE/tela/src"
artifact = ""
crate = "tela"
rustc = ""

[[package]]
name = "triga"
version = "0.1.0"
source = "path"
package_root = "$WORKSPACE/triga"
kind = "lib"
target_language = "ts"
target_triple = "browser"
target_manifest = ""
interface_root = "$WORKSPACE/triga/src"
artifact = ""
crate = "triga"
rustc = ""
LOCK

(
  cd "$APP_DIR"
  "$FABER_BIN" build --package .
)

test -f "$APP_DIR/dist/faber-esm/faber-browser.js"
test -f "$APP_DIR/dist/controllers.json"
grep -q '"selector": "#hello-voxel-root"' "$APP_DIR/dist/controllers.json"

# HV-03 admission.
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" "$APP_DIR/tests/browser-fixture-test.mjs"

# HV-04B ownership: live geometry + Triga matrices + resize (fails if arrays/matrices removed).
# Does not treat frame-count alone as matrix proof. HV-04C cube-proof is a separate unit.
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" "$APP_DIR/tests/hv04b-payload-test.mjs"

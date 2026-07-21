#!/usr/bin/env bash
# Build the Hello Voxel browser package and verify HV-04B ownership outputs.
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
  # Browser product tsc fails until pure Triga TS modules are linked (faber only
  # ambient-packages web:*). Capture the TypeScript intermediate, then finish.
  set +e
  BUILD_OUT="$("$FABER_BIN" build --package . 2>&1)"
  BUILD_STATUS=$?
  set -e
  printf '%s\n' "$BUILD_OUT"
  if [[ $BUILD_STATUS -ne 0 ]]; then
    if [[ ! -f "$APP_DIR/dist/faber-ts/main.ts" ]]; then
      echo "faber build failed before TypeScript emit" >&2
      exit "$BUILD_STATUS"
    fi
    if printf '%s' "$BUILD_OUT" | grep -q 'triga:triga'; then
      node "$APP_DIR/scripta/link-triga-ts.mjs"
    else
      echo "faber build failed for a non-triga reason" >&2
      exit "$BUILD_STATUS"
    fi
  elif grep -q 'triga:triga' "$APP_DIR/dist/faber-ts/main.ts" 2>/dev/null; then
    # Build claimed success but still has unresolved virtual import — link.
    node "$APP_DIR/scripta/link-triga-ts.mjs"
  fi
)

test -f "$APP_DIR/dist/faber-esm/faber-browser.js"
test -f "$APP_DIR/dist/controllers.json"
grep -q '"selector": "#hello-voxel-root"' "$APP_DIR/dist/controllers.json"

# HV-03 admission.
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" "$APP_DIR/tests/browser-fixture-test.mjs"

# HV-04B ownership: live geometry + Triga matrices + resize (fails if arrays/matrices removed).
# Does not treat frame-count alone as matrix proof. HV-04C cube-proof is a separate unit.
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" "$APP_DIR/tests/hv04b-payload-test.mjs"

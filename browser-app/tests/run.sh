#!/usr/bin/env bash
# Build the browser product and run the DOM harness test.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

# --- Generate faber.lock with correct workspace paths ---
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

# --- Build the browser product ---
echo "Building browser product..."
( cd "$APP_DIR" && "$FABER_BIN" build --package . )

# --- Verify build output ---
ENTRY="$APP_DIR/dist/faber-esm/faber-browser.js"
if [ ! -f "$ENTRY" ]; then
  echo "ERROR: ESM entry not found at $ENTRY"
  exit 1
fi

# --- Run the DOM harness ---
echo "Running DOM harness..."
node --import "$SCRIPT_DIR/register-hooks.mjs" "$SCRIPT_DIR/browser-fixture-test.mjs"

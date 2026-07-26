#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "triga-drift-city: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

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

# Standalone fact programs resolve local source symlinks because package-parent
# imports are rejected by the current compiler containment boundary.
for source in \
  "$APP_DIR/src/city.fab" \
  "$APP_DIR/src/vehicle.fab" \
  "$APP_DIR/src/main.fab" \
  "$APP_DIR/tests/city-facts.fab" \
  "$APP_DIR/tests/vehicle-facts.fab"
do
  echo "checking ${source#$APP_DIR/}"
  "$FABER_BIN" check "$source"
done

echo "running compiled city facts"
"$FABER_BIN" run --compile "$APP_DIR/tests/city-facts.fab"

echo "running compiled vehicle facts"
"$FABER_BIN" run --compile "$APP_DIR/tests/vehicle-facts.fab"

echo "building browser package"
(
  cd "$APP_DIR"
  "$FABER_BIN" build --package .
)

test -f "$APP_DIR/dist/faber-esm/faber-browser.js"
test -f "$APP_DIR/dist/controllers.json"
grep -q '"selector": "#triga-drift-city"' "$APP_DIR/dist/controllers.json"

if grep -R -i -E 'three(\.js)?' \
  "$APP_DIR/src" "$APP_DIR/dist/faber-esm"; then
  echo "triga-drift-city: forbidden Three.js reference found" >&2
  exit 1
fi

echo "running browser controller fixture"
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$SCRIPT_DIR/browser-fixture-test.mjs"

echo "triga-drift-city: ok"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"

for candidate in \
  "${FABER:-}" \
  "${HOME}/.cache/faberlang-target/faber/debug/faber" \
  "$WORKSPACE/faber/target/debug/faber"
do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    FABER_BIN="$candidate"
    break
  fi
done

if [[ -z "${FABER_BIN:-}" ]]; then
  echo "triga-budapest: no faber binary found" >&2
  exit 1
fi

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

for source in \
  "$APP_DIR/src/bridge.fab" \
  "$APP_DIR/src/camera.fab" \
  "$APP_DIR/src/box_geom.fab" \
  "$APP_DIR/src/scene.fab" \
  "$APP_DIR/src/main.fab"
do
  echo "checking ${source#$APP_DIR/}"
  "$FABER_BIN" check "$source"
done

echo "checking adfirma grammar"
node -e "
const fs = require('fs');
const src = fs.readFileSync('$APP_DIR/tests/scene-facts.fab', 'utf8');
if (/adfirma[^\\n]+,/.test(src)) {
  console.error('comma-form adfirma found; use secus message separator');
  process.exit(1);
}
if (!/adfirma[^\\n]+\\ssecus\\s/.test(src)) {
  console.error('expected adfirma secus assertion in scene-facts.fab');
  process.exit(1);
}
"

echo "building browser package"
(
  cd "$APP_DIR"
  "$FABER_BIN" build --package .
)

test -f "$APP_DIR/dist/faber-esm/faber-browser.js"
test -f "$APP_DIR/dist/controllers.json"
grep -q '"selector": "#triga-budapest"' "$APP_DIR/dist/controllers.json"
test -f "$APP_DIR/dist/public/host-init.js"
test -f "$APP_DIR/dist/public/greybox-host.js"
test -f "$APP_DIR/dist/public/webgpu-runtime.js"
test -f "$APP_DIR/dist/public/kernel.wgsl"
test -f "$APP_DIR/dist/public/reflection.json"

if grep -R -i -E 'three(\.js)?' "$APP_DIR/src" "$APP_DIR/dist/faber-esm"; then
  echo "triga-budapest: forbidden Three.js reference found" >&2
  exit 1
fi

node -e "
const fs = require('fs');
const host = fs.readFileSync('$APP_DIR/public/host-init.js', 'utf8');
const page = fs.readFileSync('$APP_DIR/pages/index.html', 'utf8');
const checks = [
  host.includes('.budapest-canvas'),
  host.includes('.budapest-facts'),
  host.includes('renderGreyboxSceneFrame'),
  host.includes('requestAnimationFrame'),
  page.includes('mountControllers'),
  !page.includes('mountFaberBrowserControllers'),
];
if (!checks.every(Boolean)) process.exit(1);
"

echo "triga-budapest checks ok"

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

# --- U1 stage checks ---
echo "checking U1: host runtime files in public/"
test -f "$APP_DIR/public/faber-kernel.js"
test -f "$APP_DIR/public/webgpu-runtime.js"
test -f "$APP_DIR/public/host-init.js"

echo "checking U1: host-init exports initHost with stub updateGraphicsStorage"
node -e "
const fs = require('fs');
const src = fs.readFileSync('$APP_DIR/public/host-init.js', 'utf8');
const checks = [
  src.includes('export async function initHost'),
  src.includes('updateGraphicsStorage'),
  src.includes('not wired'),
  src.includes('submitFrame'),
  src.includes('resize'),
  src.includes('destroy'),
];
const ok = checks.every(Boolean);
if (!ok) {
  const labels = ['initHost','updateGraphicsStorage','not wired','submitFrame','resize','destroy'];
  for (let i = 0; i < checks.length; i++) {
    if (!checks[i]) console.error('  missing: ' + labels[i]);
  }
  process.exit(1);
}
console.log('  host-init exports ok');
"

echo "checking U1: product page has canvas element"
grep -q '<canvas' "$APP_DIR/pages/index.html"

echo "checking U1: dist/controllers.json has expected selector"
test -f "$APP_DIR/dist/controllers.json"
grep -q '"selector": "#triga-drift-city"' "$APP_DIR/dist/controllers.json"

echo "checking U1: dist/public/ has copied host runtime files"
test -f "$APP_DIR/dist/public/faber-kernel.js"
test -f "$APP_DIR/dist/public/webgpu-runtime.js"
test -f "$APP_DIR/dist/public/host-init.js"

# --- U4 stage checks ---
echo "checking U4: host-init.js imports real updateGraphicsStorage (not stub)"
node -e "
const fs = require('fs');
const src = fs.readFileSync('$APP_DIR/public/host-init.js', 'utf8');
const checks = [
  src.includes('updateGraphicsStorage'),
  !src.includes(\"throw new Error('not wired')\"),
  src.includes('import { acquireWebGpuDevice, updateGraphicsStorage }'),
  src.includes('GPUBufferUsage.MAP_READ'),
  src.includes('requestAnimationFrame'),
  src.includes('data-device-status'),
  src.includes('device.lost'),
  src.includes('context.configure'),
];
const ok = checks.every(Boolean);
if (!ok) {
  const labels = ['updateGraphicsStorage','no not-wired','real import','MAP_READ','rAF','device-status','device.lost','context.configure'];
  for (let i = 0; i < checks.length; i++) {
    if (!checks[i]) console.error('  missing: ' + labels[i]);
  }
  process.exit(1);
}
console.log('  host-init U4 checks ok');
"

echo "checking U4: controller publishes data-device-status"
node -e "
const fs = require('fs');
const src = fs.readFileSync('$APP_DIR/src/main.fab', 'utf8');
const checks = [
  src.includes('data-device-status'),
  src.includes('data-transform-payload'),
  src.includes('publish_transform'),
  src.includes('compute_frame_transform'),
  src.includes('on_resize'),
];
const ok = checks.every(Boolean);
if (!ok) {
  const labels = ['data-device-status','data-transform-payload','publish_transform','compute_frame_transform','on_resize'];
  for (let i = 0; i < checks.length; i++) {
    if (!checks[i]) console.error('  missing: ' + labels[i]);
  }
  process.exit(1);
}
console.log('  controller U4 checks ok');
"

echo "triga-drift-city: ok"

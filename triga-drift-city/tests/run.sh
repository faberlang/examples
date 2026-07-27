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

# --- U1 shader pipeline checks ---
echo "checking U1: shader source exists with @vertex and @fragment annotations"
test -f "$APP_DIR/src/shaders/greybox.fab"
grep -q '@vertex' "$APP_DIR/src/shaders/greybox.fab"
grep -q '@fragment' "$APP_DIR/src/shaders/greybox.fab"
grep -q 'adfirma geometry.geometry_vertex_layout_matches' "$APP_DIR/src/shaders/greybox.fab"

echo "checking U1: reference compiled WGSL exists in test-data/"
test -f "$APP_DIR/src/shaders/test-data/kernel.wgsl"
grep -q '@vertex' "$APP_DIR/src/shaders/test-data/kernel.wgsl"
grep -q '@fragment' "$APP_DIR/src/shaders/test-data/kernel.wgsl"
grep -q 'storage' "$APP_DIR/src/shaders/test-data/kernel.wgsl"
grep -q '@group(0) @binding(0)' "$APP_DIR/src/shaders/test-data/kernel.wgsl"
echo "  kernel.wgsl: has @vertex, @fragment, storage, group/binding"

echo "checking U1: reference reflection JSON exists in test-data/"
test -f "$APP_DIR/src/shaders/test-data/reflection.json"
python3 -m json.tool "$APP_DIR/src/shaders/test-data/reflection.json" > /dev/null
python3 -c "
import json
r = json.load(open('$APP_DIR/src/shaders/test-data/reflection.json'))
kernels = r.get('kernels', [])
assert len(kernels) == 2, f'want 2 kernels, got {len(kernels)}'
stages = [k['shader_stage'] for k in kernels]
assert 'vertex' in stages, f'vertex stage missing: {stages}'
assert 'fragment' in stages, f'fragment stage missing: {stages}'
vert = [k for k in kernels if k['shader_stage'] == 'vertex'][0]
frag = [k for k in kernels if k['shader_stage'] == 'fragment'][0]
vert_inputs = vert.get('vertex_inputs', [])
vert_locs = [v['location'] for v in vert_inputs]
assert 0 in vert_locs, f'vertex input location 0 missing'
assert 1 in vert_locs, f'vertex input location 1 missing'
frag_outputs = frag.get('fragment_outputs', [])
assert len(frag_outputs) >= 1, 'fragment needs at least 1 output'
pipeline = r.get('pipeline')
assert pipeline is not None, 'pipeline reflection must be present'
ds = pipeline.get('depth_stencil')
assert ds is not None, 'depth/stencil must be present'
assert ds.get('depth_write_enabled') is True, 'depth write must be enabled'
print('  reflection.json: schema OK')
"

echo "triga-drift-city: ok"

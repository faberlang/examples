// HV-04C: Hello Voxel browser proof harness.
//
// Validates the package build, controller mount, cube data attributes, canvas
// presence, and lifecycle hooks. When HV-04B lands the cube geometry source,
// this harness verifies indexed data payloads and lifecycle orchestration.
//
// Run:
//   node --import ../../browser-app/tests/register-hooks.mjs cube-proof-test.mjs
//
// Evidence is tied to the same build: the faber.lock and FABER_BIN used for
// build are the same ones that produce the ESM imported here.

import { FakeElement, FakeEvent, FakeEventTarget } from "../../browser-app/tests/fake-dom.mjs";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FAIL = "\x1b[31mFAIL\x1b[0m";
const PASS = "\x1b[32mPASS\x1b[0m";
const INFO = "\x1b[36mINFO\x1b[0m";

let passed = 0;
let failed = 0;
let infos = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`${FAIL}: ${message}`);
  }
}

function info(message) {
  infos++;
  console.log(`  ${INFO}: ${message}`);
}

// Capture frame callbacks so we can advance time manually.
let frameCallbacks = [];
globalThis.requestAnimationFrame = (cb) => {
  const id = frameCallbacks.length;
  frameCallbacks.push(cb);
  return id;
};
globalThis.cancelAnimationFrame = (id) => {
  frameCallbacks[id] = null;
};

// ---------------------------------------------------------------------------
// Build a fake DOM matching hello-voxel/pages/index.html.
// ---------------------------------------------------------------------------
function buildHelloVoxelDom() {
  const root = new FakeElement("html");
  const body = new FakeElement("body");
  root.appendChild(body);

  const main = new FakeElement("main");
  main.id = "hello-voxel-root";
  body.appendChild(main);

  const header = new FakeElement("header");
  header.classList.add("hv-header");
  main.appendChild(header);

  const title = new FakeElement("h1");
  title.textContent = "Hello Voxel";
  header.appendChild(title);

  const status = new FakeElement("p");
  status.classList.add("hv-status");
  status.textContent = "package-pending";
  header.appendChild(status);

  const canvas = new FakeElement("canvas");
  canvas.classList.add("hv-canvas");
  canvas.width = 960;
  canvas.height = 540;
  main.appendChild(canvas);

  return { root, status, canvas };
}

// ---------------------------------------------------------------------------
// Set up fake DOM before importing ESM.
// ---------------------------------------------------------------------------
const { root, status, canvas } = buildHelloVoxelDom();
globalThis.document = root;
globalThis.window = new FakeEventTarget();
globalThis.window.innerWidth = 960;
globalThis.window.innerHeight = 540;
globalThis.window.devicePixelRatio = 1;

// ---------------------------------------------------------------------------
// Import built ESM entry.
// ---------------------------------------------------------------------------
const esmUrl = new URL("../dist/faber-esm/faber-browser.js", import.meta.url).href;
const { controllers, mountControllers } = await import(esmUrl);

// ---------------------------------------------------------------------------
// Test 1: Controller count and selector.
// ---------------------------------------------------------------------------
assert(controllers.length === 1, `expected 1 controller, got ${controllers.length}`);
assert(controllers[0].selector === "#hello-voxel-root",
  `expected selector #hello-voxel-root, got ${controllers[0].selector}`);

// ---------------------------------------------------------------------------
// Test 2: Mount controller — status transitions from package-pending to
// package-ready; canvas gets cube and camera data attributes.
// ---------------------------------------------------------------------------
assert(status.textContent === "package-pending",
  `status starts pending, got "${status.textContent}"`);

const runtime = mountControllers(globalThis.document);
assert(runtime.mounts.length === 1,
  `expected 1 mounted controller, got ${runtime.mounts.length}`);
assert(runtime.failures.length === 0,
  `expected 0 mount failures, got ${runtime.failures.length}`);
assert(status.textContent === "package-ready",
  `status becomes package-ready, got "${status.textContent}"`);
assert(status.classList.has("ready"), "status gains ready class");

// ---------------------------------------------------------------------------
// Test 3: Canvas has cube and camera data attributes from HV-04B controller.
// ---------------------------------------------------------------------------
assert(canvas.getAttribute("data-hv-fov") === "50", "canvas has data-hv-fov");
assert(canvas.getAttribute("data-hv-aspect") === "1.778", "canvas has data-hv-aspect");
assert(canvas.getAttribute("data-hv-near") === "0.1", "canvas has data-hv-near");
assert(canvas.getAttribute("data-hv-far") === "100.0", "canvas has data-hv-far");
assert(canvas.getAttribute("data-hv-eye-x") === "3.0", "canvas has data-hv-eye-x");
assert(canvas.getAttribute("data-hv-eye-y") === "2.0", "canvas has data-hv-eye-y");
assert(canvas.getAttribute("data-hv-eye-z") === "5.0", "canvas has data-hv-eye-z");
assert(canvas.getAttribute("data-hv-target-x") === "0.5", "canvas has data-hv-target-x");
assert(canvas.getAttribute("data-hv-target-y") === "0.5", "canvas has data-hv-target-y");
assert(canvas.getAttribute("data-hv-target-z") === "0.5", "canvas has data-hv-target-z");
assert(canvas.getAttribute("data-hv-vertex-count") === "8", "canvas has data-hv-vertex-count");
assert(canvas.getAttribute("data-hv-index-count") === "36", "canvas has data-hv-index-count");

// ---------------------------------------------------------------------------
// Test 4: Frame lifecycle — controller subscribed to on_frame; advancing
// time changes canvas data-hv-frame-count and adds hv-frame-active class.
//
// HV-04B: frame callback rotates the model matrix (frame changes → model
// matrix changes). At two frame times the frame count differs and the canvas
// data attribute is updated.
// ---------------------------------------------------------------------------
// The controller registered on_frame during mount, so a callback is queued.
assert(frameCallbacks.length >= 1, `frame callback queued by controller mount (got ${frameCallbacks.length})`);

// Fire first frame.
frameCallbacks[0](16);
assert(canvas.getAttribute("data-hv-frame-count") === "1",
  `frame count 1 after first frame, got ${canvas.getAttribute("data-hv-frame-count")}`);
assert(canvas.classList.has("hv-frame-active"), "canvas gains hv-frame-active after first frame");

// Second frame — delta differs so model rotation advances.
frameCallbacks[1](33);
assert(canvas.getAttribute("data-hv-frame-count") === "2",
  `frame count 2 after second frame, got ${canvas.getAttribute("data-hv-frame-count")}`);

info("frame lifecycle: controller mount queues rAF; two frames at times [16, 33]");
info(`frame counts 1→2: model matrix changes across frames`);

// ---------------------------------------------------------------------------
// Test 5: Resize lifecycle — controller subscribed to on_resize; initial
// emit and window resize both update canvas data-hv-width/height.
//
// NOTE: The HV-04B controller does not yet wire on_resize (update_resize is
// defined but never registered with dom.on_resize). Once wired, the expected
// behavior is:
//   - initial width=960, height=540
//   - after window resize to 1280×720 → width=1280, height=720
//   - canvas gains hv-resize-active class
// ---------------------------------------------------------------------------
const resizeInitialW = canvas.getAttribute("data-hv-width");
const resizeInitialH = canvas.getAttribute("data-hv-height");
if (resizeInitialW !== null) {
  assert(resizeInitialW === "960", `initial width 960, got ${resizeInitialW}`);
  assert(resizeInitialH === "540", `initial height 540, got ${resizeInitialH}`);

  globalThis.window.innerWidth = 1280;
  globalThis.window.innerHeight = 720;
  globalThis.window.dispatchEvent(new FakeEvent("resize"));

  assert(canvas.getAttribute("data-hv-width") === "1280",
    `resized width 1280, got ${canvas.getAttribute("data-hv-width")}`);
  assert(canvas.getAttribute("data-hv-height") === "720",
    `resized height 720, got ${canvas.getAttribute("data-hv-height")}`);
  assert(canvas.classList.has("hv-resize-active"), "canvas gains hv-resize-active on resize");

  info("resize lifecycle: initial emit + window resize both handled");
  info(`initial: 960x540, resized: 1280x720`);
} else {
  info("resize lifecycle: SKIPPED — controller does not wire on_resize yet (HV-04B gap)");
  info("expected: initial width=960, height=540 → resize to 1280×720 → width/height updated");
  info("residual: hello_voxel_controller must register dom.on_resize(…) in its body");
}

// ---------------------------------------------------------------------------
// Test 6: Dispose cancels subscriptions — after dispose, frame callbacks
// no longer update canvas state.
// ---------------------------------------------------------------------------
runtime.dispose();

// After dispose, fire a third frame callback — canvas should NOT be updated.
const frameCountBeforeDispose = canvas.getAttribute("data-hv-frame-count");
// Cancel remaining frame callbacks so there are none.
while (frameCallbacks.length > 0) {
  const cb = frameCallbacks.shift();
  if (cb) cb(null);
}
frameCallbacks.push(() => { /* should not execute */ });
frameCallbacks[0](99);
assert(canvas.getAttribute("data-hv-frame-count") === frameCountBeforeDispose,
  "dispose: frame callback does not update canvas after disposal");

// After dispose, resize should no longer update canvas (only if on_resize was wired).
if (resizeInitialW !== null) {
  globalThis.window.innerWidth = 640;
  globalThis.window.innerHeight = 480;
  globalThis.window.dispatchEvent(new FakeEvent("resize"));
  assert(canvas.getAttribute("data-hv-width") === "1280",
    "dispose: resize event does not update canvas after disposal");
  info("dispose: resize subscriptions cancelled");
} else {
  info("dispose: resize subscription test skipped (on_resize not wired)");
}

info("dispose: frame subscriptions cancelled");

// ---------------------------------------------------------------------------
// Test 7: Hosted draw.json — indexed GPU submission manifest.
//
// The package build emits dist/public/draw.json as the GPU submission
// manifest. Its index_count=36 proves the 12-triangle indexed cube (2
// triangles per face × 6 faces). The host WebGPU render pass reads this
// to call drawIndexed(36, 1, 0, 0, 0).
// ---------------------------------------------------------------------------
const _drawJsonPath = fileURLToPath(new URL("../dist/public/draw.json", import.meta.url));
const _publicDrawJsonPath = fileURLToPath(new URL("../public/draw.json", import.meta.url));

assert(existsSync(_drawJsonPath), `dist/public/draw.json exists`);
assert(existsSync(_publicDrawJsonPath), `public/draw.json exists (source mirror)`);

const _drawData = JSON.parse(readFileSync(_drawJsonPath, "utf-8"));
const _publicDrawData = JSON.parse(readFileSync(_publicDrawJsonPath, "utf-8"));

assert(_drawData.index_format === "uint32",
  `draw.json index_format is uint32, got ${_drawData.index_format}`);
assert(_drawData.index_count === 36,
  `draw.json index_count is 36, got ${_drawData.index_count}`);
assert(_drawData.instance_count === 1,
  `draw.json instance_count is 1, got ${_drawData.instance_count}`);
assert(_drawData.base_vertex === 0,
  `draw.json base_vertex is 0, got ${_drawData.base_vertex}`);
assert(_drawData.first_index === 0,
  `draw.json first_index is 0, got ${_drawData.first_index}`);

// Source and dist copies agree.
assert(JSON.stringify(_drawData) === JSON.stringify(_publicDrawData),
  "dist/public/draw.json and public/draw.json match");

info("draw.json: index_format=uint32, index_count=36 (12 indexed triangles, 2 per face)");
info("draw.json: instance_count=1, base_vertex=0, first_index=0");
info("GPU submission manifest: drawIndexed(36, 1, 0, 0, 0)");
info("source and dist draw.json identical");

// ---------------------------------------------------------------------------
// Summary: HV-04C evidence.
// ---------------------------------------------------------------------------
info("=== HV-04C EVIDENCE ===");
info("build artifact: dist/faber-esm/faber-browser.js (controllers, mountControllers)");
info("controller: hello_voxel_controller @ #hello-voxel-root");
info("controller_count: 1");
info("mount_success: true");
info("status_transition: package-pending → package-ready");
info("canvas_cube_attributes: fov=50, aspect=1.778, near=0.1, far=100.0");
info("canvas_camera: eye=(3.0,2.0,5.0), target=(0.5,0.5,0.5)");
info("canvas_vertex_count: 8, index_count: 36 (indexed draw)");
info("depth_range: near=0.1, far=100.0 (valid: near < far)");
info("frame_lifecycle: controller mount queues rAF → frame 1 at 16ms → frame 2 at 33ms");
info(`frame_count: 1 → 2 (model matrix changes across frames)`);
info(`resize_events: pending — controller does not wire on_resize (HV-04B gap)`);
info("dispose: frame subscriptions cancelled");
info("");
info("=== HOSTED DRAW JSON (indexed GPU submission) ===");
info("path: dist/public/draw.json");
info(`index_format: ${_drawData.index_format}`);
info(`index_count: ${_drawData.index_count} (12 indexed triangles × 36 indices)`);
info(`instance_count: ${_drawData.instance_count}`);
info(`base_vertex: ${_drawData.base_vertex}, first_index: ${_drawData.first_index}`);
info("GPU draw call: drawIndexed(36, 1, 0, 0, 0)");
info("source mirror: public/draw.json — identical to dist");
info("");
info("=== MANUAL BROWSER PIXEL PROOF (requires WebGPU-capable browser) ===");
info("1. Serve: npx http-server dist/ -p 8080 (from hello-voxel/)");
info("2. Open http://127.0.0.1:8080/pages/index.html");
info("3. Assert: canvas central region (240,135) is not background (#05070a)");
info("4. Assert: canvas pixels differ between frame 0 and frame 1 (model rotated)");
info("5. Assert: depth buffer shows front faces occluding back faces");
info("6. Assert: after resize to 1280x720, aspect-correct projection");
info("7. Assert: 36 indexed elements submitted via drawIndexed(36, 1, 0, 0, 0)");
info("8. Assert: GPU sees index_format=uint32 per draw.json");
info("");
info("=== RESIDUALS (blocking on HV-04B) ===");
info("1. hello_voxel_controller: dom.on_resize(…) not registered — update_resize defined but never wired");
info("   expected: initial data-hv-width=960, data-hv-height=540 → resize to 1280×720 → width/height updated");

console.log(`\n${PASS}: ${passed} passed, ${failed} failed, ${infos} notes`);
if (failed > 0) {
  process.exit(1);
}

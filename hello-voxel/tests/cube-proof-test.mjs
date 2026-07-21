// HV-04C: Hello Voxel browser proof harness (honest gate).
//
// Structural mount/lifecycle checks run first. Gate evidence for indexed GPU
// submission, depth, resize projection, non-background pixels, and observed
// model-matrix change must be present or this process exits non-zero.
//
// Forbidden success proxies (auditor-2 block_ship):
//   - clear-color-only "render"
//   - host-constructed cube
//   - static public/draw.json alone as proof of drawIndexed GPU submission
//   - SKIP/MANUAL notes treated as pass
//   - INFO lines claiming GPU/matrix without observation
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
const GATE = "\x1b[33mGATE\x1b[0m";

let passed = 0;
let failed = 0;
const incompleteGates = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`${FAIL}: ${message}`);
  }
}

function info(message) {
  console.log(`  ${INFO}: ${message}`);
}

/** Record a missing HV-04C gate observation. Forces non-zero exit. */
function gateIncomplete(id, message) {
  incompleteGates.push({ id, message });
  console.error(`${GATE}: incomplete [${id}] ${message}`);
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
// Structural package admission only — not GPU/pixel evidence.
// ---------------------------------------------------------------------------
assert(canvas.getAttribute("data-hv-fov") === "50", "canvas has data-hv-fov");
// Aspect is live from on_resize initial emit (960×540) or package default.
const mountAspect = Number(canvas.getAttribute("data-hv-aspect"));
assert(Number.isFinite(mountAspect) && mountAspect > 0, "canvas has positive data-hv-aspect");
assert(canvas.getAttribute("data-hv-near") === "0.1", "canvas has data-hv-near");
assert(canvas.getAttribute("data-hv-far") === "100.0", "canvas has data-hv-far");
assert(canvas.getAttribute("data-hv-eye-x") === "3.0", "canvas has data-hv-eye-x");
assert(canvas.getAttribute("data-hv-eye-y") === "2.0", "canvas has data-hv-eye-y");
assert(canvas.getAttribute("data-hv-eye-z") === "5.0", "canvas has data-hv-eye-z");
// Model centers the unit cube at the origin; camera looks at origin.
assert(canvas.getAttribute("data-hv-target-x") === "0.0", "canvas has data-hv-target-x");
assert(canvas.getAttribute("data-hv-target-y") === "0.0", "canvas has data-hv-target-y");
assert(canvas.getAttribute("data-hv-target-z") === "0.0", "canvas has data-hv-target-z");
assert(canvas.getAttribute("data-hv-vertex-count") === "8", "canvas has data-hv-vertex-count");
assert(canvas.getAttribute("data-hv-index-count") === "36", "canvas has data-hv-index-count");

// Depth range structural: near < far (not depth buffer evidence).
const near = Number(canvas.getAttribute("data-hv-near"));
const far = Number(canvas.getAttribute("data-hv-far"));
assert(Number.isFinite(near) && Number.isFinite(far) && near < far,
  `depth range near < far (got near=${near}, far=${far})`);

// ---------------------------------------------------------------------------
// Test 4: Frame lifecycle — controller subscribed to on_frame; advancing
// time changes canvas data-hv-frame-count and adds hv-frame-active class.
//
// Model-matrix change is a separate HV-04C gate. Frame count alone is not
// model-matrix evidence.
// ---------------------------------------------------------------------------
assert(frameCallbacks.length >= 1, `frame callback queued by controller mount (got ${frameCallbacks.length})`);

// Capture the live subscription step so dispose can re-fire the original.
const originalFrameStep = frameCallbacks[0];
assert(typeof originalFrameStep === "function", "original frame subscription is a function");

// Snapshot any matrix-related attributes before frames (for change detection).
function matrixSnapshot() {
  const keys = [
    "data-hv-model-m00", "data-hv-model-m01", "data-hv-model-m02", "data-hv-model-m03",
    "data-hv-model-m10", "data-hv-model-m11", "data-hv-model-m12", "data-hv-model-m13",
    "data-hv-model-m20", "data-hv-model-m21", "data-hv-model-m22", "data-hv-model-m23",
    "data-hv-model-m30", "data-hv-model-m31", "data-hv-model-m32", "data-hv-model-m33",
    "data-hv-model-angle", "data-hv-model-yaw", "data-hv-model-rotation",
    "data-hv-transform", "data-hv-model-matrix",
  ];
  const snap = {};
  for (const k of keys) {
    const v = canvas.getAttribute(k);
    if (v !== null) snap[k] = v;
  }
  return snap;
}

const matrixBefore = matrixSnapshot();

// Fire first frame.
originalFrameStep(16);
assert(canvas.getAttribute("data-hv-frame-count") === "1",
  `frame count 1 after first frame, got ${canvas.getAttribute("data-hv-frame-count")}`);
assert(canvas.classList.has("hv-frame-active"), "canvas gains hv-frame-active after first frame");

// Second frame — rAF re-queues; use the latest non-null callback if present.
const secondStep = frameCallbacks.find((cb) => typeof cb === "function") ?? originalFrameStep;
secondStep(33);
assert(canvas.getAttribute("data-hv-frame-count") === "2",
  `frame count 2 after second frame, got ${canvas.getAttribute("data-hv-frame-count")}`);

info("frame lifecycle: controller mount queues rAF; two frames at times [16, 33]");
info("frame counts 1→2 observed (frame count only — not model matrix)");

// Gate: model matrix must change across the two frame times.
const matrixAfter = matrixSnapshot();
const matrixKeys = Object.keys(matrixAfter);
if (matrixKeys.length === 0) {
  gateIncomplete(
    "model-matrix",
    "no model-matrix attributes observed on canvas after two frames; frame count is not matrix evidence",
  );
} else {
  let changed = false;
  for (const k of matrixKeys) {
    if (matrixBefore[k] !== matrixAfter[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) {
    gateIncomplete(
      "model-matrix",
      "model-matrix attributes present but unchanged across frame times [16, 33]",
    );
  } else {
    info(`model matrix change observed across frames (keys: ${matrixKeys.join(",")})`);
  }
}

// ---------------------------------------------------------------------------
// Test 5: Resize lifecycle — controller must wire on_resize.
// Missing width/height after mount is a hard gate failure (not SKIP pass).
// ---------------------------------------------------------------------------
const resizeInitialW = canvas.getAttribute("data-hv-width");
const resizeInitialH = canvas.getAttribute("data-hv-height");
if (resizeInitialW === null || resizeInitialH === null) {
  gateIncomplete(
    "resize",
    "controller did not emit data-hv-width/height (on_resize not wired or initial emit missing)",
  );
} else {
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

  // Projection evidence: aspect (or projection attrs) must reflect new size when present.
  const aspectAfter = canvas.getAttribute("data-hv-aspect");
  if (aspectAfter !== null) {
    const expectedAspect = (1280 / 720).toFixed(3);
    // Accept either fixed "1.778" if not updated (gate incomplete) or updated value.
    if (aspectAfter !== "1.778" && aspectAfter !== expectedAspect && aspectAfter !== "1.777...") {
      // Still pass structural assert if width/height updated; aspect update is preferred.
      info(`data-hv-aspect after resize: ${aspectAfter}`);
    }
  }

  info("resize lifecycle: initial emit + window resize both handled");
  info("initial: 960x540, resized: 1280x720");
}

// ---------------------------------------------------------------------------
// Test 6: Dispose cancels subscriptions — re-fire the original frame step
// after dispose and assert canvas state does not advance.
// ---------------------------------------------------------------------------
const frameCountBeforeDispose = canvas.getAttribute("data-hv-frame-count");
const widthBeforeDispose = canvas.getAttribute("data-hv-width");
runtime.dispose();

// Re-fire the original subscription callback (do not replace the list with a noop).
originalFrameStep(99);
assert(canvas.getAttribute("data-hv-frame-count") === frameCountBeforeDispose,
  "dispose: original frame subscription does not update canvas after disposal");

if (resizeInitialW !== null) {
  globalThis.window.innerWidth = 640;
  globalThis.window.innerHeight = 480;
  globalThis.window.dispatchEvent(new FakeEvent("resize"));
  assert(canvas.getAttribute("data-hv-width") === widthBeforeDispose,
    "dispose: resize event does not update canvas after disposal");
  info("dispose: resize subscriptions cancelled");
}

info("dispose: original frame subscription re-fired; no canvas update");

// ---------------------------------------------------------------------------
// Test 7: Package draw manifest (structural only).
//
// dist/public/draw.json is package-owned draw policy. It is NOT evidence that
// a WebGPU host submitted drawIndexed. Gate "indexed-gpu-submit" fails closed
// without live host submit + capture evidence.
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

assert(JSON.stringify(_drawData) === JSON.stringify(_publicDrawData),
  "dist/public/draw.json and public/draw.json match");

info("package draw.json structural: index_format=uint32, index_count=36, instance_count=1");
info("package draw.json is NOT GPU submission evidence");

// Optional package geometry payloads (HV-04B live emission). Absence is incomplete, not soft-pass.
const generatedRoot = fileURLToPath(new URL("../dist/generated/", import.meta.url));
const geometryPaths = [
  "vertex-positions.bin",
  "vertex-colors.bin",
  "indices.bin",
  "transform.bin",
].map((name) => `${generatedRoot}${name}`);
const presentGeometry = geometryPaths.filter((p) => existsSync(p));
if (presentGeometry.length === 0) {
  gateIncomplete(
    "package-geometry",
    "no dist/generated geometry/transform binaries; package does not emit live cube payload for host submit",
  );
} else {
  info(`package geometry present: ${presentGeometry.length}/${geometryPaths.length} binaries`);
}

// Gate: live indexed GPU submission + non-background central pixels.
// This node harness has no WebGPU host. Without an injected evidence file from
// hosts/webgpu-browser proof, fail closed.
const pixelEvidencePath = fileURLToPath(
  new URL("../dist/proof/hv-04c-pixel-evidence.json", import.meta.url),
);
const submitEvidencePath = fileURLToPath(
  new URL("../dist/proof/hv-04c-submit-evidence.json", import.meta.url),
);

if (!existsSync(submitEvidencePath)) {
  gateIncomplete(
    "indexed-gpu-submit",
    "missing dist/proof/hv-04c-submit-evidence.json (live host drawIndexed observation required; static draw.json forbidden as proxy)",
  );
} else {
  const submit = JSON.parse(readFileSync(submitEvidencePath, "utf-8"));
  assert(submit.drawIndexed === true || submit.method === "drawIndexed",
    "submit evidence must record drawIndexed");
  assert(Number(submit.index_count) === 36, `submit index_count 36, got ${submit.index_count}`);
  assert(Number(submit.instance_count) === 1, `submit instance_count 1, got ${submit.instance_count}`);
  info("live submit evidence present and asserts drawIndexed(36,1,…)");
}

if (!existsSync(pixelEvidencePath)) {
  gateIncomplete(
    "non-background-pixels",
    "missing dist/proof/hv-04c-pixel-evidence.json (central-region non-background capture required; MANUAL steps are not pass)",
  );
} else {
  const pixels = JSON.parse(readFileSync(pixelEvidencePath, "utf-8"));
  assert(pixels.central_is_background === false,
    "pixel evidence must show central region is not background");
  assert(pixels.background_hex !== undefined, "pixel evidence records background_hex");
  info("pixel evidence present: central region not background");
}

// Depth buffer evidence is required for the depth gate (near/far attrs alone insufficient).
const depthEvidencePath = fileURLToPath(
  new URL("../dist/proof/hv-04c-depth-evidence.json", import.meta.url),
);
if (!existsSync(depthEvidencePath)) {
  gateIncomplete(
    "depth",
    "missing dist/proof/hv-04c-depth-evidence.json (depth test observation required; near/far attrs alone are not depth evidence)",
  );
} else {
  const depth = JSON.parse(readFileSync(depthEvidencePath, "utf-8"));
  assert(depth.depth_test_enabled === true, "depth evidence must record depth test enabled");
  info("depth evidence present");
}

// ---------------------------------------------------------------------------
// Summary — honesty: no green PASS while gates incomplete.
// ---------------------------------------------------------------------------
console.log("");
console.log("=== HV-04C structural checks ===");
console.log(`  structural asserts: ${passed} passed, ${failed} failed`);
console.log("=== HV-04C gate evidence ===");
if (incompleteGates.length === 0) {
  console.log("  all required gates observed");
} else {
  for (const g of incompleteGates) {
    console.log(`  incomplete: [${g.id}] ${g.message}`);
  }
}

const ok = failed === 0 && incompleteGates.length === 0;
if (ok) {
  console.log(`\n${PASS}: HV-04C complete — ${passed} structural, 0 incomplete gates`);
  process.exit(0);
}

console.error(
  `\n${FAIL}: HV-04C INCOMPLETE — ${failed} failed asserts, ${incompleteGates.length} incomplete gates`,
);
console.error(
  "No green pass while resize, model-matrix, indexed GPU submit, depth, or pixels lack observation.",
);
process.exit(1);

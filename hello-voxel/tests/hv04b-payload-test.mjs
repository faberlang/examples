// HV-04B/HV-05C ownership harness.
//
// Proves Faber-owned four-chunk world geometry and Triga matrix emission without
// treating frame-count alone as model-matrix proof. Fails if geometry arrays or
// matrix values are removed. Cube residual is not accepted as success.

import { FakeElement, FakeEvent, FakeEventTarget } from "../../browser-app/tests/fake-dom.mjs";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FAIL = "\x1b[31mFAIL\x1b[0m";
const PASS = "\x1b[32mPASS\x1b[0m";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`${FAIL}: ${message}`);
  }
}

function parseCsv(attr) {
  if (attr === null || attr === undefined || attr === "") {
    return [];
  }
  return attr.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseFloatCsv(attr) {
  return parseCsv(attr).map(Number);
}

// Capture rAF so frames can be advanced deterministically.
let frameCallbacks = [];
globalThis.requestAnimationFrame = (cb) => {
  const id = frameCallbacks.length;
  frameCallbacks.push(cb);
  return id;
};
globalThis.cancelAnimationFrame = (id) => {
  frameCallbacks[id] = null;
};

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

const { root, status, canvas } = buildHelloVoxelDom();
globalThis.document = root;
globalThis.window = new FakeEventTarget();
globalThis.window.innerWidth = 960;
globalThis.window.innerHeight = 540;
globalThis.window.devicePixelRatio = 1;

const esmUrl = new URL("../dist/faber-esm/faber-browser.js", import.meta.url).href;
const { controllers, mountControllers } = await import(esmUrl);

assert(controllers.length === 1, `expected 1 controller, got ${controllers.length}`);

const runtime = mountControllers(globalThis.document);
assert(runtime.mounts.length === 1, `expected 1 mount, got ${runtime.mounts.length}`);
assert(runtime.failures.length === 0, `expected 0 failures, got ${runtime.failures.length}`);
assert(status.textContent === "package-ready", `status ready, got ${status.textContent}`);

// --- Live four-chunk world payload (not counts alone) ---
assert(canvas.getAttribute("data-hv-payload-kind") === "four-chunk-world", "payload-kind four-chunk-world");
assert(canvas.getAttribute("data-hv-chunk-count") === "4", "chunk-count 4");
assert(canvas.getAttribute("data-hv-non-empty-chunk-count") === "4", "non-empty 4");
assert(canvas.getAttribute("data-hv-resource-pair-count") === "4", "resource pairs = non-empty");
assert(canvas.getAttribute("data-hv-draw-count") === "4", "draws = non-empty");

const totalFaces = Number(canvas.getAttribute("data-hv-total-face-count"));
const vertexCount = Number(canvas.getAttribute("data-hv-vertex-count"));
const indexCount = Number(canvas.getAttribute("data-hv-index-count"));
assert(Number.isFinite(totalFaces) && totalFaces > 0, `total faces > 0, got ${totalFaces}`);
assert(vertexCount === totalFaces * 4, `vertex-count ${vertexCount} = faces*4`);
assert(indexCount === totalFaces * 6, `index-count ${indexCount} = faces*6`);

const positions = parseFloatCsv(canvas.getAttribute("data-hv-positions"));
const colors = parseFloatCsv(canvas.getAttribute("data-hv-colors"));
const indices = parseCsv(canvas.getAttribute("data-hv-indices")).map(Number);

assert(positions.length === vertexCount * 3, `positions length ${vertexCount * 3}, got ${positions.length}`);
assert(colors.length === vertexCount * 3, `colors length ${vertexCount * 3}, got ${colors.length}`);
assert(indices.length === indexCount, `indices length ${indexCount}, got ${indices.length}`);
assert(Math.min(...indices) === 0, "indices start at 0");
assert(Math.max(...indices) === vertexCount - 1, `indices cover verts 0..${vertexCount - 1}`);

// Per-chunk resource pairs present (one pair per non-empty chunk).
for (let i = 0; i < 4; i++) {
  const faces = Number(canvas.getAttribute(`data-hv-c${i}-face-count`));
  assert(Number.isFinite(faces) && faces > 0, `chunk ${i} non-empty face-count`);
  const cPos = parseFloatCsv(canvas.getAttribute(`data-hv-c${i}-positions`));
  const cIdx = parseCsv(canvas.getAttribute(`data-hv-c${i}-indices`)).map(Number);
  assert(cPos.length === faces * 12, `chunk ${i} positions scale`);
  assert(cIdx.length === faces * 6, `chunk ${i} indices scale`);
}

// Generated source must keep world mesh path (not residual cube helpers).
const mainTsPath = fileURLToPath(new URL("../dist/faber-ts/main.ts", import.meta.url));
assert(existsSync(mainTsPath), "dist/faber-ts/main.ts exists");
const mainTs = readFileSync(mainTsPath, "utf-8");
assert(mainTs.includes("mesh_fixture_world") || mainTs.includes("four-chunk-world"),
  "generated source includes four-chunk world path");
assert(!mainTs.includes("function cube_positions"), "cube residual helpers removed");
assert(
  mainTs.includes("data-hv-positions") && mainTs.includes("data-hv-colors") && mainTs.includes("data-hv-indices"),
  "generated source emits geometry attributes",
);
assert(
  mainTs.includes("matrix4_") || mainTs.includes("triga"),
  "generated source uses Triga matrix path",
);

// --- Initial transform payload (32 floats) ---
const initialTransform = parseFloatCsv(canvas.getAttribute("data-hv-transform"));
const initialModel = parseFloatCsv(canvas.getAttribute("data-hv-model-matrix"));
const initialVp = parseFloatCsv(canvas.getAttribute("data-hv-view-projection"));
assert(initialTransform.length === 32, `transform length 32, got ${initialTransform.length}`);
assert(initialModel.length === 16, `model length 16, got ${initialModel.length}`);
assert(initialVp.length === 16, `view-projection length 16, got ${initialVp.length}`);

// --- Two frames → different model matrix (not frame-count alone) ---
assert(frameCallbacks.length >= 1, `frame callback registered (got ${frameCallbacks.length})`);
frameCallbacks[0](16);
const modelFrame1 = canvas.getAttribute("data-hv-model-matrix");
const transformFrame1 = canvas.getAttribute("data-hv-transform");
assert(canvas.getAttribute("data-hv-frame-count") === "1", "frame count 1");
assert(parseFloatCsv(modelFrame1).length === 16, "frame1 model has 16 floats");

frameCallbacks[1](33);
const modelFrame2 = canvas.getAttribute("data-hv-model-matrix");
const transformFrame2 = canvas.getAttribute("data-hv-transform");
assert(canvas.getAttribute("data-hv-frame-count") === "2", "frame count 2");
assert(modelFrame1 !== modelFrame2, "model matrix changes across frames");
assert(transformFrame1 !== transformFrame2, "full transform changes across frames");
assert(
  canvas.getAttribute("data-hv-angle") !== null &&
    Number(canvas.getAttribute("data-hv-angle")) > 0,
  "angle advances with frames",
);

// --- Resize updates projection inputs ---
assert(canvas.getAttribute("data-hv-width") === "960", `initial width 960, got ${canvas.getAttribute("data-hv-width")}`);
assert(canvas.getAttribute("data-hv-height") === "540", `initial height 540, got ${canvas.getAttribute("data-hv-height")}`);
const aspectBefore = canvas.getAttribute("data-hv-aspect");
const vpBefore = canvas.getAttribute("data-hv-view-projection");

// Non-16:9 size so live aspect is clearly distinct from DEFAULT_ASPECT=1.778.
globalThis.window.innerWidth = 800;
globalThis.window.innerHeight = 600;
globalThis.window.dispatchEvent(new FakeEvent("resize"));

assert(canvas.getAttribute("data-hv-width") === "800", "resized width 800");
assert(canvas.getAttribute("data-hv-height") === "600", "resized height 600");
assert(canvas.classList.has("hv-resize-active"), "hv-resize-active after resize");
assert(canvas.getAttribute("data-hv-aspect") !== aspectBefore, "aspect updates on resize");
assert(canvas.getAttribute("data-hv-view-projection") !== vpBefore, "view-projection updates on resize");

// --- Post-resize frames keep live aspect (not DEFAULT_ASPECT clobber) ---
// resize-then-frame order: after resize to W×H, next frame must keep aspect≈W/H.
const expectedAspect = 800 / 600; // 4:3 ≈ 1.333…
const aspectAfterResize = Number(canvas.getAttribute("data-hv-aspect"));
assert(
  Number.isFinite(aspectAfterResize) && Math.abs(aspectAfterResize - expectedAspect) < 1e-4,
  `aspect after resize ≈ ${expectedAspect}, got ${aspectAfterResize}`,
);
assert(
  Math.abs(aspectAfterResize - 1.778) > 0.1,
  `resize aspect must differ from DEFAULT_ASPECT (got ${aspectAfterResize})`,
);
const vpAfterResizeNums = parseFloatCsv(canvas.getAttribute("data-hv-view-projection"));
assert(vpAfterResizeNums.length === 16, "resize VP has 16 floats");

// Prior frames used callbacks [0] and [1]; rAF re-queues so [2] is next.
assert(frameCallbacks.length >= 3, `post-resize pending frame (got ${frameCallbacks.length})`);
frameCallbacks[2](50);

const aspectAfterFrame = Number(canvas.getAttribute("data-hv-aspect"));
assert(
  Number.isFinite(aspectAfterFrame) && Math.abs(aspectAfterFrame - expectedAspect) < 1e-4,
  `post-resize frame keeps aspect≈${expectedAspect}, got ${aspectAfterFrame}`,
);
assert(
  Math.abs(aspectAfterFrame - 1.778) > 0.1,
  `post-resize frame must not clobber with DEFAULT_ASPECT=1.778 (got ${aspectAfterFrame})`,
);
const vpAfterFrame = parseFloatCsv(canvas.getAttribute("data-hv-view-projection"));
assert(vpAfterFrame.length === 16, "post-resize frame VP has 16 floats");
// Perspective x_scale = focal/aspect at elements[0]; must match resize VP for same aspect.
assert(
  Math.abs(vpAfterFrame[0] - vpAfterResizeNums[0]) < 1e-5,
  `post-resize frame keeps VP x_scale for live aspect (got ${vpAfterFrame[0]} vs ${vpAfterResizeNums[0]})`,
);

// --- Dispose stops frame + resize updates ---
const modelBeforeDispose = canvas.getAttribute("data-hv-model-matrix");
const widthBeforeDispose = canvas.getAttribute("data-hv-width");
runtime.dispose();

while (frameCallbacks.length > 0) {
  const cb = frameCallbacks.shift();
  if (cb) cb(99);
}
assert(
  canvas.getAttribute("data-hv-model-matrix") === modelBeforeDispose,
  "dispose cancels further model updates",
);

globalThis.window.innerWidth = 640;
globalThis.window.innerHeight = 480;
globalThis.window.dispatchEvent(new FakeEvent("resize"));
assert(
  canvas.getAttribute("data-hv-width") === widthBeforeDispose,
  "dispose cancels further resize updates",
);

// --- draw.json still present (manifest path) ---
const drawPath = fileURLToPath(new URL("../dist/public/draw.json", import.meta.url));
assert(existsSync(drawPath), "dist/public/draw.json exists");
const draw = JSON.parse(readFileSync(drawPath, "utf-8"));
assert(Number(draw.index_count) === indexCount, `draw.json index_count ${indexCount}`);
assert(draw.index_format === "uint32", "draw.json index_format uint32");
assert(Number(draw.resource_pair_count) === 4, "draw.json resource_pair_count 4");
assert(Number(draw.draw_count) === 4, "draw.json draw_count 4");
assert(draw.payload_kind === "four-chunk-world", "draw.json four-chunk-world");

console.log(`\n${PASS}: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

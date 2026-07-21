// HV-04B ownership harness.
//
// Proves Faber-owned cube geometry and Triga matrix emission without treating
// frame-count alone as model-matrix proof. Fails if geometry arrays or matrix
// values are removed from the package output path.

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

// --- Live cube payload (not counts alone) ---
const positions = parseFloatCsv(canvas.getAttribute("data-hv-positions"));
const colors = parseFloatCsv(canvas.getAttribute("data-hv-colors"));
const indices = parseCsv(canvas.getAttribute("data-hv-indices")).map(Number);

assert(positions.length === 24, `positions length 24, got ${positions.length}`);
assert(colors.length === 24, `colors length 24, got ${colors.length}`);
assert(indices.length === 36, `indices length 36, got ${indices.length}`);
assert(canvas.getAttribute("data-hv-vertex-count") === "8", "vertex-count 8");
assert(canvas.getAttribute("data-hv-index-count") === "36", "index-count 36");

// Spot-check locked cube corners and first triangle indices.
assert(positions[0] === 0 && positions[1] === 0 && positions[2] === 0, "corner 0 is origin");
assert(positions[3] === 1 && positions[4] === 0 && positions[5] === 0, "corner 1 is +x");
assert(indices[0] === 0 && indices[1] === 1 && indices[2] === 2, "first triangle 0,1,2");
assert(Math.min(...indices) === 0 && Math.max(...indices) === 7, "indices cover verts 0..7");

// Generated source must keep live cube helpers referenced (not dead private data).
const mainTsPath = fileURLToPath(new URL("../dist/faber-ts/main.ts", import.meta.url));
assert(existsSync(mainTsPath), "dist/faber-ts/main.ts exists");
const mainTs = readFileSync(mainTsPath, "utf-8");
assert(mainTs.includes("cube_positions"), "generated source includes cube_positions");
assert(mainTs.includes("cube_colors"), "generated source includes cube_colors");
assert(mainTs.includes("cube_indices"), "generated source includes cube_indices");
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

globalThis.window.innerWidth = 1280;
globalThis.window.innerHeight = 720;
globalThis.window.dispatchEvent(new FakeEvent("resize"));

assert(canvas.getAttribute("data-hv-width") === "1280", "resized width 1280");
assert(canvas.getAttribute("data-hv-height") === "720", "resized height 720");
assert(canvas.classList.has("hv-resize-active"), "hv-resize-active after resize");
assert(canvas.getAttribute("data-hv-aspect") !== aspectBefore, "aspect updates on resize");
assert(canvas.getAttribute("data-hv-view-projection") !== vpBefore, "view-projection updates on resize");

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
assert(draw.index_count === 36, "draw.json index_count 36");
assert(draw.index_format === "uint32", "draw.json index_format uint32");

console.log(`\n${PASS}: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

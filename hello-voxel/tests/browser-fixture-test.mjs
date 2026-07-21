// Hello Voxel browser admission harness.
//
// The fixture imports the generated browser ESM and mounts the Faber
// controller through the generated lifecycle helper. It proves package and DOM
// admission only. It does not claim rendering or WebGPU execution.

import { FakeElement, FakeEventTarget } from "../../browser-app/tests/fake-dom.mjs";

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
  main.appendChild(canvas);

  return { root, status };
}

// Frame + resize subscriptions require rAF and window (HV-04B on_resize).
globalThis.requestAnimationFrame = (cb) => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.window = new FakeEventTarget();
globalThis.window.innerWidth = 960;
globalThis.window.innerHeight = 540;
globalThis.window.devicePixelRatio = 1;

const { root, status } = buildHelloVoxelDom();
globalThis.document = root;

const esmUrl = new URL("../dist/faber-esm/faber-browser.js", import.meta.url).href;
const { controllers, mountControllers } = await import(esmUrl);

assert(controllers.length === 1, `expected 1 controller, got ${controllers.length}`);
assert(controllers[0].selector === "#hello-voxel-root", `unexpected selector ${controllers[0].selector}`);
assert(status.textContent === "package-pending", `status starts pending, got ${status.textContent}`);

const runtime = mountControllers(globalThis.document);
assert(runtime.mounts.length === 1, `expected 1 mounted controller, got ${runtime.mounts.length}`);
assert(runtime.failures.length === 0, `expected 0 mount failures, got ${runtime.failures.length}`);
assert(status.textContent === "package-ready", `status becomes package-ready, got ${status.textContent}`);
assert(status.classList.has("ready"), "status gains ready class");
runtime.dispose();

console.log(`\n${PASS}: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

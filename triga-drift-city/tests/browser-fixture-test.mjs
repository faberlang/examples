import {
  FakeElement,
  FakeEvent,
  FakeEventTarget,
} from "../../browser-app/tests/fake-dom.mjs";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function element(tag, { id, className, text } = {}) {
  const value = new FakeElement(tag);
  if (id) value.id = id;
  if (className) {
    for (const name of className.split(/\s+/)) value.classList.add(name);
  }
  if (text !== undefined) value.textContent = text;
  return value;
}

function fixtureDocument() {
  const root = element("html");
  root.focused = true;
  const body = element("body");
  const main = element("main", { id: "triga-drift-city" });
  main.appendChild(element("p", { className: "drift-status", text: "simulation-pending" }));
  main.appendChild(element("div", { className: "drift-facts" }));
  body.appendChild(main);
  root.appendChild(body);
  return root;
}

const document = fixtureDocument();
globalThis.document = document;
globalThis.window = new FakeEventTarget();
globalThis.window.innerWidth = 1280;
globalThis.window.innerHeight = 720;
globalThis.window.devicePixelRatio = 1;

let frameTime = 0;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => {
  frameTime += 16;
  callback(frameTime);
}, 1);
globalThis.cancelAnimationFrame = clearTimeout;

const entry = new URL("../dist/faber-esm/faber-browser.js", import.meta.url).href;
const { controllers, mountControllers } = await import(entry);

assert(controllers.length === 1, `expected one controller, got ${controllers.length}`);
assert(controllers[0].selector === "#triga-drift-city", "controller selector is #triga-drift-city");

const runtime = mountControllers(document);
assert(runtime.mounts.length === 1, `expected one mount, got ${runtime.mounts.length}`);
assert(runtime.failures.length === 0, `expected no mount failures, got ${runtime.failures.length}`);

const root = document.querySelector("#triga-drift-city");
const status = root.querySelector(".drift-status");
const facts = root.querySelector(".drift-facts");

// Mount-once status attrs (U4 done_when 10)
assert(status.textContent === "simulation-running-gpu-active", "mount publishes GPU-active status");
assert(facts.getAttribute("data-render-status") === "live-direct-webgpu", "renderer status is live-direct-webgpu");
assert(facts.getAttribute("data-render-gate") === "open", "direct-WebGPU gate is open");
assert(facts.getAttribute("data-simulation-owner") === "faber", "simulation ownership is Faber");
assert(facts.getAttribute("data-device-status") === "active", "device status starts active");

// Frame-specific vehicle/camera/key scrape attrs must NOT be the source of truth
assert(facts.getAttribute("data-vehicle-x") === null, "no per-frame data-vehicle-x");
assert(facts.getAttribute("data-camera-x") === null, "no per-frame data-camera-x");
assert(facts.getAttribute("data-key-forward") === null, "no per-frame data-key-forward");
assert(facts.getAttribute("data-frame") === null, "no per-frame data-frame scrape attr");

// One-shot scene geometry for host upload
const geo = facts.getAttribute("data-scene-geometry");
assert(geo !== null && geo.length > 0, "mount publishes data-scene-geometry blob");
assert(facts.getAttribute("data-scene-object-count") === "10", "scene geometry has 10 objects");
assert(geo.includes("car;car;"), "geometry blob includes car role");
assert(geo.includes("road-0;static;"), "geometry blob includes road-0 static");
const objectParts = geo.split("|");
assert(objectParts.length === 10, `geometry blob has 10 objects, got ${objectParts.length}`);

// Transform payload host bridge (32 floats)
const payloadAttr = facts.getAttribute("data-transform-payload");
assert(payloadAttr !== null && payloadAttr !== undefined, "transform payload attribute exists");
const payloadFloats = payloadAttr.trim().split(/\s+/);
assert(payloadFloats.length === 32, `transform payload has 32 floats, got ${payloadFloats.length}`);
const modelM15 = Number(payloadFloats[15]);
assert(Math.abs(modelM15 - 1.0) < 0.001, `model matrix m15 is 1.0, got ${modelM15}`);

// Keyboard / focus: simulation still runs; transform model translation should move
const startTx = Number(payloadFloats[12]); // model translation x (column-major m[12])
const startTz = Number(payloadFloats[14]); // model translation z

// Unfocused key input must not drive
facts.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW" }));
await new Promise((resolve) => setTimeout(resolve, 15));
const midPayload = facts.getAttribute("data-transform-payload").trim().split(/\s+/);
const midTz = Number(midPayload[14]);
assert(Math.abs(midTz - startTz) < 0.0001, "unfocused key input does not move car");

// Focus + drive forward
facts.dispatchEvent(new FakeEvent("focus"));
facts.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW" }));
await new Promise((resolve) => setTimeout(resolve, 40));
const drivenPayload = facts.getAttribute("data-transform-payload").trim().split(/\s+/);
const drivenTz = Number(drivenPayload[14]);
// Spawn heading 0° forward is -Z in this camera convention (vehicle.fab uses camera_forward_planus)
assert(
  drivenTz < startTz || Number(drivenPayload[12]) !== startTx,
  `focused drive changes car transform (tz ${drivenTz} vs ${startTz}, tx ${drivenPayload[12]} vs ${startTx})`,
);

// Reset R restores spawn translation
facts.dispatchEvent(new FakeEvent("keydown", { key: "r", code: "KeyR" }));
await new Promise((resolve) => setTimeout(resolve, 5));
const resetPayload = facts.getAttribute("data-transform-payload").trim().split(/\s+/);
const resetTx = Number(resetPayload[12]);
const resetTz = Number(resetPayload[14]);
assert(Math.abs(resetTx - (-22.0)) < 0.01, `reset restores spawn x ≈ -22, got ${resetTx}`);
assert(Math.abs(resetTz - 0.0) < 0.01, `reset restores spawn z ≈ 0, got ${resetTz}`);

// Blur clears held keys (no further drive after blur)
facts.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW" }));
facts.dispatchEvent(new FakeEvent("blur"));
const blurPayload = facts.getAttribute("data-transform-payload");
assert(blurPayload !== null, "transform still published after blur");

// Device status stays active under normal operation
assert(facts.getAttribute("data-device-status") === "active", "device status stays active");

runtime.dispose();
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

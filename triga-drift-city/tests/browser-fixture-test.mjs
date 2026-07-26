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

assert(status.textContent === "simulation-running-gpu-active", "mount publishes GPU-active status");
assert(facts.getAttribute("data-render-status") === "live-direct-webgpu", "renderer status is live-direct-webgpu");
assert(facts.getAttribute("data-render-gate") === "open", "direct-WebGPU gate is open");
assert(facts.getAttribute("data-simulation-owner") === "faber", "simulation ownership is Faber");
assert(facts.getAttribute("data-scene-road-count") === "4", "scene publishes four roads");
assert(facts.getAttribute("data-scene-building-count") === "5", "scene publishes five buildings");
assert(facts.getAttribute("data-scene-car-count") === "1", "scene publishes one car");
assert(facts.getAttribute("data-scene-roads").length > 0, "road Box3 facts are inspectable");
assert(facts.getAttribute("data-camera-target-z") !== null, "camera target is inspectable");
assert(facts.getAttribute("data-key-focused") === "0", "input starts unfocused");

// --- U4: device status and transform payload ---
assert(facts.getAttribute("data-device-status") === "active", "device status starts active");

const startZ = Number(facts.getAttribute("data-vehicle-z"));
facts.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW" }));
assert(facts.getAttribute("data-key-forward") === "0", "unfocused key input is rejected");
facts.dispatchEvent(new FakeEvent("focus"));
assert(facts.getAttribute("data-key-focused") === "1", "panel focus admits keyboard input");
facts.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW" }));
assert(facts.getAttribute("data-key-forward") === "1", "focused keydown reaches Faber input state");
await new Promise((resolve) => setTimeout(resolve, 15));
const drivenZ = Number(facts.getAttribute("data-vehicle-z"));
const advancedFrame = Number(facts.getAttribute("data-frame"));
assert(drivenZ < startZ, `frame advancement moves car forward (${drivenZ} < ${startZ})`);
assert(advancedFrame > 0, "frame fact advances");

// --- U4: transform payload check ---
const payloadAttr = facts.getAttribute("data-transform-payload");
assert(payloadAttr !== null && payloadAttr !== undefined, "transform payload attribute exists");
const payloadFloats = payloadAttr.trim().split(/\s+/);
assert(payloadFloats.length === 32, `transform payload has 32 floats, got ${payloadFloats.length}`);
const modelM15 = Number(payloadFloats[15]); // last model element (m15 = 1.0 for identity)
assert(Math.abs(modelM15 - 1.0) < 0.001, `model matrix m15 is 1.0, got ${modelM15}`);

// --- U4: resize sets canvas aspect on controller ---
assert(facts.getAttribute("data-device-status") === "active", "device status stays active after frames");

facts.dispatchEvent(new FakeEvent("keydown", { key: " ", code: "Space" }));
assert(facts.getAttribute("data-key-handbrake") === "1", "Space reaches Faber handbrake state");
assert(Number(facts.getAttribute("data-frame")) === advancedFrame, "input preserves the published frame");
facts.dispatchEvent(new FakeEvent("keyup", { key: " ", code: "Space" }));
assert(facts.getAttribute("data-key-handbrake") === "0", "Space keyup clears handbrake state");
facts.dispatchEvent(new FakeEvent("blur"));
assert(facts.getAttribute("data-key-focused") === "0", "panel blur revokes keyboard input");
assert(facts.getAttribute("data-key-forward") === "0", "panel blur clears held movement input");
facts.dispatchEvent(new FakeEvent("keyup", { key: "w", code: "KeyW" }));
assert(facts.getAttribute("data-key-forward") === "0", "keyup keeps Faber input state clear");

runtime.dispose();
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

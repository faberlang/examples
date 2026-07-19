// WEB5 browser fixture harness — DOM harness observes mounts and mutations
// from built ESM.
//
// Run:
//   node --import ./tests/register-hooks.mjs ./tests/browser-fixture-test.mjs
//
// Prerequisites:
//   faber build --package .   (produces dist/faber-esm/faber-browser.js)

import { buildFixtureDom, FakeEvent, FakeEventTarget } from "./fake-dom.mjs";

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

// ---------------------------------------------------------------------------
// Set up fake DOM before importing ESM (the runtime bridge reads
// globalThis.document).
// ---------------------------------------------------------------------------
const dom = buildFixtureDom();
globalThis.document = dom;
globalThis.window = new FakeEventTarget();
globalThis.window.innerWidth = 1280;
globalThis.window.innerHeight = 720;
globalThis.window.devicePixelRatio = 2;

// ---------------------------------------------------------------------------
// Import built ESM entry.
// ---------------------------------------------------------------------------
const esmUrl = new URL("../dist/faber-esm/faber-browser.js", import.meta.url).href;
const { controllers, mountControllers } = await import(esmUrl);

assert(controllers.length === 7, `expected 7 controllers, got ${controllers.length}`);

// ---------------------------------------------------------------------------
// Mount each controller within its scoped root.
// ---------------------------------------------------------------------------
const runtime = mountControllers(globalThis.document);
assert(runtime.mounts.length === 7, `expected 7 mounted controllers, got ${runtime.mounts.length}`);
assert(runtime.failures.length === 0, `expected 0 controller failures, got ${runtime.failures.length}`);

// ---------------------------------------------------------------------------
// Test 1: Toggle controller — click toggles "active" class on label.
// ---------------------------------------------------------------------------
function testToggle() {
  const section = dom.querySelector("#toggle-demo");
  const button = section.querySelector(".toggle-btn");
  const label = section.querySelector(".toggle-label");

  assert(!label.classList.has("active"), "toggle: label starts without active");
  button.dispatchEvent(new FakeEvent("click"));
  assert(label.classList.has("active"), "toggle: label gains active after first click");
  button.dispatchEvent(new FakeEvent("click"));
  assert(!label.classList.has("active"), "toggle: label loses active after second click");
}

// ---------------------------------------------------------------------------
// Test 2: Filter controller — input toggles "hidden" on list items.
// ---------------------------------------------------------------------------
function testFilter() {
  const section = dom.querySelector("#filter-demo");
  const input = section.querySelector(".filter-input");
  const items = section.querySelectorAll(".filter-item");

  assert(items.length === 3, `filter: expected 3 items, got ${items.length}`);
  assert(!items[0].classList.has("hidden"), "filter: items start visible");

  // Simulate typing: set value, dispatch input event.
  input.value = "abc";
  input.dispatchEvent(new FakeEvent("input"));

  assert(items[0].classList.has("hidden"), "filter: items hidden when query non-empty");
  assert(items[1].classList.has("hidden"), "filter: all items hidden on non-empty query");
  assert(items[2].classList.has("hidden"), "filter: third item hidden too");

  // Clear filter.
  input.value = "";
  input.dispatchEvent(new FakeEvent("input"));

  assert(!items[0].classList.has("hidden"), "filter: items restored when query cleared");
  assert(!items[1].classList.has("hidden"), "filter: second item restored");
}

// ---------------------------------------------------------------------------
// Test 3: Submit controller — submit sets status text and prevents default.
// ---------------------------------------------------------------------------
function testSubmit() {
  const section = dom.querySelector("#submit-demo");
  const form = section.querySelector(".submit-form");
  const status = section.querySelector(".submit-status");

  assert(status.textContent === "idle", `submit: status starts idle, got "${status.textContent}"`);

  const event = new FakeEvent("submit");
  form.dispatchEvent(event);

  assert(status.textContent === "submitted", `submit: status becomes "submitted", got "${status.textContent}"`);
  assert(event.defaultPrevented, "submit: default prevented");
}

// ---------------------------------------------------------------------------
// Test 4: fetch_text success and failure (runtime-bridge level).
//
// The Radix TS backend does not yet await @ futura calls inside fac/cape
// blocks, so the Faber controller cannot call dom.fetch_text directly.
// This test proves the runtime bridge's fetch_text works for both success
// and failure, unblocking the controller when the codegen gap closes.
// ---------------------------------------------------------------------------
async function testFetch() {
  const bridge = await import("./runtime-bridge.mjs");

  // --- success ---
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert(url === "/api/ok", `fetch success: url, got ${url}`);
    assert(init?.method === "POST", "fetch success: method POST");
    return { status: 200, ok: true, text: async () => "ok-body" };
  };
  try {
    const resp = await bridge.dom.fetch_text({ url: "/api/ok", method: "POST", body: "x" });
    assert(resp.status === 200, `fetch success: status 200, got ${resp.status}`);
    assert(resp.ok, "fetch success: ok=true");
    assert(resp.body === "ok-body", `fetch success: body, got "${resp.body}"`);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // --- failure ---
  globalThis.fetch = async (url) => {
    return { status: 500, ok: false, text: async () => "err-body" };
  };
  try {
    const resp = await bridge.dom.fetch_text({ url: "/api/err" });
    assert(resp.status === 500, `fetch failure: status 500, got ${resp.status}`);
    assert(!resp.ok, "fetch failure: ok=false");
    assert(resp.body === "err-body", `fetch failure: body, got "${resp.body}"`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ---------------------------------------------------------------------------
// Test 5: Frame controller — scheduled frame updates visible state.
// ---------------------------------------------------------------------------
async function testFrameLifecycle() {
  const section = dom.querySelector("#frame-demo");
  const status = section.querySelector(".frame-status");

  assert(status.textContent === "frame-pending", `frame: status starts pending, got "${status.textContent}"`);

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert(status.textContent === "frame-seen", `frame: status becomes frame-seen, got "${status.textContent}"`);
  assert(status.classList.has("frame-active"), "frame: status gains frame-active class");
}

// ---------------------------------------------------------------------------
// Test 6: Resize controller — initial and dispatched resize events update
// visible state.
// ---------------------------------------------------------------------------
function testResizeLifecycle() {
  const section = dom.querySelector("#resize-demo");
  const status = section.querySelector(".resize-status");

  assert(status.textContent === "resize-seen", `resize: initial emit updates status, got "${status.textContent}"`);
  assert(status.classList.has("resize-active"), "resize: initial emit adds resize-active class");

  status.textContent = "resize-waiting";
  globalThis.window.innerWidth = 1440;
  globalThis.window.dispatchEvent(new FakeEvent("resize"));
  assert(status.textContent === "resize-seen", `resize: dispatch updates status, got "${status.textContent}"`);
}

// ---------------------------------------------------------------------------
// Test 7: Keyboard controller — physical key code drives visible state.
// ---------------------------------------------------------------------------
function testKeyboardLifecycle() {
  const section = dom.querySelector("#keyboard-demo");
  const status = section.querySelector(".keyboard-status");

  assert(status.textContent === "keyboard-pending", `keyboard: status starts pending, got "${status.textContent}"`);
  status.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW", repeat: false }));
  assert(status.textContent === "keyboard-code", `keyboard: status becomes keyboard-code, got "${status.textContent}"`);
  assert(status.classList.has("keyboard-active"), "keyboard: status gains keyboard-active class");
}

// ---------------------------------------------------------------------------
// Test 8: Pointer controller — pointer movement and button event reaches
// source-authored code.
// ---------------------------------------------------------------------------
function testPointerLifecycle() {
  const section = dom.querySelector("#pointer-demo");
  const status = section.querySelector(".pointer-status");

  assert(status.textContent === "pointer-pending", `pointer: status starts pending, got "${status.textContent}"`);
  status.dispatchEvent(new FakeEvent("pointermove", {
    clientX: 32,
    clientY: 48,
    movementX: 5,
    movementY: -3,
    button: 0,
    isPrimary: true,
  }));
  assert(status.textContent === "pointer-seen", `pointer: status becomes pointer-seen, got "${status.textContent}"`);
  assert(status.classList.has("pointer-active"), "pointer: status gains pointer-active class");
}

// ---------------------------------------------------------------------------
// Test 9: Generated disposal cancels frame scheduling and removes event
// listeners returned by source-authored controllers.
// ---------------------------------------------------------------------------
async function testGeneratedDispose() {
  const frameStatus = dom.querySelector("#frame-demo").querySelector(".frame-status");
  const resizeStatus = dom.querySelector("#resize-demo").querySelector(".resize-status");
  const keyboardStatus = dom.querySelector("#keyboard-demo").querySelector(".keyboard-status");
  const pointerStatus = dom.querySelector("#pointer-demo").querySelector(".pointer-status");

  frameStatus.textContent = "frame-after-dispose";
  resizeStatus.textContent = "resize-after-dispose";
  keyboardStatus.textContent = "keyboard-after-dispose";
  pointerStatus.textContent = "pointer-after-dispose";
  runtime.dispose();
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert(frameStatus.textContent === "frame-after-dispose", "dispose: cancels later frame callbacks");

  globalThis.window.innerWidth = 1600;
  globalThis.window.dispatchEvent(new FakeEvent("resize"));
  assert(resizeStatus.textContent === "resize-after-dispose", "dispose: removes resize listener");

  keyboardStatus.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW" }));
  assert(keyboardStatus.textContent === "keyboard-after-dispose", "dispose: removes keyboard listener");

  pointerStatus.dispatchEvent(new FakeEvent("pointermove", { movementX: 1, movementY: 1 }));
  assert(pointerStatus.textContent === "pointer-after-dispose", "dispose: removes pointer listener");
}

// ---------------------------------------------------------------------------
// Run all tests.
// ---------------------------------------------------------------------------
testToggle();
testFilter();
testSubmit();
await testFetch();
await testFrameLifecycle();
testResizeLifecycle();
testKeyboardLifecycle();
testPointerLifecycle();
await testGeneratedDispose();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

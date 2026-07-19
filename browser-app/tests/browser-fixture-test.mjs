// WEB5 browser fixture harness — DOM harness observes mounts and mutations
// from built ESM.
//
// Run:
//   node --import ./tests/register-hooks.mjs ./tests/browser-fixture-test.mjs
//
// Prerequisites:
//   faber build --package .   (produces dist/faber-esm/faber-browser.js)

import { buildFixtureDom, FakeEvent } from "./fake-dom.mjs";

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

// ---------------------------------------------------------------------------
// Import built ESM entry.
// ---------------------------------------------------------------------------
const esmUrl = new URL("../dist/faber-esm/faber-browser.js", import.meta.url).href;
const { controllers, mountControllers } = await import(esmUrl);

assert(controllers.length === 3, `expected 3 controllers, got ${controllers.length}`);

// ---------------------------------------------------------------------------
// Mount each controller within its scoped root.
// ---------------------------------------------------------------------------
const runtime = mountControllers(globalThis.document);
assert(runtime.mounts.length === 3, `expected 3 mounted controllers, got ${runtime.mounts.length}`);
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
// Run all tests.
// ---------------------------------------------------------------------------
testToggle();
testFilter();
testSubmit();
await testFetch();
runtime.dispose();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

// Runtime bridge for bare specifiers "web:dom" and "web:web".
//
// The built ESM imports `{ dom }` from `"web:dom"` and `{ web }` from
// `"web:web"`. Node.js cannot resolve these bare specifiers natively, so the
// test harness registers a loader hook that redirects both to this module.
//
// The namespace objects below mirror faber-web/runtime/dom.ts but operate
// against whatever globalThis.document the harness has installed (fake DOM
// in tests, real document in a browser).

let nextSubscriptionId = 1;
let nextFrameRequestId = 1;
const frameRequests = new Map();

function resolveRoot(sc) {
  if (sc.root) return sc.root;
  const doc = globalThis.document;
  if (!sc.selector || sc.selector.length === 0) return doc;
  const root = doc.querySelector(sc.selector);
  if (!root) throw new Error(`web:dom scope root not found for selector: ${sc.selector}`);
  return root;
}

function scope(selector) {
  const doc = globalThis.document;
  if (!selector || selector.length === 0) return { root: doc, selector };
  const root = doc.querySelector(selector);
  if (!root) throw new Error(`web:dom scope selector not found: ${selector}`);
  return { root, selector };
}

function require(sc, selector) {
  const root = resolveRoot(sc);
  const el = root.querySelector(selector);
  if (!el) throw new Error(`web:dom required selector not found: ${selector}`);
  return el;
}

function rememberSubscription(dispose) {
  const id = nextSubscriptionId++;
  return { id, dispose };
}

function requestFrame(handler) {
  const requestAnimationFrame =
    globalThis.requestAnimationFrame ??
    ((callback) => setTimeout(() => callback(Date.now()), 16));
  const id = nextFrameRequestId++;
  const nativeId = requestAnimationFrame((time) => {
    frameRequests.delete(id);
    handler(time);
  });
  frameRequests.set(id, nativeId);
  return id;
}

function cancelFrame(id) {
  if (!frameRequests.has(id)) return;
  const nativeId = frameRequests.get(id);
  frameRequests.delete(id);
  const cancelAnimationFrame = globalThis.cancelAnimationFrame ?? clearTimeout;
  cancelAnimationFrame(nativeId);
}

export const dom = {
  scope,
  element(selector) { return { selector }; },
  query(sc, selector) { return resolveRoot(sc).querySelector(selector); },
  require,
  all(sc, selector) { return Array.from(resolveRoot(sc).querySelectorAll(selector)); },
  text_set(el, val) { el.textContent = val; },
  attr_set(el, name, val) { el.setAttribute(name, val); },
  attr_remove(el, name) { el.removeAttribute(name); },
  class_add(el, cls) { el.classList.add(cls); },
  class_remove(el, cls) { el.classList.remove(cls); },
  class_toggle(el, cls) { el.classList.toggle(cls); },
  on(el, eventName, handler) {
    el.addEventListener(eventName, handler);
    return rememberSubscription(() => el.removeEventListener(eventName, handler));
  },
  unsubscribe(sub) { sub.dispose(); },
  value(el) { return el.value; },
  value_set(el, val) { el.value = val; },
  on_input(el, handler) {
    return dom.on(el, "input", () => handler(el, el.value));
  },
  on_submit(form, options, handler) {
    return dom.on(form, "submit", (event) => {
      if (options?.prevent_default !== false) event.preventDefault();
      handler(form);
    });
  },
  on_frame(handler) {
    let active = true;
    let frame = 0;
    let previousTime = null;
    let requestId = 0;
    const step = (time) => {
      if (!active) return;
      const delta = previousTime === null ? 0 : time - previousTime;
      previousTime = time;
      frame += 1;
      handler({ frame, time_ms: time, delta_ms: delta });
      requestId = requestFrame(step);
    };
    requestId = requestFrame(step);
    return rememberSubscription(() => {
      active = false;
      cancelFrame(requestId);
    });
  },
  on_resize(handler) {
    const emit = () => handler({
      width: globalThis.window?.innerWidth ?? 0,
      height: globalThis.window?.innerHeight ?? 0,
      device_pixel_ratio: globalThis.window?.devicePixelRatio ?? 1,
    });
    globalThis.window.addEventListener("resize", emit);
    emit();
    return rememberSubscription(() => globalThis.window.removeEventListener("resize", emit));
  },
  on_keyboard(el, eventName, handler) {
    return dom.on(el, eventName, (event) => handler({
      kind: event.type,
      key: event.key ?? "",
      code: event.code ?? "",
      repeat: event.repeat ?? false,
      alt: event.altKey ?? false,
      ctrl: event.ctrlKey ?? false,
      shift: event.shiftKey ?? false,
      meta: event.metaKey ?? false,
    }));
  },
  on_pointer(el, eventName, handler) {
    return dom.on(el, eventName, (event) => handler({
      kind: event.type,
      x: event.clientX ?? 0,
      y: event.clientY ?? 0,
      movement_x: event.movementX ?? 0,
      movement_y: event.movementY ?? 0,
      button: event.button ?? 0,
      primary: event.isPrimary ?? false,
    }));
  },
  on_focus(el, eventName, handler) {
    return dom.on(el, eventName, () => handler({ focused: globalThis.document.hasFocus() }));
  },
  pointer_lock_state(el) {
    return pointerLockState(el, false);
  },
  request_pointer_lock(el) {
    if (typeof el.requestPointerLock !== "function") {
      return pointerLockState(el, true);
    }
    try {
      el.requestPointerLock();
    } catch {
      return pointerLockState(el, true);
    }
    return pointerLockState(el, false);
  },
  exit_pointer_lock() {
    if (typeof globalThis.document.exitPointerLock !== "function") {
      return { supported: false, locked: false, denied: false, target_matches: false };
    }
    globalThis.document.exitPointerLock();
    return { supported: true, locked: globalThis.document.pointerLockElement !== null, denied: false, target_matches: false };
  },
  on_pointer_lock(el, handler) {
    const emit = () => handler(pointerLockState(el, false));
    globalThis.document.addEventListener("pointerlockchange", emit);
    globalThis.document.addEventListener("pointerlockerror", emit);
    emit();
    return rememberSubscription(() => {
      globalThis.document.removeEventListener("pointerlockchange", emit);
      globalThis.document.removeEventListener("pointerlockerror", emit);
    });
  },
  prevent_default(event) { event.preventDefault(); return event; },
  async fetch_text(request) {
    const response = await fetch(request.url, {
      method: request.method ?? "GET",
      body: request.body ?? undefined,
    });
    return {
      status: response.status,
      ok: response.ok,
      body: await response.text(),
    };
  },
};

function pointerLockState(el, denied) {
  const supported =
    typeof el.requestPointerLock === "function" &&
    typeof globalThis.document.exitPointerLock === "function";
  const lockedElement = globalThis.document.pointerLockElement;
  return {
    supported,
    locked: lockedElement !== null,
    denied,
    target_matches: lockedElement === el,
  };
}

export const web = {
  mount(selector) { return { selector }; },
  selector_of(m) { return m.selector; },
};

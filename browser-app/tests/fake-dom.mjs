// Minimal fake DOM for the WEB5 browser fixture harness.
//
// Supports the selector, event, class, attribute, text, and value operations
// that the faber-web runtime bridge uses. Not a full DOM implementation —
// only enough to observe controller mounts and mutations.

export class FakeClassList {
  #classes = new Set();

  add(cls) { this.#classes.add(cls); }
  remove(cls) { this.#classes.delete(cls); }
  toggle(cls) {
    if (this.#classes.has(cls)) { this.#classes.delete(cls); return false; }
    this.#classes.add(cls); return true;
  }
  has(cls) { return this.#classes.has(cls); }
}

export class FakeEvent {
  constructor(type, fields = {}) {
    this.type = type;
    this.defaultPrevented = false;
    Object.assign(this, fields);
  }
  preventDefault() { this.defaultPrevented = true; }
}

export class FakeEventTarget {
  #listeners = new Map();

  addEventListener(type, handler) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.#listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event) {
    for (const handler of this.#listeners.get(event.type) ?? []) {
      handler(event);
    }
    return !event.defaultPrevented;
  }
}

export class FakeElement {
  children = [];
  #attributes = new Map();
  #listeners = new Map();
  textContent = "";
  value = "";

  constructor(tagName) {
    this.tagName = tagName;
    this.classList = new FakeClassList();
  }

  // --- id / class helpers for selector matching ---

  get id() { return this.#attributes.get("id") ?? ""; }
  set id(v) { this.#attributes.set("id", v); }

  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.classList.has(selector.slice(1));
    if (selector.startsWith("[")) {
      const m = /^\[([\w-]+)=([\w-]+)\]$/.exec(selector);
      return m ? this.#attributes.get(m[1]) === m[2] : false;
    }
    return this.tagName === selector;
  }

  // --- tree query ---

  querySelector(selector) {
    return this._queryAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    return this._queryAll(selector);
  }

  _queryAll(selector) {
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (child.matches(selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  // --- attribute API ---

  setAttribute(name, val) { this.#attributes.set(name, String(val)); }
  removeAttribute(name) { this.#attributes.delete(name); }
  getAttribute(name) { return this.#attributes.get(name) ?? null; }
  hasAttribute(name) { return this.#attributes.has(name); }

  // --- event API ---

  addEventListener(type, handler) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.#listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event) {
    for (const handler of this.#listeners.get(event.type) ?? []) {
      handler(event);
    }
    return !event.defaultPrevented;
  }

  // --- tree mutation ---

  appendChild(child) { this.children.push(child); return child; }
}

/** Build the fixture DOM tree mirroring pages/index.html. */
export function buildFixtureDom() {
  const root = new FakeElement("html");

  const body = new FakeElement("body");
  root.appendChild(body);

  const main = new FakeElement("main");
  body.appendChild(main);

  // --- #toggle-demo ---
  const toggleSection = el("section", { id: "toggle-demo" });
  toggleSection.appendChild(el("h2", { text: "Toggle" }));
  toggleSection.appendChild(el("button", { class: "toggle-btn", text: "Toggle" }));
  toggleSection.appendChild(el("span", { class: "toggle-label", text: "Off" }));
  main.appendChild(toggleSection);

  // --- #filter-demo ---
  const filterSection = el("section", { id: "filter-demo" });
  filterSection.appendChild(el("h2", { text: "Filter" }));
  filterSection.appendChild(el("input", { class: "filter-input" }));
  const list = el("ul", { class: "filter-list" });
  list.appendChild(el("li", { class: "filter-item", text: "Apple" }));
  list.appendChild(el("li", { class: "filter-item", text: "Banana" }));
  list.appendChild(el("li", { class: "filter-item", text: "Cherry" }));
  filterSection.appendChild(list);
  main.appendChild(filterSection);

  // --- #submit-demo ---
  const submitSection = el("section", { id: "submit-demo" });
  submitSection.appendChild(el("h2", { text: "Submit" }));
  const form = el("form", { class: "submit-form" });
  form.appendChild(el("input", { text: "", attrs: { type: "text", name: "query" } }));
  form.appendChild(el("button", { text: "Submit", attrs: { type: "submit" } }));
  submitSection.appendChild(form);
  submitSection.appendChild(el("p", { class: "submit-status", text: "idle" }));
  main.appendChild(submitSection);

  // --- #frame-demo ---
  const frameSection = el("section", { id: "frame-demo" });
  frameSection.appendChild(el("h2", { text: "Frame" }));
  frameSection.appendChild(el("p", { class: "frame-status", text: "frame-pending" }));
  main.appendChild(frameSection);

  // --- #resize-demo ---
  const resizeSection = el("section", { id: "resize-demo" });
  resizeSection.appendChild(el("h2", { text: "Resize" }));
  resizeSection.appendChild(el("p", { class: "resize-status", text: "resize-pending" }));
  main.appendChild(resizeSection);

  // --- #keyboard-demo ---
  const keyboardSection = el("section", { id: "keyboard-demo" });
  keyboardSection.appendChild(el("h2", { text: "Keyboard" }));
  keyboardSection.appendChild(el("p", { class: "keyboard-status", text: "keyboard-pending" }));
  main.appendChild(keyboardSection);

  // --- #pointer-demo ---
  const pointerSection = el("section", { id: "pointer-demo" });
  pointerSection.appendChild(el("h2", { text: "Pointer" }));
  pointerSection.appendChild(el("p", { class: "pointer-status", text: "pointer-pending" }));
  main.appendChild(pointerSection);

  return root;
}

function el(tag, opts = {}) {
  const e = new FakeElement(tag);
  if (opts.id) e.id = opts.id;
  if (opts.class) {
    for (const c of opts.class.split(/\s+/)) e.classList.add(c);
  }
  if (opts.text !== undefined) e.textContent = opts.text;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) e.setAttribute(k, v);
  }
  return e;
}

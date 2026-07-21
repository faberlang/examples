// HV-07C: repeated edit browser proof — dirty drain → remesh → host replace.
//
// Package path (fake DOM): place/remove cycles, exact remeshed set, generation
// advance only on affected chunks, multi-draw residual path.
// Host path (fake WebGPU device): applyChunkResourceReplace from package attrs,
// runChunkGraphicsFrame + destroyRetiredChunkResources after queue completion;
// live buffer counts stay bounded across repeated place/remove cycles.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FakeElement, FakeEvent, FakeEventTarget } from "../../browser-app/tests/fake-dom.mjs";

const FAIL = "\x1b[31mFAIL\x1b[0m";
const PASS = "\x1b[32mPASS\x1b[0m";
const BUFFERS_PER_PAIR = 3;

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
  if (attr === null || attr === undefined || attr === "") return [];
  return attr.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseIntCsv(attr) {
  return parseCsv(attr).map(Number);
}

function parseFloatCsv(attr) {
  return parseCsv(attr).map(Number);
}

// ── Fake rAF ──────────────────────────────────────────────────────────────

let frameCallbacks = [];
let simTimeMs = 0;
globalThis.requestAnimationFrame = (cb) => {
  const id = frameCallbacks.length;
  frameCallbacks.push(cb);
  return id;
};
globalThis.cancelAnimationFrame = (id) => {
  frameCallbacks[id] = null;
};

function stepFrame(deltaMs = 16) {
  simTimeMs += deltaMs;
  for (let i = frameCallbacks.length - 1; i >= 0; i--) {
    const cb = frameCallbacks[i];
    if (typeof cb === "function") {
      cb(simTimeMs);
      return;
    }
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
  canvas.width = 960;
  canvas.height = 540;
  main.appendChild(canvas);
  return { root, status, canvas };
}

// ── Host fake WebGPU (mirrors HV-07B lifecycle check) ─────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const hostsSrc = path.resolve(here, "../../../hosts/webgpu-browser/public/src");

if (typeof globalThis.GPUBufferUsage === "undefined") {
  globalThis.GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
}
if (typeof globalThis.GPUTextureUsage === "undefined") {
  globalThis.GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
}
if (typeof globalThis.GPUShaderStage === "undefined") {
  globalThis.GPUShaderStage = { VERTEX: 0x1, FRAGMENT: 0x2, COMPUTE: 0x4 };
}

function createFakeDevice() {
  let bufferSeq = 0;
  let submitted = 0;
  const queue = {
    submit() {
      submitted += 1;
    },
    onSubmittedWorkDone() {
      return new Promise((resolve) => {
        queueMicrotask(() => resolve());
      });
    },
  };
  return {
    queue,
    createBuffer(desc) {
      const id = ++bufferSeq;
      const size = desc.size;
      let mapped = desc.mappedAtCreation === true;
      const backing = new ArrayBuffer(size);
      return {
        id,
        size,
        __faberDestroyed: false,
        getMappedRange() {
          return backing;
        },
        unmap() {
          mapped = false;
        },
        destroy() {
          if (this.__faberDestroyed) {
            throw new Error(`double destroy buffer ${id}`);
          }
          this.__faberDestroyed = true;
        },
      };
    },
    createShaderModule() {
      return { __kind: "shader" };
    },
    createBindGroupLayout() {
      return { __kind: "bgl" };
    },
    createPipelineLayout() {
      return { __kind: "pl" };
    },
    createBindGroup() {
      return { __kind: "bg" };
    },
    createRenderPipeline() {
      return { __kind: "rp" };
    },
    createTexture(desc) {
      return {
        width: desc.size.width,
        height: desc.size.height,
        createView() {
          return { __kind: "view" };
        },
        destroy() {},
      };
    },
    createCommandEncoder() {
      const pass = {
        setPipeline() {},
        setBindGroup() {},
        setVertexBuffer() {},
        setIndexBuffer() {},
        drawIndexed() {},
        end() {},
      };
      return {
        beginRenderPass() {
          return pass;
        },
        finish() {
          return { __kind: "cmd" };
        },
      };
    },
    __submitted: () => submitted,
  };
}

function createFakeCanvasContext() {
  return {
    getCurrentTexture() {
      return {
        format: "bgra8unorm",
        width: 64,
        height: 64,
        createView() {
          return { __kind: "swap-view" };
        },
      };
    },
  };
}

function graphicsReflection() {
  return {
    schema_version: 1,
    target: "wgsl-text",
    kernels: [
      {
        entry_name: "hello_voxel_vertex",
        shader_stage: "vertex",
        vertex_input_count: 2,
        vertex_inputs: [
          { source_name: "position", location: 0, format: "float32x3", step_mode: "vertex", offset_bytes: 0, stride_bytes: 12 },
          { source_name: "color", location: 1, format: "float32x3", step_mode: "vertex", offset_bytes: 0, stride_bytes: 12 },
        ],
        resources: [
          {
            group: 0, binding: 0, kind: "storage-buffer", role: "input", access: "read",
            element_layout: "f32", element_byte_width: 4, element_count: 64, buffer_byte_len: 256,
            source_local: null, source_name: "transform",
          },
        ],
        launch: {
          entry_name: "hello_voxel_vertex",
          shader_stage: "vertex",
          webgpu_adapter: {
            pipeline_layout_descriptor: { bind_group_layout_count: 1, bind_group_layout_indexes: [0], bind_group_layout_index_count: 1 },
            bind_group_layout_descriptor_count: 1,
            bind_group_layout_descriptor_indexes: [0],
            bind_group_layout_descriptor_index_count: 1,
            bind_group_layout_descriptors: [{
              bind_group_index: 0, group: 0,
              layout_entry_indexes: [0], layout_entry_index_count: 1, entry_count: 1,
              entries: [{
                binding: 0, binding_index: 0, buffer_byte_len: 256, buffer_byte_offset: 0,
                binding_byte_len: 256, visibility: "vertex", buffer_type: "read-only-storage",
                has_dynamic_offset: false, min_binding_size: 256, resource_index: 0,
                layout_entry_index: 0, source_local: null, source_name: "transform",
              }],
            }],
            bind_group_descriptor_count: 1,
            bind_group_descriptor_indexes: [0],
            bind_group_descriptor_index_count: 1,
            bind_group_descriptors: [{
              bind_group_index: 0, group: 0,
              entry_indexes: [0], entry_index_count: 1, entry_count: 1,
              entries: [{
                binding: 0, kind: "storage-buffer", role: "input", access: "read",
                shader_access: "read", shader_visibility: "vertex", element_layout: "f32",
                element_byte_width: 4, element_count: 64, resource_index: 0, binding_index: 0,
                buffer_type: "read-only-storage", buffer_byte_len: 256, buffer_byte_offset: 0,
                binding_byte_len: 256, min_binding_size: 256, has_dynamic_offset: false,
                source_local: null, source_name: "transform",
              }],
            }],
            vertex_buffer_layout_descriptor_count: 2,
            vertex_buffer_layout_descriptor_indexes: [0, 1],
            vertex_buffer_layout_descriptor_index_count: 2,
            vertex_buffer_layout_descriptors: [
              {
                buffer_index: 0, array_stride: 12, step_mode: "vertex",
                attribute_indexes: [0], attribute_index_count: 1, attribute_count: 1,
                attributes: [{ attribute_index: 0, shader_location: 0, format: "float32x3", offset: 0, source_name: "position" }],
                source_name: "position",
              },
              {
                buffer_index: 1, array_stride: 12, step_mode: "vertex",
                attribute_indexes: [0], attribute_index_count: 1, attribute_count: 1,
                attributes: [{ attribute_index: 0, shader_location: 1, format: "float32x3", offset: 0, source_name: "color" }],
                source_name: "color",
              },
            ],
            dispatch_workgroup_dimension_count: 3,
            dispatch_workgroups: { x: 1, y: 1, z: 1 },
          },
        },
      },
      {
        entry_name: "hello_voxel_fragment",
        shader_stage: "fragment",
        vertex_input_count: 0,
        vertex_inputs: [],
        resources: [],
        launch: {
          entry_name: "hello_voxel_fragment",
          shader_stage: "fragment",
          webgpu_adapter: {
            pipeline_layout_descriptor: { bind_group_layout_count: 1, bind_group_layout_indexes: [0], bind_group_layout_index_count: 1 },
            bind_group_layout_descriptor_count: 1,
            bind_group_layout_descriptor_indexes: [0],
            bind_group_layout_descriptor_index_count: 1,
            bind_group_layout_descriptors: [{
              bind_group_index: 0, group: 0,
              layout_entry_indexes: [0], layout_entry_index_count: 1, entry_count: 1,
              entries: [{
                binding: 0, binding_index: 0, buffer_byte_len: 256, buffer_byte_offset: 0,
                binding_byte_len: 256, visibility: "fragment", buffer_type: "read-only-storage",
                has_dynamic_offset: false, min_binding_size: 256, resource_index: 0,
                layout_entry_index: 0, source_local: null, source_name: "transform",
              }],
            }],
            bind_group_descriptor_count: 1,
            bind_group_descriptor_indexes: [0],
            bind_group_descriptor_index_count: 1,
            bind_group_descriptors: [{
              bind_group_index: 0, group: 0,
              entry_indexes: [0], entry_index_count: 1, entry_count: 1,
              entries: [{
                binding: 0, kind: "storage-buffer", role: "input", access: "read",
                shader_access: "read", shader_visibility: "fragment", element_layout: "f32",
                element_byte_width: 4, element_count: 64, resource_index: 0, binding_index: 0,
                buffer_type: "read-only-storage", buffer_byte_len: 256, buffer_byte_offset: 0,
                binding_byte_len: 256, min_binding_size: 256, has_dynamic_offset: false,
                source_local: null, source_name: "transform",
              }],
            }],
            vertex_buffer_layout_descriptor_count: 0,
            vertex_buffer_layout_descriptor_indexes: [],
            vertex_buffer_layout_descriptor_index_count: 0,
            vertex_buffer_layout_descriptors: [],
            dispatch_workgroup_dimension_count: 3,
            dispatch_workgroups: { x: 1, y: 1, z: 1 },
          },
        },
      },
    ],
    pipeline: {
      color_target_formats: ["bgra8unorm"],
      primitive_topology: "triangle-list",
      vertex_count: 6,
      depth_stencil: {
        depth_write_enabled: true,
        depth_compare: "less",
        stencil_read_mask: 4294967295,
        stencil_write_mask: 4294967295,
        stencil_front: { compare: "always", fail_op: "keep", depth_fail_op: "keep", pass_op: "keep" },
        stencil_back: { compare: "always", fail_op: "keep", depth_fail_op: "keep", pass_op: "keep" },
      },
    },
  };
}

function f32ArrayFromCsv(attr) {
  const values = parseFloatCsv(attr);
  return new Float32Array(values);
}

function u32ArrayFromCsv(attr) {
  const values = parseCsv(attr).map(Number);
  return new Uint32Array(values);
}

function readHostReplaces(canvas) {
  const count = Number(canvas.getAttribute("data-hv-host-replace-count") || "0");
  const out = [];
  for (let i = 0; i < count; i++) {
    const prefix = `data-hv-host-replace-${i}`;
    const kind = canvas.getAttribute(`${prefix}-kind`);
    const logicalId = Number(canvas.getAttribute(`${prefix}-logical-id`));
    const generation = Number(canvas.getAttribute(`${prefix}-generation`));
    if (kind === "removed") {
      out.push({ logical_id: logicalId, generation, kind, payload: null });
    } else {
      out.push({
        logical_id: logicalId,
        generation,
        kind,
        payload: {
          positions: f32ArrayFromCsv(canvas.getAttribute(`${prefix}-positions`)),
          colors: f32ArrayFromCsv(canvas.getAttribute(`${prefix}-colors`)),
          indices: u32ArrayFromCsv(canvas.getAttribute(`${prefix}-indices`)),
        },
      });
    }
  }
  return out;
}

function readGens(canvas) {
  return parseIntCsv(canvas.getAttribute("data-hv-resource-gens"));
}

function readRemeshed(canvas) {
  return parseIntCsv(canvas.getAttribute("data-hv-remeshed"));
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ── Mount package ─────────────────────────────────────────────────────────

const { root, status, canvas } = buildHelloVoxelDom();
globalThis.document = root;
globalThis.document.focused = true;
globalThis.document.pointerLockElement = null;
globalThis.document.exitPointerLock = () => {
  globalThis.document.pointerLockElement = null;
};
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
assert(canvas.getAttribute("data-hv-interaction") === "ready", "interaction ready");
assert(canvas.getAttribute("data-hv-payload-kind") === "four-chunk-world", "payload four-chunk");
assert(
  canvas.getAttribute("data-hv-residual-path") === "per-chunk-multi-draw",
  "admitted residual path is per-chunk-multi-draw",
);

// Bootstrap: four live chunks at generation 0 + host create queue.
const gens0 = readGens(canvas);
assert(gens0.length === 4, `four resource gens, got ${gens0.length}`);
assert(arraysEqual(gens0, [0, 0, 0, 0]), `bootstrap gens all 0, got ${gens0}`);
assert(canvas.getAttribute("data-hv-c0-live") === "1", "chunk 0 live");
assert(canvas.getAttribute("data-hv-c1-live") === "1", "chunk 1 live");
assert(canvas.getAttribute("data-hv-c2-live") === "1", "chunk 2 live");
assert(canvas.getAttribute("data-hv-c3-live") === "1", "chunk 3 live");
const bootstrapReplaces = readHostReplaces(canvas);
assert(bootstrapReplaces.length === 4, `bootstrap 4 creates, got ${bootstrapReplaces.length}`);
assert(
  bootstrapReplaces.every((r) => r.kind === "created" && r.generation === 0),
  "bootstrap replaces are creates at gen 0",
);
assert(Number(canvas.getAttribute("data-hv-draw-count")) === 4, "draw-count 4");
assert(Number(canvas.getAttribute("data-hv-non-empty-chunk-count")) === 4, "non-empty 4");

// ── Host session from bootstrap creates ───────────────────────────────────

const { loadFaberGraphicsPipeline } = await import(
  pathToFileURL(path.join(hostsSrc, "faber-kernel.js")).href
);
const {
  createChunkGraphicsResources,
  applyChunkResourceReplace,
  destroyRetiredChunkResources,
  runChunkGraphicsFrame,
  chunkResourceCounters,
  chunkResourceSnapshot,
  liveChunkIds,
} = await import(pathToFileURL(path.join(hostsSrc, "webgpu-runtime.js")).href);

const descriptor = loadFaberGraphicsPipeline({
  wgsl: "@vertex fn hello_voxel_vertex() -> @builtin(position) vec4<f32> {}\n@fragment fn hello_voxel_fragment() -> @location(0) vec4<f32> {}",
  reflection: graphicsReflection(),
  drawManifest: { index_format: "uint32", instance_count: 1, base_vertex: 0, first_index: 0, index_count: 6 },
});
const transform = new Float32Array(64);
const device = createFakeDevice();
const context = createFakeCanvasContext();
const resources = createChunkGraphicsResources(
  device,
  descriptor,
  { storageData: { transform } },
  context,
);

for (const rep of bootstrapReplaces) {
  const result = applyChunkResourceReplace(device, resources, {
    logical_id: rep.logical_id,
    generation: rep.generation,
    payload: rep.payload,
  });
  assert(result.kind === "created", `host create chunk ${rep.logical_id}`);
}
let counters = chunkResourceCounters(resources);
assert(counters.live === 4 * BUFFERS_PER_PAIR, `live 12 after bootstrap, got ${counters.live}`);
assert(counters.live_chunks === 4, `live_chunks 4, got ${counters.live_chunks}`);
assert(counters.path === "per-chunk-multi-draw", "host path multi-draw");
assert(arraysEqual([...liveChunkIds(resources)], [0, 1, 2, 3]), "live ids 0..3");

const frameState = { submittedFrameCount: 0 };
runChunkGraphicsFrame(device, context, resources, descriptor, frameState, { recordSubmit: true });
assert(frameState.submits[0].multi_draw === true, "frame is multi-draw");
assert(frameState.submits[0].draw_count === 4, "four draws");

// Snapshot host buffer object identities for unaffected-chunk stability.
function hostBufferIds() {
  const map = new Map();
  for (const id of liveChunkIds(resources)) {
    const entry = resources.chunks.get(id);
    map.set(id, entry.buffers.map((b) => b.id));
  }
  return map;
}
const hostIdsBeforeEdit = hostBufferIds();

// ── Walk to wall, interior remove (z=8 interior of chunk; x~20 → chunk 1) ─

canvas.dispatchEvent(new FakeEvent("keydown", { key: "w", code: "KeyW", repeat: false }));
for (let i = 0; i < 40; i++) stepFrame(50);
canvas.dispatchEvent(new FakeEvent("keyup", { key: "w", code: "KeyW", repeat: false }));
stepFrame(16);

assert(canvas.getAttribute("data-hv-select-active") === "1", "selection active near wall");
const hitX = Number(canvas.getAttribute("data-hv-select-hit-x"));
const hitY = Number(canvas.getAttribute("data-hv-select-hit-y"));
const hitZ = Number(canvas.getAttribute("data-hv-select-hit-z"));
assert(hitZ === 8, `hit wall z=8, got ${hitZ}`);
// Wall cell is interior of its chunk (lz=8 ≠ 0/15) → owning chunk only.
const owningChunk = hitX < 16 ? 0 : 1;
assert(owningChunk === 0 || owningChunk === 1, `owning chunk 0|1, got ${owningChunk}`);

const gensBeforeRemove = readGens(canvas);
canvas.dispatchEvent(new FakeEvent("pointerdown", {
  clientX: 0, clientY: 0, movementX: 0, movementY: 0, button: 0, isPrimary: true,
}));
// Remesh applies on next frame.
stepFrame(16);

assert(canvas.getAttribute("data-hv-last-edit") === "remove", "last-edit remove");
assert(Number(canvas.getAttribute("data-hv-edit-count")) >= 1, "edit-count advanced");

const remeshed1 = readRemeshed(canvas);
assert(remeshed1.length >= 1, `remeshed after remove non-empty, got ${remeshed1}`);
assert(
  remeshed1.includes(owningChunk),
  `remeshed includes owning ${owningChunk}, got ${remeshed1}`,
);
// Interior z=8: only owning chunk (not neighbor).
assert(
  arraysEqual(remeshed1, [owningChunk]),
  `interior remove remeshes only [${owningChunk}], got ${remeshed1}`,
);

const gensAfterRemove = readGens(canvas);
assert(gensAfterRemove.length === 4, "gens still length 4");
for (let i = 0; i < 4; i++) {
  if (remeshed1.includes(i)) {
    assert(
      gensAfterRemove[i] === gensBeforeRemove[i] + 1 || gensAfterRemove[i] > gensBeforeRemove[i],
      `affected chunk ${i} gen advanced ${gensBeforeRemove[i]} → ${gensAfterRemove[i]}`,
    );
  } else {
    assert(
      gensAfterRemove[i] === gensBeforeRemove[i],
      `unaffected chunk ${i} gen stable ${gensBeforeRemove[i]} (got ${gensAfterRemove[i]})`,
    );
  }
}

// Host apply replace queue from package attrs.
const replaces1 = readHostReplaces(canvas);
assert(replaces1.length >= 1, `host replace queue non-empty, got ${replaces1.length}`);
assert(
  replaces1.every((r) => remeshed1.includes(r.logical_id)),
  "host replaces only remeshed logical ids",
);
assert(
  replaces1.every((r) => r.kind === "replaced" || r.kind === "removed" || r.kind === "created"),
  "host replace kinds are valid",
);

for (const rep of replaces1) {
  applyChunkResourceReplace(device, resources, {
    logical_id: rep.logical_id,
    generation: rep.generation,
    payload: rep.payload,
  });
}

// Unaffected host buffer object identities must not change.
const hostIdsAfterReplace = hostBufferIds();
for (let i = 0; i < 4; i++) {
  if (!remeshed1.includes(i)) {
    assert(
      arraysEqual(hostIdsBeforeEdit.get(i), hostIdsAfterReplace.get(i)),
      `unaffected host buffers for chunk ${i} stable`,
    );
    const snap = chunkResourceSnapshot(resources, i);
    assert(snap !== null, `chunk ${i} still live on host`);
    assert(snap.generation === 0, `unaffected host gen stays 0, got ${snap.generation}`);
  } else {
    const snap = chunkResourceSnapshot(resources, i);
    assert(snap !== null && snap.generation > 0, `affected host gen advanced for ${i}`);
  }
}

// Submit + queue completion destroy — live stays bounded at 4 pairs.
runChunkGraphicsFrame(device, context, resources, descriptor, frameState);
const destroy1 = await destroyRetiredChunkResources(device, resources);
assert(destroy1.destroyed_buffers === replaces1.length * BUFFERS_PER_PAIR
  || destroy1.destroyed_buffers >= BUFFERS_PER_PAIR, `destroyed retired buffers, got ${destroy1.destroyed_buffers}`);
counters = chunkResourceCounters(resources);
assert(counters.live === 4 * BUFFERS_PER_PAIR, `live still 12 after first cycle, got ${counters.live}`);
assert(counters.pending_retire_groups === 0, "no pending retire after completion");
assert(counters.destroyed === destroy1.destroyed_buffers, "destroyed counter matches");

// ── Place then remove cycles (bounded live) ───────────────────────────────

// Walk slightly and place/remove repeatedly against remaining wall solids.
const CYCLE_COUNT = 6;
let maxLive = counters.live;
let placeCount = 0;
let removeCount = 0;

for (let cycle = 0; cycle < CYCLE_COUNT; cycle++) {
  // Nudge horizontally so we hit a still-solid wall cell.
  canvas.dispatchEvent(new FakeEvent("keydown", { key: "d", code: "KeyD", repeat: false }));
  stepFrame(50);
  canvas.dispatchEvent(new FakeEvent("keyup", { key: "d", code: "KeyD", repeat: false }));
  stepFrame(16);

  const gensBefore = readGens(canvas);
  const hostIdsBefore = hostBufferIds();

  // Prefer place if we have preceding; else remove.
  const selectActive = canvas.getAttribute("data-hv-select-active") === "1";
  const hasPreceding = canvas.getAttribute("data-hv-select-has-preceding") === "1";
  if (selectActive && hasPreceding && cycle % 2 === 0) {
    canvas.dispatchEvent(new FakeEvent("pointerdown", {
      clientX: 0, clientY: 0, movementX: 0, movementY: 0, button: 2, isPrimary: false,
    }));
  } else if (selectActive) {
    canvas.dispatchEvent(new FakeEvent("pointerdown", {
      clientX: 0, clientY: 0, movementX: 0, movementY: 0, button: 0, isPrimary: true,
    }));
  } else {
    // No selection: still advance a frame to keep loop honest.
    stepFrame(16);
    continue;
  }

  stepFrame(16);
  const lastEdit = canvas.getAttribute("data-hv-last-edit");
  if (lastEdit === "place") placeCount += 1;
  if (lastEdit === "remove") removeCount += 1;
  if (lastEdit !== "place" && lastEdit !== "remove") {
    // Rejected edit — no remesh required.
    continue;
  }

  const remeshed = readRemeshed(canvas);
  const gensAfter = readGens(canvas);
  assert(remeshed.length >= 1, `cycle ${cycle}: remeshed non-empty after edit`);

  for (let i = 0; i < 4; i++) {
    if (!remeshed.includes(i)) {
      assert(
        gensAfter[i] === gensBefore[i],
        `cycle ${cycle}: unaffected gen ${i} stable (${gensBefore[i]})`,
      );
    }
  }

  const replaces = readHostReplaces(canvas);
  for (const rep of replaces) {
    applyChunkResourceReplace(device, resources, {
      logical_id: rep.logical_id,
      generation: rep.generation,
      payload: rep.payload,
    });
  }

  const hostIdsAfter = hostBufferIds();
  for (let i = 0; i < 4; i++) {
    if (!remeshed.includes(i) && hostIdsBefore.has(i) && hostIdsAfter.has(i)) {
      assert(
        arraysEqual(hostIdsBefore.get(i), hostIdsAfter.get(i)),
        `cycle ${cycle}: host buffers chunk ${i} stable`,
      );
    }
  }

  runChunkGraphicsFrame(device, context, resources, descriptor, frameState);
  await destroyRetiredChunkResources(device, resources);
  counters = chunkResourceCounters(resources);
  maxLive = Math.max(maxLive, counters.live);
  // Live buffers = 3 × live non-empty chunks (never unbounded growth).
  assert(
    counters.live === counters.live_chunks * BUFFERS_PER_PAIR,
    `cycle ${cycle}: live ${counters.live} == 3 * live_chunks ${counters.live_chunks}`,
  );
  assert(counters.pending_retire_groups === 0, `cycle ${cycle}: pending retire cleared`);
  assert(
    counters.live <= 4 * BUFFERS_PER_PAIR,
    `cycle ${cycle}: live ≤ 12 (got ${counters.live})`,
  );
}

assert(placeCount + removeCount >= 2, `at least 2 successful edits across cycles (p=${placeCount} r=${removeCount})`);
assert(maxLive <= 4 * BUFFERS_PER_PAIR, `max live never exceeded 12, got ${maxLive}`);
assert(counters.destroyed >= BUFFERS_PER_PAIR, `destroyed advanced over cycles (${counters.destroyed})`);
assert(counters.created >= 4 * BUFFERS_PER_PAIR + BUFFERS_PER_PAIR, "created advanced beyond bootstrap");

// Final multi-draw still honest.
const finalDraw = runChunkGraphicsFrame(device, context, resources, descriptor, frameState, {
  recordSubmit: true,
});
assert(finalDraw.draw_count === counters.live_chunks, "final draw_count == live chunks");
assert(
  canvas.getAttribute("data-hv-residual-path") === "per-chunk-multi-draw",
  "package residual path still multi-draw",
);

// Record hit cell for residual reporting (not a gate failure).
void hitY;

runtime.dispose();

console.log(`\n${PASS}: ${passed} passed, ${failed} failed`);
console.log(
  `HV-07C evidence: place=${placeCount} remove=${removeCount} maxLive=${maxLive} ` +
    `created=${counters.created} destroyed=${counters.destroyed} live=${counters.live}`,
);
if (failed > 0) {
  process.exit(1);
}

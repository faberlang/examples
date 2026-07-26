# Stage 1 — Delivery: Canonical Browser Product And Live Host Bridge

**Planner:** planner-1
**Goal path:** `01-stage1-goal-forge.md`
**Goal-check verdict:** READY (`01-stage1-goal-check.md`)
**Date:** 2026-07-26
**Artifact kind:** P3 delivery spec
**Unit count:** 4

## Interpreted unit

Lower Stage 1 into four implementable units. The first three units are disjoint
and parallel-safe (examples product page, faber manifest, hosts API). The fourth
unit integrates them all and exercises the complete bridge.

## Normalized spec

A generated browser product mounts the drift-city controller. The page loads the
WebGPU host runtime from copied static assets. A `product.json` manifest
identifies all same-build artifacts by path and sha256. The host exposes
`updateGraphicsStorage` (reflection-driven, existing at HEAD) as the canonical
storage update seam. The controller calls it each frame with a 32-float
transform payload. The frame
loop supports resize (canvas context reconfiguration) and device loss (bounded
error + cleanup). The admitted module graph contains no Three.js.

## Repo-aware baseline

| Repo | Existing seam | Stage 1 touch |
| --- | --- | --- |
| `examples/triga-drift-city/` | `@WebController`, `faber.toml`, `pages/index.html`, `tests/run.sh` | Add canvas, host runtime static assets, host init script, update controller |
| `faber/` | `faber/src/package/product.rs` emits `assets.json` and `controllers.json` | Emit `product.json` after build |
| `hosts/webgpu-browser/` | `webgpu-runtime.js` exports `updateGraphicsStorage` (reflection-driven, resolves by `resourceIndex` or `sourceName`, validates role and byte bounds, writes to `storageBuffers` map), `graphics-storage-update-check.mjs` (6/6 PASS) | Confirm `updateGraphicsStorage` as the canonical Stage 1 host update seam (no new API). Validate via existing check harness. |
| `triga/` | `triga/src/triga.fab` defines `TransformPayload`, matrix ops | No source changes. Contract reference. |

## Ordered unit graph

```
U1 (examples) ──┐
                ├──► U4 (examples + triga contract freeze)
U3 (hosts) ─────┘

U2 (faber) ──── (parallel, no deps)
```

U1 and U3 are provably disjoint (different repos, no shared files). U2 is also
disjoint. All three can execute in parallel. U1's `host-init.js` exports a stub
`updateGraphicsStorage` field (throws `"not wired"`) pending U4 integration; U3
confirms the canonical `updateGraphicsStorage` export exists and passes its
check harness. U4 wires the real host symbol into `host-init.js`.

---

### Unit 1 — Product Page, Canvas, And Host Runtime Loading

| Field | Value |
| --- | --- |
| `id` | `u1-product-page-canvas-host-loading` |
| `outcome` | The product page mounts the drift-city controller in a real browser page with a WebGPU-capable canvas. The host runtime (`faber-kernel.js`, `webgpu-runtime.js`) is loaded from `public/` static assets. A `host-init.js` bootstrap script creates a WebGPU device and exposes the host API. Controller mount/dispose/failure produces inspectable status attributes. |
| `write_scope` | `examples/triga-drift-city/pages/index.html`, `examples/triga-drift-city/public/` (new files: `faber-kernel.js`, `webgpu-runtime.js`, `host-init.js`), `examples/triga-drift-city/tests/run.sh` (add stage checks) |
| `read_scope` | `hosts/webgpu-browser/public/src/faber-kernel.js`, `hosts/webgpu-browser/public/src/webgpu-runtime.js`, `examples/hello-voxel/pages/index.html` (canvas pattern), `examples/hello-voxel/scripta/` (host proof pattern), `examples/triga-drift-city/src/main.fab`, `faber-web/src/dom.fab` |
| `done_when` | (1) `pages/index.html` has a `<canvas>` inside `#triga-drift-city` with a known `id` or class. (2) `public/faber-kernel.js` and `public/webgpu-runtime.js` exist and are identical copies of the host source files (verified by sha256 or diff). (3) `public/host-init.js` exists and, when loaded as a module, exports `initHost()` that returns `{ device, updateGraphicsStorage: placeholder, submitFrame, resize, destroy }` where `updateGraphicsStorage` is a stub that throws `"not wired"` until U4 wires the real `updateGraphicsStorage` from the host. (4) Loading the product page mounts the controller: `.drift-status` text is not `simulation-pending`. (5) Controller dispose removes subscriptions and sets `.drift-status` to a disposed state. (6) Missing DOM (e.g., no `.drift-status` element) produces a bounded mount failure with `data-mount-error`. (7) `tests/run.sh` passes including new stage checks. |
| `validation` | ```sh\n# Host file copies are identical\ndiff hosts/webgpu-browser/public/src/faber-kernel.js examples/triga-drift-city/public/faber-kernel.js\ndiff hosts/webgpu-browser/public/src/webgpu-runtime.js examples/triga-drift-city/public/webgpu-runtime.js\n# Product build succeeds (prebuilt binary, matches tests/run.sh)\nFABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"\n"$FABER_BIN" build --package .\n# Controller manifest has expected selector\ngrep -q '"selector": "#triga-drift-city"' dist/controllers.json\n# No Three.js in dist\ngrep -R -i -E 'three(\\.js)?' dist/ || true\n# Full test suite\n./tests/run.sh\n``` |
| `depends_on` | none |
| `non_goals` | Do not modify the controller logic (`src/main.fab`) — only the page and host loading. Do not create WebGPU buffers or pipelines — that is U4. Do not implement the real `updateGraphicsStorage` wiring — U3 confirms the canonical seam, and U4 wires it into `host-init.js`. The `updateGraphicsStorage` field on U1's `host-init.js` return value is a stub placeholder that throws `"not wired"`; U4 replaces it with the real import. Do not emit `product.json` — that is U2. |
| `risk` | low — page structure change is mechanical; host file copying is mechanical; controller mount/dispose is a proven pattern (hello-voxel, existing fixture). |

---

### Unit 2 — Product Identity Manifest

| Field | Value |
| --- | --- |
| `id` | `u2-product-identity-manifest` |
| `outcome` | `faber build --package .` emits `dist/product.json` after a successful browser product build. The manifest records every same-build artifact at this stage: generated ESM entry (`faber-browser.js`), `controllers.json`, host runtime files (`faber-kernel.js`, `webgpu-runtime.js`), and a reference to `assets.json` by path and sha256. WGSL and reflection artifacts are omitted (they do not exist at Stage 1). The manifest schema is versioned (`"version": 1`), includes `"stage": 1` and `"next_stage_artifacts": ["wgsl", "reflection"]` as an extension hint for Stage 2, and includes a build timestamp. |
| `write_scope` | `faber/src/package/product.rs`, `faber/Cargo.toml` (if new dependency needed — unlikely), `faber/src/package/mod.rs` (if new module needed) |
| `read_scope` | `faber/src/package/product.rs` (existing `BrowserProductBuild`, `BrowserProductAssetBuild`, `assets.json` emission), `faber/src/package/manifest.rs` (manifest struct), `faber/src/package/paths.rs` |
| `done_when` | (1) `faber build --package .` in `examples/triga-drift-city/` produces `dist/product.json`. (2) The manifest has `"version": 1`, `"stage": 1`, `"next_stage_artifacts": ["wgsl", "reflection"]`, and `"build_timestamp"` (ISO 8601). (3) `"artifacts"` array lists at minimum: `faber-browser.js` (ESM entry), `controllers.json`, `faber-kernel.js`, `webgpu-runtime.js`. The `assets.json` is referenced by `"assets_manifest"` field. No WGSL or reflection entries appear in `"artifacts"`. (4) Each artifact entry has `"path"` (relative to `dist/`), `"kind"`, `"size"`, `"sha256"`. (5) `"assets_manifest"` field is `"assets.json"`. (6) The prebuilt `faber` binary (`faber/target/debug/faber`) succeeds at emitting `product.json` and running the existing `tests/run.sh` passes; the faber crate itself does not compile at `4acabab` (20 errors) and that baseline fix is out of Stage 1 scope. (7) A focused `product.json` schema validation script (not `cargo test`) proves the manifest is valid JSON, all referenced paths exist, and `next_stage_artifacts` entries are absent from `"artifacts"`. |
| `validation` | ```sh\n# Build drift-city product (prebuilt binary, matches tests/run.sh)\nFABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"\n"$FABER_BIN" build --package .\n# Manifest exists and is valid JSON\ncat dist/product.json | python3 -m json.tool > /dev/null\n# Manifest has expected fields\ngrep -q '"version": 1' dist/product.json\ngrep -q '"stage": 1' dist/product.json\ngrep -q '"next_stage_artifacts"' dist/product.json\ngrep -q '"wgsl"' dist/product.json\n# next_stage_artifacts includes wgsl + reflection (Stage 2 extension hint)\ngrep -q '"reflection"' dist/product.json\ngrep -q '"faber-browser.js"' dist/product.json\ngrep -q '"controllers.json"' dist/product.json\ngrep -q '"faber-kernel.js"' dist/product.json\ngrep -q '"webgpu-runtime.js"' dist/product.json\ngrep -q '"assets.json"' dist/product.json\n# WGSL and reflection must NOT appear in artifacts array (Stage 2 only)\n! grep -A100 '"artifacts"' dist/product.json | grep -q '"wgsl"'\n! grep -A100 '"artifacts"' dist/product.json | grep -q '"reflection"'\n# Every artifact path in the manifest exists in dist/\n# (scripted check: for each artifact, test -f dist/<path>)\n# Existing test suite (baseline green)\n./tests/run.sh\n``` |
| `depends_on` | none |
| `non_goals` | Do not change `assets.json` format. Do not add a new CLI flag to `faber build`. Do not change the TypeScript emit or `tsc` pipeline. Do not include `dist/faber-ts/` or `dist/tsconfig.faber-browser.json` in the manifest (build intermediates, not product artifacts). |
| `risk` | low — additive change to a single Rust file. No breaking change to existing build output. The `product.json` is written after `assets.json` and `controllers.json`, so a build failure before that point leaves no stale manifest. |

---

### Unit 3 — Canonical Host Storage-Buffer Update (Existing Seam Confirmation)

| Field | Value |
| --- | --- |
| `id` | `u3-canonical-host-storage-update` |
| `outcome` | Confirm that `hosts/webgpu-browser/public/src/webgpu-runtime.js` `updateGraphicsStorage(device, resources, descriptor, { resourceIndex, sourceName, data })` is the canonical Stage 1 host update seam. This reflection-driven function already exists at HEAD (`9cdd3c9`): it resolves the target resource by `resourceIndex` or `sourceName` from the graphics descriptor bind groups, validates input role and byte bounds, writes via `device.queue.writeBuffer` to the existing `resources.storageBuffers` map, increments the generation counter, and returns a frozen `{ status, resourceIndex, generation }` object. It is covered by `graphics-storage-update-check.mjs` (6/6 PASS). U3 does NOT invent a new `updateStorageBuffer`/`createHostSession` API — the campaign rule "host consumes compiler reflection and declared artifacts" and the clean-break rule "no second accepted renderer path" both require consuming the existing reflection-driven seam, not creating a competing caller-supplied-declaration seam. |
| `write_scope` | `hosts/webgpu-browser/public/src/webgpu-runtime.js` — confirm-only; no changes needed unless a thin session wrapper is wanted (over `updateGraphicsStorage` + the existing `resources.storageBuffers` map, not a caller-supplied declaration map). `hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` — may add transform-specific fixture entries if needed for Stage 1 context. |
| `read_scope` | `hosts/webgpu-browser/public/src/webgpu-runtime.js` (lines 1640-1740: `updateGraphicsStorage` signature, validation, write, generation), `hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` (6/6 PASS; fake-device harness), `hosts/webgpu-browser/public/src/faber-kernel.js` (FaberKernelContractError) |
| `done_when` | (1) Re-ground: `grep -q 'export function updateGraphicsStorage' hosts/webgpu-browser/public/src/webgpu-runtime.js` passes at HEAD. (2) Existing check harness passes: `node hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` → 6/6 PASS. (3) `updateGraphicsStorage` accepts transform-form data: calling with `{ resourceIndex: 0, data: new Float32Array(32) }` against a fixture graphics descriptor (bind group with resourceIndex=0, role="input", bufferByteLen=128) succeeds and returns `{ status: 0, resourceIndex: 0, generation: 1 }`. (4) The function rejects non-input resources, out-of-bounds data, and non-Float32Array data (already proven by 6/6). (5) A Stage 1 context fixture (`graphics-storage-update-check.mjs` or a new check script) includes a transform-payload-sized entry (128 bytes = 32 f32) and passes. (6) No competing `updateStorageBuffer` or `createHostSession` exports are added to the same module. |
| `validation` | ```sh\n# Confirm updateGraphicsStorage exists at HEAD\ngrep -q 'export function updateGraphicsStorage' hosts/webgpu-browser/public/src/webgpu-runtime.js\n# Run existing 6/6 check harness\nnode hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs\n# Verify the function signature matches the Stage 1 bridge contract\n# (resourceIndex-or-sourceName resolution, input-role validation, byte-bounds check)\ngrep -q 'resourceIndex' hosts/webgpu-browser/public/src/webgpu-runtime.js\n# Verify no competing updateStorageBuffer/createHostSession exports exist\n! grep -q 'export function updateStorageBuffer' hosts/webgpu-browser/public/src/webgpu-runtime.js\n! grep -q 'export function createHostSession' hosts/webgpu-browser/public/src/webgpu-runtime.js\n# Verify storageBuffers map is the canonical buffer store (not a caller-supplied declaration)\ngrep -q 'resources.storageBuffers' hosts/webgpu-browser/public/src/webgpu-runtime.js\n``` |
| `depends_on` | none |
| `non_goals` | Do not create a new `updateStorageBuffer`/`createHostSession` API (competing seam rejected by campaign clean-break rule). Do not bypass reflection — `updateGraphicsStorage` resolves resource identity from the graphics descriptor bind groups, not from caller-supplied buffer declarations. Do not change `faber-kernel.js`. Do not add application-specific knowledge of "transform", "camera", or "scene" — `updateGraphicsStorage` is already app-agnostic. |
| `risk` | low — the canonical seam already exists, is tested (6/6 PASS), and covers all Stage 1 requirements (reflection-driven, role-validated, byte-bounded, Float32Array-input). U3 is confirmation, not invention. |

---

### Unit 4 — Integration: Frame/Resize/Device-Loss Lifecycle + Transform Bridge

| Field | Value |
| --- | --- |
| `id` | `u4-integration-lifecycle-transform-bridge` |
| `outcome` | The drift-city controller calls `host.updateGraphicsStorage` each frame with a 32-float transform payload (16 model + 16 view-projection). The frame loop uses `requestAnimationFrame`. On resize, the canvas context is reconfigured without restarting the controller. On device loss, the frame loop stops, GPU resources are cleaned up, and `data-device-status="lost"` is set. Two consecutive frames produce different stored transform values (readback evidence). No Three.js in the admitted module graph. The canonical transform contract is documented and frozen. |
| `write_scope` | `examples/triga-drift-city/src/main.fab` (controller: compute transform payload, call host API), `examples/triga-drift-city/public/host-init.js` (frame loop, resize handler, device loss handler, host session wiring), `examples/triga-drift-city/tests/run.sh` (add integration checks), `triga/docs/` or `triga/src/triga.fab` (contract documentation — comment only, no logic change) |
| `read_scope` | `triga/src/triga.fab` (TransformPayload, matrix4_identitas, camera_forward_planus_ex_yaw, matrix4_perspectiva, matrix4_conspectus, matrix4_multiplicata, transform_payload), `examples/triga-drift-city/src/main.fab` (existing controller), `examples/triga-drift-city/src/city.fab`, `examples/triga-drift-city/src/vehicle.fab`, `hosts/webgpu-browser/public/src/webgpu-runtime.js` (updateGraphicsStorage API, resources.storageBuffers map), `hosts/webgpu-browser/public/src/faber-kernel.js` (error types), `faber-web/src/dom.fab` (FrameState, ResizeState) |
| `done_when` | (1) Controller computes a 32-float `TransformPayload` each frame: 16 model (identity or derived from vehicle position/heading) + 16 view-projection (perspective camera from chase camera position/target). (2) Controller calls `host.updateGraphicsStorage(device, resources, descriptor, { resourceIndex: 0, data: new Float32Array(payload.values) })` each frame. (3) `host-init.js` frame loop: `rAF` → controller frame callback → host submit frame. Loop stops on dispose. (4) Resize: canvas `width`/`height` attributes update; `GPUCanvasContext.configure({width, height})` is called. Controller state (frame count, vehicle position) does not reset. (5) Device loss: `device.lost` promise or `uncapturederror` → `data-device-status="lost"` on facts element, frame loop stops, all buffers destroyed, no uncaught error. (6) Readback proof: after 2+ frames, mapping the transform storage buffer (created with `GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST`) directly via `buffer.mapAsync(GPUMapMode.READ)` shows different Float32 values (e.g., changing vehicle position). No compute dispatch is involved — the host writes transform data to the mapped-capable staging buffer via `updateGraphicsStorage`, then maps it for host-side readback verification. (7) `data-device-status` starts as `"active"`, transitions to `"lost"` on loss, and never shows uninitialized state. (8) Transform contract documented: 32 floats, model first (bytes 0-63), view-projection second (bytes 64-127), column-major. (9) No Three.js: `grep -R -i -E 'three(\\.js)?' dist/` returns nothing. `window.THREE` is undefined in the page context. (10) `tests/run.sh` passes. |
| `validation` | ```sh\n# Full build (prebuilt binary, matches tests/run.sh)\nFABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"\n"$FABER_BIN" build --package .\n# No Three.js\ngrep -R -i -E 'three(\\.js)?' dist/ || true\n# Transform contract documented\ngrep -q 'TransformPayload' triga/src/triga.fab\n# Product manifest references all artifacts\ncat dist/product.json | python3 -c "import json,sys; m=json.load(sys.stdin); assert m['version']==1; print('manifest ok')"\n# Browser checks (requires WebGPU-capable browser):\n# 1. Load page → .drift-status not 'simulation-pending'\n# 2. data-device-status === 'active'\n# 3. After 2 frames, map transform buffer directly (GPUBufferUsage.MAP_READ) → different values\n# 4. Resize window → canvas dimensions update, frame count continues\n# 5. Force device.destroy() → data-device-status === 'lost', no console errors\n# 6. window.THREE === undefined\n# Full test suite\n./tests/run.sh\n``` |
| `depends_on` | `u1-product-page-canvas-host-loading`, `u3-canonical-host-storage-update` |
| `non_goals` | Do not upload geometry to GPU. Do not create a graphics or compute pipeline (Stage 1 readback uses direct mapped-buffer mapping). Do not construct a Triga SceneStore. Do not implement collision or driving changes — only transform computation from existing vehicle/camera state. Do not add new Faber syntax or annotations. Do not add a WGSL shader authored for this stage. |
| `risk` | medium — integration unit. The transform computation from existing vehicle/camera facts is deterministic but requires correct matrix construction. Device loss handling in the browser requires testing with a real WebGPU device (Chrome Canary or equivalent). The readback proof uses direct mapped-buffer mapping (`GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST`) with `buffer.mapAsync`, which is a standard WebGPU pattern. |

---

## Checkpoints and gates

| After | Checkpoint |
| --- | --- |
| U1 + U3 | Product page loads controller. Host API (`updateGraphicsStorage`) confirmed and passes check harness. |
| U2 | `product.json` emitted and valid. All artifacts referenced. |
| U4 | End-to-end: controller → `updateGraphicsStorage` → GPU write → readback proof. Resize and device-loss lifecycle. No Three.js. |

**Stage gate (all units complete):**
1. `faber build --package .` succeeds.
2. `product.json` identifies page, ESM, and host runtime as same-build artifacts; `"stage": 1` and `"next_stage_artifacts": ["wgsl", "reflection"]` hint the Stage 2 extension.
3. Controller mounts and disposes with inspectable state.
4. A Faber-owned changing transform reaches the canonical host `updateGraphicsStorage` seam.
5. Two readback frames prove different transform values.
6. Resize replaces dependent resources without controller state loss.
7. Device loss produces `data-device-status="lost"` and cleanup.
8. No Three.js in `dist/` or `window.THREE`.

## Validation summary

| Criterion | Method | Unit |
| --- | --- | --- |
| Product manifest exists and is valid | Static check — `cat dist/product.json \| python3 -m json.tool` | U2 |
| Controller mounts | Browser check — `.drift-status` reflects live state | U1 |
| Controller disposes | Browser check — dispose clears subscriptions | U1 |
| Host runtime loaded | Static check — `test -f dist/public/faber-kernel.js` | U1 |
| `updateGraphicsStorage` exported | Static check — `grep` in host source; `node graphics-storage-update-check.mjs` (6/6 PASS) | U3 |
| Transform reaches GPU storage | Browser check — readback after 2 frames shows different values | U4 |
| Resize preserves controller | Browser check — frame count continues, vehicle position unchanged | U4 |
| Device loss bounded | Browser check — `data-device-status="lost"`, no uncaught errors | U4 |
| No Three.js | Static check — `grep` in `dist/`; runtime check — `window.THREE === undefined` | U1, U4 |
| Transform contract documented | Static check — comment in `triga/src/triga.fab` | U4 |
| Existing tests pass | `tests/run.sh` | U1, U4 |

## Open questions for Mind

All resolved by Mind decision (2026-07-26). Incorporated into this revision.

| # | Question | Decision | Applied |
| --- | --- | --- | --- |
| 1 | WGSL/reflection in Stage 1 product manifest | **Omit.** Add `"stage": 1` and `"next_stage_artifacts": ["wgsl", "reflection"]` so Stage 2 can extend without reformatting. | U2 done_when, validation, stage gate. |
| 2 | Readback proof method | **Direct mapped-buffer.** Use `GPUBufferUsage.MAP_READ \| GPUBufferUsage.COPY_DST`. No compute dispatch. | U4 done_when (6), validation, non_goals, risk. |
| 3 | Host runtime copy vs. symlink | **Copy into `public/`.** Self-contained products. | Already correct in spec; no change needed. |
| 4 | `host-init.js` location | **Static asset in `public/`.** Not generated. | Already correct in spec; no change needed. |

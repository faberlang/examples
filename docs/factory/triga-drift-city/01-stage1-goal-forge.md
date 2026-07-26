# Stage 1 — Goal Forge: Canonical Browser Product And Live Host Bridge

**Planner:** planner-1
**Campaign:** Triga Drift City
**Stage:** 1 of 6
**Date:** 2026-07-26
**Artifact kind:** P1 goal-forge
**Readiness label:** Ready for delivery

## Summary

Establish one canonical path from a generated Faber browser product to the
WebGPU host. The product mounts the drift-city controller with inspectable
success and failure state. A product manifest identifies the page, generated
ESM, host runtime, WGSL, and compiler reflection as one same-build artifact set.
A generic host dynamic-storage update bridges Faber-owned transforms into GPU
storage before a direct WebGPU frame executes. Resize replaces dependent
resources without losing the scene. Device loss produces a bounded error state
with cleanup. The admitted module graph contains no Three.js.

## Problem

The triga-drift-city framework publishes a deterministic driving simulation,
city state, collision facts, camera facts, and renderer-neutral scene facts
as DOM attributes. Its `@WebController` is admitted by a test fixture but is
not mounted by a complete browser product path. The actual gap is not the
controller itself—it is the absence of a live browser product that:

1. Mounts the controller in a real page with a WebGPU-capable canvas.
2. Loads the WebGPU host runtime with generated reflection and WGSL artifacts.
3. Routes Faber-owned transform facts to the host through a generic, direct
   (not DOM-attribute-scraping) update seam.
4. Creates and manages GPU resources from compiler reflection.
5. Runs a frame loop with resize and device-loss lifecycle.
6. Identifies all same-build artifacts under one product identity.

The hello-voxel campaign (Goals 01-03) established the source-to-WebGPU
pipeline, reflection-driven graphics host, and browser application runtime.
Goal 04 (indexed cube crossover) adds the first generic host dynamic-storage
update for transforms. But hello-voxel embeds its own voxel-meshing domain
that is not the drift-city application. The hello-voxel host integration path
is app-specific (DOM attribute emission → JS host page that scrapes DOM attrs →
creates GPU resources). Stage 1 must establish a generic bridge that any
application controller can use without app-specific JavaScript host code.

### Current executable truth (grounded 2026-07-26)

| Layer | What exists | Stage 1 gap |
| --- | --- | --- |
| Controller | `triga_drift_city_controller` publishes frame/camera/vehicle/scene facts as `data-*` attrs. Fixture proves mount and keyboard delivery. | No live product page mounts it with a WebGPU canvas. |
| Product build | `faber build --package .` emits TypeScript, ESM, controllers.json, and copies pages/styles. | No product manifest linking all same-build artifacts. |
| Host runtime | `hosts/webgpu-browser` (`faber-kernel.js`, `webgpu-runtime.js`) admits compute and graphics pipelines. GPU resource create/dispatch lifecycle. | No public `updateStorage(resourceIndex, data)` seam. Existing `placementCopyIn` accepts resourceIndex+data but requires internal resource session—no named public API. |
| Triga transforms | `TransformPayload` (32 floats: 16 model + 16 view-projection). `transform_payload`, `transform_payload_byte_count`, typed accessors exist. | Transform data routes through DOM attrs (hello-voxel pattern) rather than a direct JS host call. |
| Scene store | `scene.fab` has `SceneStore`, `SceneHandle`, `ResourceHandle`, `ResourceTransition`, `SceneMeshDrawPacket`. | Not consumed by any host bridge; the drift-city app does not yet construct a scene store. |
| Frame/resize | `dom.on_frame` and `dom.on_resize` subscriptions exist and are proven in hello-voxel. Generated ESM exports `mountControllers` with dispose. | Drift-city controller does not yet emit resize facts or handle canvas resize. |
| Device loss | No handling anywhere. | Must produce bounded error + cleanup state. |
| Three.js | Not imported in any current drift-city source. | Must remain absent in all Stage 1 output. |

### Contradiction check

No live source contradicts any campaign claim. The `faber-kernel.js`
`loadFaberGraphicsPipeline` admits vertex+fragment pipelines with vertex inputs,
buffer layouts, bind groups, and draw manifests—exactly the contract the campaign
predicts. The `webgpu-runtime.js` `placementCopyIn` already writes host data to
named device buffers by resource index. The gap is packaging these into a
public, application-generic host API that a generated controller can call
directly.

One material observation: the hello-voxel host proof (`scripta/hv04c-host-proof-app.js`)
scrapes DOM attributes to build GPU resources. Stage 1 must replace that pattern
with a direct JS API call. The drift-city controller must call
`updateStorage(resourceIndex, data)` rather than emitting `data-hv-transform`
attributes for a separate host script to consume.

## Goals

1. **Controller mount and dispose**: The generated product page mounts the
   drift-city controller. Mount produces a success record; unmount (dispose)
   cleans up subscriptions and reports an inspectable disposed state. Mount
   failure produces a bounded error record (selector mismatch, missing DOM,
   etc.).

2. **Product identity manifest**: One `product.json` manifest (or equivalent
   recorded field on the existing `assets.json`) identifies the page, generated
   ESM entry, host runtime, WGSL, and compiler reflection as artifacts of the
   same build. An artifact-identity check (sha256 or equivalent) proves that the
   served page references the build that produced it.

3. **Canonical transform contract**: Freeze the per-object transform contract as
   a generic retained model transform: 32 floats = 16 model matrix (column-major)
   + 16 view-projection matrix (column-major). This is the existing
   `triga::TransformPayload`. The contract is consumed bidirectionally: Faber
   publishes it through the controller, the host receives it through a generic
   `updateStorage` call. Not per-frame car vertex baking. Not DOM-prefix-specific
   host code. No host-side matrix or scene policy.

4. **Generic host dynamic storage-buffer update**: The host exposes a named
   public operation `updateStorageBuffer(resourceIndex, Float32Array)` that writes
   data to a reflection-declared GPU storage buffer. The operation validates
   buffer existence, byte-size match, and resource index. It does not parse
   field names, infer layouts from DOM, or depend on application-specific
   knowledge of what the data means.

5. **Frame, resize, and device-loss lifecycle**: A browser frame loop uses
   `requestAnimationFrame`. Each frame: the controller advances Faber state,
   computes the next transform, calls the host update, and the host submits a
   WebGPU render pass (or compute dispatch if no graphics pipeline is available
   yet—the gate requires "before a direct WebGPU frame," not a visible render).
   Resize replaces the canvas context (swap chain) without restarting the
   controller or losing scene state. Device loss catches the `uncapturederror`
   event or `device.lost` promise, cleans up GPU resources, and sets an
   inspectable `data-device-status` attribute to `lost`.

6. **No Three.js**: The admitted module graph (generated ESM, host runtime, page
   scripts) contains no import of Three.js or any third-party renderer. A
   build-time check (grep) and runtime check (`window.THREE` absence) verify this.

## Non-goals

- Rendering a visible scene (Stage 2+). The gate explicitly requires "a
  Faber-owned changing transform reaches a generic host update before a direct
  WebGPU frame"—not visible pixels.
- Uploading geometry to the GPU. Transform-only. Geometry upload is Stage 2.
- Constructing a Triga `SceneStore` in the drift-city controller. The current
  app uses raw Box3 facts, not a scene graph. Scene-store adoption is a Stage 2
  concern.
- Per-frame car vertex baking. The transform contract is a retained 32-float
  model+view-projection payload, recomputed each frame, not baked into vertex
  buffers.
- Engine abstractions, registries, editors, generalized physics systems.
- External asset acquisition.
- Host-side scene graph reconstruction, material decisions, or draw policy.
- A second accepted renderer path. The direct host API is the only path.

## Ground truth researched

| File | What it proves |
| --- | --- |
| `examples/triga-drift-city/src/main.fab` | Controller publishes frame, vehicle, camera, and scene facts as `data-*` attrs. Uses `@WebController` annotation. `dom.on_frame` drives the game loop. Mount and keyboard delivery are tested by the fixture. |
| `examples/triga-drift-city/src/city.fab` | City circuit, road/building Box3 values, collision queries, scene facts. |
| `examples/triga-drift-city/src/vehicle.fab` | Deterministic vehicle dynamics, frame clamping, drift, collision response, chase camera. |
| `examples/triga-drift-city/faber.toml` | `kind = "browser-app"` product. `templates = "pages"`, `styles = "styles"`. |
| `examples/triga-drift-city/pages/index.html` | Existing page with `#triga-drift-city` root, `.drift-status` and `.drift-facts` elements. No canvas. |
| `examples/triga-drift-city/tests/browser-fixture-test.mjs` | Fixture proves mount, keyboard delivery, frame advancement, blur revoke, and dispose. Uses `FakeElement`/`FakeEvent`. |
| `examples/triga-drift-city/tests/run.sh` | Full build pipeline: `faber check`, `faber run --compile` for fact programs, `faber build --package .`, controller manifest check, Three.js grep, fixture run. |
| `examples/docs/factory/triga-drift-city/00-application-foundation-delivery.md` | Completed foundation. Deferred gate: "connect this package's Triga scene and per-frame transform facts to the canonical reflection-driven WebGPU graphics host." |
| `triga/src/triga.fab` | `TransformPayload` (32-float model+view-projection). `transform_payload`, `transform_payload_byte_count`, typed accessors. `Matrix4` column-major representation. `matrix4_identitas`, `matrix4_perspectiva`, `matrix4_conspectus`, `matrix4_multiplicata`. |
| `triga/src/geometry.fab` | `BufferGeometry` with attribute layouts, indexed draw commands. Not needed by Stage 1 (no geometry upload). |
| `triga/src/scene.fab` | `SceneStore`, `ResourceHandle`, `ResourceTransition`, draw packets. Not needed by Stage 1 (no scene graph). |
| `hosts/webgpu-browser/public/src/faber-kernel.js` | `loadFaberGraphicsPipeline` admits vertex+fragment pipelines from reflection. `loadFaberKernel` for compute. Parses vertex inputs, buffer layouts, bind groups, draw manifests. |
| `hosts/webgpu-browser/public/src/webgpu-runtime.js` | `placementCopyIn(device, resources, {resourceIndex, data})` writes host data to device buffer. `placementDispatch`, `placementReadback`. `buildChainFromReflection` creates multi-kernel chains. `applyComputeResourceReplace` manages resource lifecycle with create-before-retire. |
| `faber-web/src/web.fab` | `@WebController` annotation contract with `selector` field. `Mount` and `selector_of`. |
| `faber-web/src/dom.fab` | Full DOM contract: `Scope`, `Element`, `FrameState`, `ResizeState`, `KeyboardState`, `FocusState`, `PointerLockState`, `Subscription`. Event subscriptions: `on_frame`, `on_resize`, `on_keyboard`, `on_pointer`, `on_focus`, `on_pointer_lock`. |
| `faber/src/package/product.rs` | `build_browser_product` discovers `WebController` functions, emits TypeScript, invokes `tsc`, writes `controllers.json`. `BrowserController` struct with `name`, `selector`, `module`, `export`. Emits `assets.json` with sha256 for static assets. Does not yet emit a product manifest linking generated ESM and host artifacts. |
| `examples/hello-voxel/src/main.fab` | Full controller with frame/resize/keyboard/pointer/focus/pointer-lock + geometry emission. Proof that the controller lifecycle works at scale. |
| `examples/hello-voxel/pages/index.html` | Canvas element (`<canvas class="hv-canvas">`). Pattern for product page with render target. |
| `triga/docs/factory/hello-voxel/CAMPAIGN.md` | Goal 04 (indexed cube crossover) adds first generic dynamic-storage update. Provides the pattern Stage 1 must adopt. |

## Constraints and invariants

1. **Faber owns simulation and scene decisions.** The controller computes the
   transform (model + view-projection) each frame. JavaScript transports it; it
   does not derive or modify it.
2. **Host consumes reflection, not DOM field names.** The host reads resource
   indices and buffer layouts from compiler reflection. It never parses
   `data-*` attributes to infer buffer layouts or resource identity.
3. **Generic bridge, not app-specific.** The `updateStorageBuffer` API accepts
   `(resourceIndex, Float32Array)`. It has no knowledge of "transform", "camera",
   "car", or "city". The controller decides what to upload; the host decides
   where to write it.
4. **Same-build identity.** Every artifact in the product page (page HTML,
   generated ESM, host runtime JS, WGSL, reflection JSON, controllers.json,
   stored assets) can be traced to the same `faber build` invocation.
5. **No Three.js in admitted module graph.** Verified by build-time grep and
   runtime `window.THREE` check.
6. **Resize does not lose the scene.** Canvas resize replaces the WebGPU swap
   chain (current texture, depth texture, view) without restarting the
   controller or re-running the bootstrap logic.
7. **Device loss is bounded.** On device loss, all GPU resources are marked
   lost, the frame loop stops, an inspectable error attribute is set, and no
   unhandled promise rejection or uncategorized error propagates to the console.

## Architecture direction

### Controller → host bridge

```
┌──────────────────────────────────────┐
│ Faber controller (generated ESM)     │
│                                      │
│  frame callback:                     │
│    app ← step(dt)                    │
│    transform ← payload(app)          │
│    host.updateStorageBuffer(0, data) │ ← generic, named API
│    host.submitFrame()                │
│                                      │
│  resize callback:                    │
│    host.resize(width, height, dpr)   │
│                                      │
│  dispose:                            │
│    host.destroy()                    │
│    subscriptions.unsubscribe()       │
└──────────────┬───────────────────────┘
               │ direct JS call (not DOM attr scrape)
┌──────────────▼───────────────────────┐
│ Host runtime (webgpu-runtime.js)     │
│                                      │
│  updateStorageBuffer(idx, data):     │
│    device.queue.writeBuffer(         │
│      buffers.get(idx).buffer,        │
│      0, data                         │
│    )                                 │
│                                      │
│  submitFrame():                      │
│    encoder = device.createCE()       │
│    pass = encoder.beginComputePass() │
│    pass.setPipeline(pipeline)        │
│    pass.setBindGroup(...)            │
│    pass.dispatch(...)                │
│    pass.end()                        │
│    device.queue.submit([finish])     │
│                                      │
│  resize(w, h, dpr):                  │
│    ctx.configure({width, height})    │
│    // depth texture recreation       │
│                                      │
│  destroy():                          │
│    // cancel frame loop              │
│    // destroy all buffers            │
│    // lost device detection          │
└──────────────────────────────────────┘
```

### Product identity

The `faber build` pipeline already emits `assets.json` with sha256 for static
assets. It also emits `controllers.json` with controller metadata. The gap is
a manifest that includes generated artifacts (ESM, controllers.json itself,
and—when the host runtime is copied as a public asset—the host JS files). The
manifest serves two purposes: same-build identity proof and asset-loading
reference for the page (so the `<script>` tags know the correct paths).

### Transform contract

Frozen as the existing `triga::TransformPayload`: 32 floats, 128 bytes.

```
bytes 0-63:    model matrix (16 × f32, column-major)
bytes 64-127:  view-projection matrix (16 × f32, column-major)
```

The host declares one read-only storage buffer for the transform. The
reflection maps a resource index to that buffer. The controller computes the
payload each frame and calls `updateStorageBuffer(resourceIndex, payload)`.

No per-frame car vertex baking. No DOM prefix in the host API. The host does
not know the data is a "transform"—it sees a resource index and raw bytes.

## Implementation shape (rough first milestone)

1. Add a WebGPU-capable `<canvas>` to the drift-city product page.
2. Copy the host runtime (`faber-kernel.js`, `webgpu-runtime.js`) into the
   product's `public/` directory as static assets.
3. Emit a product manifest (`product.json`) during `faber build` that identifies
   page, ESM, host runtime, reflection, and WGSL artifacts with sha256.
4. Add `updateStorageBuffer(resourceIndex, Float32Array)` as a public named
   export from the host runtime.
5. Write a bootstrap script (`host-init.js`) that loads the host runtime,
   creates a WebGPU device, and exposes the host API to the controller.
6. Update the drift-city controller to call `updateStorageBuffer` with the
   32-float transform payload each frame.
7. Handle resize by reconfiguring the canvas context.
8. Handle device loss with a try/catch and `device.lost` promise.
9. Verify: two frames produce different stored transform values. Resize
   preserves the controller state. Device loss produces a bounded error. No
   Three.js detected.

## Release posture

Not a release. Stage 1 is a structural bridge. The product page is a
development checkpoint; it does not ship to users.

## Exit strategy

If the host bridge API shape proves wrong during implementation, revert to a
revised delivery spec. The transform contract is frozen at this spec level;
changing it requires a new delivery spec, not a live refactor.

## Acceptance criteria

1. `faber build --package .` succeeds in `examples/triga-drift-city/`.
2. Generated `product.json` lists ESM entry, host runtime, controllers.json,
   and all static assets with sha256.
3. Loading the product page in a WebGPU-capable browser:
   a. Mounts the drift-city controller (`.drift-status` → `simulation-ready-*`
      or a host-specific status).
   b. Creates a WebGPU device.
   c. Creates at least one storage buffer for the transform.
   d. On each frame, the controller calls `updateStorageBuffer` with the
      transform payload.
4. Reading back the storage buffer after two frames proves the transform data
   changed (different position/heading values).
5. Resizing the browser window reconfigures the canvas without resetting the
   controller state (frame count continues, vehicle position does not reset).
6. Simulating device loss (via `device.destroy()` or a controlled
   `uncapturederror`) sets `data-device-status="lost"` and stops the frame
   loop without an uncaught error.
7. `grep -ri three examples/triga-drift-city/dist/` returns no matches.
8. `tests/run.sh` passes (existing checks + new stage checks).
9. The admission test imports `updateStorageBuffer` from the host runtime and
   verifies it writes data to a named buffer.

## Validation

```sh
# Existing framework checks
cd examples/triga-drift-city
./tests/run.sh

# Stage 1 additions (to be added to run.sh):
# - Check product.json exists and has expected sha256
# - Check the page loads and creates a WebGPU device (requires browser)
# - Check no Three.js in dist/
grep -R -i -E 'three(\.js)?' dist/ || true
# - Check host runtime files are copied to dist/public/
test -f dist/public/faber-kernel.js
test -f dist/public/webgpu-runtime.js
# - Check transform update through storage buffer (requires WebGPU browser harness)
```

## Open questions

1. **How should the host runtime be located by the product page?** Default:
   copy `hosts/webgpu-browser/public/src/` into `triga-drift-city/public/` as
   static assets. The page loads them as `<script type="module">` imports.
   Alternative: reference them from `hosts/` via a relative path in the
   generated page. Rejected: the product must be self-contained; copying is
   simpler and matches the existing static-asset model.

2. **Does the host need a full graphics pipeline or just a compute dispatch for
   Stage 1?** The gate requires "a direct WebGPU frame"—not a visible render.
   A compute dispatch that reads the transform storage buffer (for verification)
   is sufficient for Stage 1. The full graphics pipeline is Stage 2. Default:
   use a compute dispatch that writes the transform data to an output buffer for
   readback verification.

3. **Should the product manifest extend `assets.json` or be a separate
   `product.json`?** Default: separate `product.json` to avoid breaking
   existing `assets.json` consumers. The `product.json` references
   `assets.json` by path and sha256 rather than duplicating all asset entries.

4. **Does `faber build` need to know about the host runtime files?** Default:
   no. The host runtime files are copied as `public/` static assets by the
   existing static-asset pipeline. The product manifest just records their
   presence and sha256.

## Stop conditions

- Pause if the proposed host bridge API (`updateStorageBuffer`) cannot be
  implemented without guessing buffer layouts or resource indices from DOM.
- Pause if the `faber build` pipeline requires a new codegen target or language
  annotation to emit the product manifest.
- Pause if a live source in radix or hosts contradicts the assumption that
  reflection-declared storage buffers can be updated via `device.queue.writeBuffer`.
- Pause if device loss handling requires changes to `faber-web` contracts
  rather than host-side JS.

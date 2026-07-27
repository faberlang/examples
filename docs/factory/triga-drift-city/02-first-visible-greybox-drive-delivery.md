# Stage 2 — Delivery: First Visible Greybox Drive

**Planner:** planner-2
**Campaign:** Triga Drift City
**Stage:** 2 of 6
**Date:** 2026-07-27
**Artifact kind:** P3 delivery spec
**Unit count:** 5

## Interpreted unit

Lower Stage 2 into five ordered units. U1 discovers the graphics shader
pipeline (Faber → WGSL + reflection). U2 discovers the host integration
(load shader artifacts → create pipeline + resources → first render). U3
batches full scene geometry from city scene facts. U4 integrates the
keyboard drive loop with continuous visible rendering. U5 extends
`faber build` to compile shader source and include WGSL + reflection in the
product manifest. U1–U3 are parallel once U1 produces a reference shader
binary. U4 gates on U1 + U2 + U3. U5 gates on U1 output format only.

## Normalized spec

One Faber graphics shader source (vertex + fragment) compiles through radix
into WGSL and reflection JSON. The host loads these artifacts, creates a
graphics pipeline with depth testing, accepts vertex/index buffers for the
greybox scene (roads, buildings, car), and executes a render loop each
frame. The controller generates scene geometry from city facts, uploads it
to the host once at startup, and updates the transform storage buffer each
frame for the car model matrix. The chase-camera view-projection is updated
per frame. A real browser visibly renders the scene with depth testing. A
deterministic keyboard sequence changes the visible car position. Collision
evidence shows no structure penetration. Reset restores spawn state. Resize
preserves a correctly projected visible scene. Before/after pixel evidence
and submit evidence share the product identity. JavaScript owns transport
and WebGPU lifecycle only.

## Repo-aware baseline

| Repo | Existing seam | Stage 2 touch |
| --- | --- | --- |
| `examples/triga-drift-city/` | `@WebController` with frame/keyboard/resize/focus/blur, DOM attribute publishing, city/vehicle source, `public/host-init.js` with `updateGraphicsStorage` wiring, `pages/index.html` with canvas, `tests/run.sh` | Replace DOM publishing with geometry generation and host render loop; add shader source files (`src/shaders/`); host-init.js carries render pipeline setup + frame submit; tests gain visual-snapshot checks |
| `triga/` | `triga::TransformPayload`, `geometry::BufferGeometry` (indexed triangle geometry), `geometry::geometry_vertex_payload_byte_count`, `scene::SceneStore` + `scene_visible_mesh_draw_packets`, `triga::matrix4_*` for model/view-projection | Use existing geometry/scene/transform contracts. No source changes to triga unless a reusable geometry helper is missing |
| `radix/` | `MirGraphicsPipelineReflection`, `MirKernelShaderStage::Vertex` + `MirKernelShaderStage::Fragment`, WGSL codegen, graphics-pipeline ABI validation, `MirVertexInputReflection` + `MirFragmentOutputReflection` | Compile Faber vertex+fragment shaders. Produce WGSL + reflection JSON. No radix source changes unless shader validation blocks a required contract |
| `hosts/webgpu-browser/` | `createGraphicsResources(device, descriptor, payloads, canvasContext)` → pipeline + depth + vertex/index buffers + bind groups, `runGraphicsFrame(device, context, resources, descriptor, frameState, options)` → render pass with clear + drawIndexed, `updateGraphicsStorage()` → storage buffer write, `replaceDepthTextureOnResize()`, `onDeviceLost()` | Consume WGSL + reflection as `descriptor` argument. Host source unchanged — all Stage 2 work is controller-side consumption of existing host APIs |
| `faber/` | `faber build --package .` emits `controllers.json`, `assets.json`, `product.json` (Stage 1). `product.json` has `"stage": 1`, `"next_stage_artifacts": ["wgsl", "reflection"]` | Extend build to run `radix compile` on shader source → emit `dist/generated/kernel.wgsl` + `dist/generated/reflection.json`. Update `product.json` to `"stage": 2`, remove `"next_stage_artifacts"` hint, add WGSL + reflection to `"artifacts"` array |

## Ordered unit graph

```
U1 (shader pipeline) ──┐
                       ├──► U4 (drive render loop)
U2 (host integration) ─┤
                       │
U3 (scene geometry) ───┘

U5 (faber build) — depends on U1 output format; parallel to U2–U4
```

U1, U2, and U3 are provably disjoint (different files in `examples`, no
shared write paths). U1 produces checked-in WGSL + reflection binary
artifacts as a reference; U2 and U3 consume them. U4 integrates all three
into the frameloop. U5 requires U1's shader source layout only.

---

### Unit 1 — Graphics Shader Pipeline

| Field | Value |
| --- | --- |
| `id` | `u1-graphics-shader-pipeline` |
| `outcome` | Faber vertex shader (`@nex`) and fragment shader (`@nment`) compile through radix into valid WGSL and graphics-pipeline reflection JSON. The vertex shader accepts a `@binding(0)` storage buffer (32 × f32 transform data) and per-vertex position+color attributes. The fragment shader outputs one color target. Depth comparison (`LessEqual`) and depth write are enabled. The compiler produces a single WGSL module with both entry points and a reflection document with `schema_version: 1`, `target: "wgsl-text"`, two kernels (vertex + fragment), one color target, and one depth/stencil state. Shader source lives in `examples/triga-drift-city/src/shaders/`. |
| `write_scope` | `examples/triga-drift-city/src/shaders/` (new directory: vertex and fragment Faber source), `examples/triga-drift-city/src/shaders/test-data/` (reference compiled output for tests), `examples/triga-drift-city/faber.toml` (shader compilation config if needed), `examples/triga-drift-city/tests/run.sh` (add shader compile + validation checks) |
| `read_scope` | `radix/crates/radix-mir/src/abi.rs` (graphics pipeline reflection, `MirKernelShaderStage`, `MirVertexInputReflection`, `MirFragmentOutputReflection`), `radix/crates/radix-mir/src/lib.rs` (public API for invoking compiler), `triga/src/triga.fab` (`TransformPayload` binding index semantics), `hosts/webgpu-browser/public/src/faber-kernel.js` (`loadFaberGraphicsPipeline` validation contracts), `hosts/webgpu-browser/public/src/webgpu-runtime.js` (`createGraphicsResources` — whatever pipeline descriptor shape it consumes) |
| `done_when` | (1) `src/shaders/greybox.fab` exists with a `@nex` (vertex) function and a `@nment` (fragment) function. The vertex function accepts a `BufferBinding<f32>` storage buffer parameter (binding 0) and vertex input parameters `position: Vector3` (location 0) + `color: Vector3` (location 1). It writes a `@nex_output position: Vector4` and `@nex_output color: Vector3`. The fragment function accepts the interpolated `color: Vector3` and outputs a single color attachment (location 0). (2) Radix compiles `greybox.fab` without errors. `radix compile --target wgsl src/shaders/greybox.fab --output dist/generated/` produces `dist/generated/kernel.wgsl` and `dist/generated/reflection.json`. (3) `kernel.wgsl` is valid WGSL text containing `@vertex` and `@fragment` entry points, a `@group(0) @binding(0) var<storage>` declaration, and `@location(0)` + `@location(1)` vertex inputs. (4) `reflection.json` is valid JSON with `"schema_version": 1`, `"target": "wgsl-text"`, `"kernels"` array of length 2 (one vertex, one fragment). The vertex entry has `"vertex_inputs"` with entries for locations 0 and 1. The fragment entry has `"fragment_outputs"` array. (5) `tests/run.sh` includes a new `test_shader_compile` check that runs radix and validates output. (6) Reference compiled output is checked into `src/shaders/test-data/` so U2 and tests can validate without requiring radix at runtime. |
| `validation` | ```sh\n# Compile shaders via radix\nradix compile --target wgsl src/shaders/greybox.fab --output dist/generated/\n# Verify WGSL output exists and contains vertex+fragment entry points\ntest -f dist/generated/kernel.wgsl\ngrep -q '@vertex' dist/generated/kernel.wgsl\ngrep -q '@fragment' dist/generated/kernel.wgsl\ngrep -q 'storage' dist/generated/kernel.wgsl\n# Verify reflection JSON\ntest -f dist/generated/reflection.json\npython3 -m json.tool dist/generated/reflection.json > /dev/null\npython3 -c "\nimport json\nr = json.load(open('dist/generated/reflection.json'))\nassert r['schema_version'] == 1\nassert r['target'] == 'wgsl-text'\nassert len(r['kernels']) == 2\nstages = [k['shader_stage'] for k in r['kernels']]\nassert 'vertex' in stages and 'fragment' in stages, f'want vertex+fragment, got {stages}'\nprint('reflection OK')\n"\n# Full test suite\n./tests/run.sh\n``` |
| `depends_on` | none |
| `non_goals` | Do not write host-side rendering code. Do not generate geometry. Do not modify the controller's frame loop — only shader source. Do not change radix source. Do not create Triga geometry types. The compiled output is a standalone artifact checked into test-data/; U2–U5 consume it. |
| `risk` | medium — discovery unit. This is the first graphics (vertex+fragment) shader authored for Drift City. The `@nex`/`@nment` annotation syntax, binding group layout, and color-target depth-stencil semantics must all be discovered from radix source and tested. Risk is bounded: if radix rejects a required contract, U1 surfaces it early before U2–U4 invest in host integration. |

---

### Unit 2 — Host Graphics Integration: First Render

| Field | Value |
| --- | --- |
| `id` | `u2-host-graphics-integration` |
| `outcome` | The product page loads U1's compiled WGSL and reflection, creates a graphics pipeline via `createGraphicsResources()`, uploads a small test geometry (one colored triangle or box), writes a transform payload via `updateGraphicsStorage()`, and executes `runGraphicsFrame()`. A real browser renders the triangle with depth testing enabled. Snap a pixel (or check computed output) to prove the pipeline produced non-clear output. The host code lives in `host-init.js` (extends the Stage 1 bootstrap) and a new `greybox-host.js` module. |
| `write_scope` | `examples/triga-drift-city/public/host-init.js` (extend: add `loadGreyboxPipeline()` + `initGreyboxRenderer()` exports), `examples/triga-drift-city/public/greybox-host.js` (new module: pipeline creation, geometry upload, frame render, transform update, resize, device-loss), `examples/triga-drift-city/public/` (copy U1 compiled WGSL/reflection test-data as fixture), `examples/triga-drift-city/tests/run.sh` (add render validation) |
| `read_scope` | `examples/triga-drift-city/public/host-init.js` (existing `initHost()`, `updateGraphicsStorage`, resize/device-loss handlers), `hosts/webgpu-browser/public/src/webgpu-runtime.js` (`createGraphicsResources`, `runGraphicsFrame`, `updateGraphicsStorage`, `replaceDepthTextureOnResize`, `onDeviceLost`), `hosts/webgpu-browser/public/src/faber-kernel.js` (`loadFaberGraphicsPipeline`, `fetchFaberKernelArtifacts`), `examples/triga-drift-city/src/shaders/test-data/` (U1 output: `kernel.wgsl`, `reflection.json`) |
| `done_when` | (1) `public/greybox-host.js` exports `loadGreyboxPipeline(device)` that fetches WGSL + reflection, calls `loadFaberGraphicsPipeline()`, and returns a frozen descriptor object with `{ wgsl, reflection }`. (2) `greybox-host.js` exports `initGreyboxRenderer(device, descriptor, canvasContext)` that calls `createGraphicsResources()` with a test geometry payload (vertex positions + colors, index data) and returns frozen `{ device, context, resources, descriptor }`. (3) `greybox-host.js` exports `renderGreyboxFrame(renderState)` that calls `runGraphicsFrame()` and produces a non-clear render. (4) `greybox-host.js` exports `updateGreyboxTransform(renderState, modelData, viewProjData)` that writes model (16 floats) and view-projection (16 floats) to the correct storage buffer resource indices via `updateGraphicsStorage()`. (5) A standalone test page or script loads the pipeline, creates resources, and renders one frame. Pixel readback (via `copyExternalImageToTexture` or canvas `toDataURL`) proves non-clear output. (6) The WGSL and reflection are loaded from `public/` static assets (copied from U1 test-data). No runtime dependency on radix. (7) `tests/run.sh` passes and copies U1 test-data into `public/` before build. |
| `validation` | ```sh\n# Copy U1 reference artifacts into public/\ncp src/shaders/test-data/kernel.wgsl public/\ncp src/shaders/test-data/reflection.json public/\n# Build product\nFABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"\n"$FABER_BIN" build --package .\n# Verify host JS files exist and export expected functions\ngrep -q 'loadGreyboxPipeline' dist/public/greybox-host.js\ngrep -q 'initGreyboxRenderer' dist/public/greybox-host.js\ngrep -q 'renderGreyboxFrame' dist/public/greybox-host.js\ngrep -q 'updateGreyboxTransform' dist/public/greybox-host.js\ngrep -q 'loadFaberGraphicsPipeline' dist/public/greybox-host.js\ngrep -q 'createGraphicsResources' dist/public/greybox-host.js\ngrep -q 'runGraphicsFrame' dist/public/greybox-host.js\n# Verify pipeline can be loaded (requires Node with WebGPU mock or a browser)\n# Test: load pipeline, create resources, render frame, readback pixel\n# Browser check:\n# 1. Load product page → canvas renders non-black pixel\n# 2. No WebGPU errors in console\n# 3. window.THREE === undefined\n# Full test suite\n./tests/run.sh\n``` |
| `depends_on` | `u1-graphics-shader-pipeline` (output artifacts: `kernel.wgsl`, `reflection.json`) |
| `non_goals` | Do not generate the full city scene geometry — that is U3. Do not modify the controller `src/main.fab` — U2 is host-side only. Do not add a frame loop that calls the controller — that is U4. Do not create Triga geometry or scene types in JS — U2 uses hand-crafted test geometry. Do not change `hosts/webgpu-browser/` source. |
| `risk` | medium — discovery unit. The `createGraphicsResources` API and its `descriptor` shape must be validated against live source. The host runtime may require a specific descriptor format (bind group layout naming, vertex buffer layout, index format) that U1's reflection must match. If the pipeline creation fails, U1's shader code or reflection output may need adjustment. |

---

### Unit 3 — Scene Geometry Assembly

| Field | Value |
| --- | --- |
| `id` | `u3-scene-geometry-assembly` |
| `outcome` | Faber functions generate Triga `BufferGeometry` instances for the complete greybox scene: 4 road segments (flat boxes), 5 buildings, and 1 car box. Each piece produces vertex positions (3 × f32), vertex colors (3 × f32, unique per-object so building vs road vs car are visually distinct), and index data. The geometry functions produce flattened payload arrays suitable for `host→createGraphicsResources()`. A `SceneGeometryManifest` record lists each object's vertex count, index count, color, and spatial bounds. The colored vertex data replaces DOM-attribute publishing of scene facts. |
| `write_scope` | `examples/triga-drift-city/src/geometry.fab` (new file: box geometry generation from Box3, color assignment, payload flattening), `examples/triga-drift-city/src/scene.fab` (new file: assemble full scene geometry from city facts, produce SceneGeometryManifest), `examples/triga-drift-city/tests/run.sh` (add geometry validation checks) |
| `read_scope` | `examples/triga-drift-city/src/city.fab` (City type, road/building Box3 lists, car box), `examples/triga-drift-city/src/vehicle.fab` (spawn position, vehicle box), `triga/src/geometry.fab` (`BufferGeometry`, `indexed_triangle_geometry`, `VertexAttributeLayout`, `VertexFormat`, `geometry_vertex_payload_byte_count`, `geometry_index_payload_byte_count`), `triga/src/triga.fab` (Vector3, Box3, box3 dimensions), `hosts/webgpu-browser/public/src/webgpu-runtime.js` (`createGraphicsResources` payload shape: `{ storageData, vertexBuffers, indexData }`) |
| `done_when` | (1) `src/geometry.fab` exports `box_geometry(de Box3 bounds, Vector3 color) → BufferGeometry ∪ nihil` that produces indexed triangle geometry for a colored box (8 vertices, 36 indices for 12 triangles, 2 triangles per face × 6 faces). (2) `src/scene.fab` exports `greybox_scene_geometry(de City city, de Box3 car_box) → SceneGeometryManifest` that assembles geometry for all roads, buildings, and the car. Each object has a distinct color (e.g., roads gray, buildings dark gray, car red). (3) `SceneGeometryManifest` records: `objects: lista<SceneObjectGeometry>` where each entry has `name`, `vertex_count`, `index_count`, `vertex_byte_count`, `index_byte_count`, `vertex_payload` (flattened f32 array), `index_payload` (flattened u32 array), `color`, and `bounds`. (4) Geometry payload byte counts match: `vertex_byte_count = vertex_count × 6 × 4` (3 position + 3 color × 4 bytes/f32). (5) `tests/run.sh` validates: vertex count per box = 24 (4 unique vertices per face × 6 faces for indexed drawing — or 8 unique vertices + index reuse; accept either as long as indexed_triangle_geometry produces valid indexed output), total objects = 10 (4 roads + 5 buildings + 1 car), total vertex byte count and index byte count are within expected bounds. (6) Existing `tests/run.sh` still passes (framework checks unchanged). |
| `validation` | ```sh\n# Compile geometry facts (existing pipeline)\nFABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"\n"$FABER_BIN" check\n# Run compiled geometry validation\n# Check: box_geometry produces valid indexed geometry\n"$FABER_BIN" run --compile src/geometry.fab -- 'box_geometry'\n# Check: greybox_scene_geometry produces manifest with 10 objects\n"$FABER_BIN" run --compile src/scene.fab -- 'greybox_scene_geometry'\n# Verify payload byte counts are nonzero\n# Verify color assignment produces distinct colors per object type\n# Full test suite\n./tests/run.sh\n``` |
| `depends_on` | `u1-graphics-shader-pipeline` (vertex format contract: location 0 = position vec3, location 1 = color vec3) |
| `non_goals` | Do not upload geometry to GPU — that is U4. Do not modify the controller's frame loop. Do not add texture coordinates, normals, or material metadata to vertices — position + color only (greybox). Do not implement frustum culling or scene graph traversal. Do not change triga source. Do not generate per-frame geometry — scene geometry is static and generated once. |
| `risk` | low — mechanical geometry generation from known Box3 data. The `box_geometry` function is a deterministic mapping from box corners to indexed triangles. The existing Triga `indexed_triangle_geometry` function already produces `BufferGeometry` with correct attribute layout. The main risk is that U1's vertex format (location order) must match; U1 defines the contract first, U3 follows it. |

---

### Unit 4 — Application Integration: Drive Render Loop

| Field | Value |
| --- | --- |
| `id` | `u4-application-drive-render-loop` |
| `outcome` | The drift-city controller replaces DOM attribute publishing with a real WebGPU render loop. On mount: generate scene geometry (U3), create host renderer (U2), upload geometry buffers. Each frame: step vehicle simulation, compute model matrix for car + view-projection for chase camera, call `updateGraphicsStorage()` with combined 32-float transform payload, call `runGraphicsFrame()`. On resize: reconfigure canvas context, update aspect ratio, replace depth texture via `replaceDepthTextureOnResize()`. On device loss: set `data-device-status="lost"`, destroy resources, stop frame loop. On reset (key R): restore spawn state, re-upload car geometry (no other geometry changes). Keyboard driving produces visible car movement. Collision evidence: car stops at building boundaries rather than penetrating. A deterministic keyboard sequence (e.g., hold W for 3s, release, hold A for 1s) produces reproducible before/after pixel evidence. |
| `write_scope` | `examples/triga-drift-city/src/main.fab` (replace DOM publish functions with geometry upload + host render loop), `examples/triga-drift-city/public/host-init.js` (wire greybox-host into controller's host session), `examples/triga-drift-city/pages/index.html` (add reset key hint, status display), `examples/triga-drift-city/tests/run.sh` (add render-loop checks) |
| `read_scope` | `examples/triga-drift-city/src/main.fab` (existing controller with frame/keyboard/resize/focus/blur), `examples/triga-drift-city/src/vehicle.fab` (Application, step_application, spawn_application, chase_camera, ChaseCamera), `examples/triga-drift-city/src/city.fab` (City, drift_city, city_collides_box), `examples/triga-drift-city/src/geometry.fab` (U3: box_geometry, vertex/index payloads), `examples/triga-drift-city/src/scene.fab` (U3: greybox_scene_geometry, SceneGeometryManifest), `examples/triga-drift-city/public/greybox-host.js` (U2: loadGreyboxPipeline, initGreyboxRenderer, renderGreyboxFrame, updateGreyboxTransform), `triga/src/triga.fab` (`TransformPayload`, `transform_payload`, `transform_payload_byte_count`, `matrix4_*`), `hosts/webgpu-browser/public/src/webgpu-runtime.js` (`updateGraphicsStorage`, `runGraphicsFrame`, `replaceDepthTextureOnResize`, `onDeviceLost`, `createGraphicsResources`), `examples/triga-drift-city/pages/index.html` (existing canvas, `.drift-status`, `.drift-facts`) |
| `done_when` | (1) Controller mount generates geometry via U3 functions and uploads vertex/index buffers to the host via `createGraphicsResources()`. (2) Each frame: `step_application()` moves the car; `compute_frame_transform()` builds 32-float model+view-projection payload; `updateGraphicsStorage()` writes to the transform buffer. (3) `runGraphicsFrame()` executes the render pass. The canvas shows visible colored geometry. (4) Depth testing is observable: closer objects (buildings) occlude farther objects (far road). (5) Car movement is visible: holding W for several seconds moves car forward in the rendered view. Holding A while moving turns the car left. (6) Collision evidence: car stops at the boundary of a building box (no penetration). The visible pixel region shows the car pressed against the building surface without overlap. (7) Reset (key R): car returns to spawn position (-22, 0.2, 0), heading 0°, speed 0. (8) Resize: browser window resize preserves aspect ratio in view-projection; scene renders without distortion. Canvas context reconfigured via `replaceDepthTextureOnResize()`. (9) Device loss: `data-device-status="lost"`, frame loop stops, no uncaught errors. (10) DOM attributes `data-render-status`, `data-render-gate`, `data-simulation-owner` are set exactly once at mount. Frame-specific facts (`data-vehicle-*`, `data-camera-*`, `data-key-*`) are removed — the render loop is the canonical source of truth, not DOM scraping. (11) No Three.js in `dist/`. (12) `tests/run.sh` passes including new render-loop checks. |
| `validation` | ```sh\n# Build product\nFABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"\n"$FABER_BIN" build --package .\n# No Three.js\ngrep -R -i -E 'three(\\.js)?' dist/ || true\n# Verify host JS files are complete\ntest -f dist/public/host-init.js\ntest -f dist/public/greybox-host.js\ntest -f dist/public/faber-kernel.js\ntest -f dist/public/webgpu-runtime.js\ntest -f dist/public/kernel.wgsl\ntest -f dist/public/reflection.json\n# Browser checks (require WebGPU-capable browser):\n# 1. Load product page → colored geometry visible (not black canvas)\n# 2. Depth: building occludes road behind it\n# 3. Hold W 3s → car visibly moves forward in rendered view\n# 4. Drive into building → car stops at boundary, no penetration\n# 5. Press R → car resets to spawn position\n# 6. Resize window → canvas reconfigures, scene projection correct\n# 7. Force device.destroy() → status lost, no console errors\n# 8. window.THREE === undefined\n# Full test suite\n./tests/run.sh\n``` |
| `depends_on` | `u1-graphics-shader-pipeline`, `u2-host-graphics-integration`, `u3-scene-geometry-assembly` |
| `non_goals` | Do not implement HUD, drift feedback, textures, materials, or atmosphere — Stage 4+. Do not add dynamic geometry regeneration — car geometry is static and uploaded once. Do not implement instancing or batching beyond one draw call per object. Do not implement frustum culling (the full scene fits in view). Do not modify vehicle dynamics, collision logic, or camera behavior — only the presentation layer. Do not add audio, networking, or mobile controls. |
| `risk` | medium — integration unit. The main risks are: (a) the host `createGraphicsResources` payload format may require per-object resource lifecycle management that U2's simple test did not exercise; (b) geometry upload must map U3's `SceneGeometryManifest` to the host's expected vertex/index buffer format; (c) the combined transform payload (model + view-projection in one 32-float buffer) must match U1's shader binding layout. All three contracts are grounded in specific files; the integration risk is connecting them correctly. |

---

### Unit 5 — Product Build: Shader Artifact Compilation

| Field | Value |
| --- | --- |
| `id` | `u5-product-build-shader-artifacts` |
| `outcome` | `faber build --package .` automatically compiles `src/shaders/greybox.fab` via radix, writes `dist/generated/kernel.wgsl` and `dist/generated/reflection.json`, and emits `dist/product.json` with `"stage": 2`. The `"artifacts"` array includes `kernel.wgsl` and `reflection.json` with path, kind, size, and sha256. The `"next_stage_artifacts"` hint is removed (it was a Stage 1 extension hint, now realized). No manual copy step; the build is self-contained. |
| `write_scope` | `faber/src/package/product.rs` (extend `build_browser_product` to invoke radix and emit WGSL + reflection, update manifest to stage 2), `faber/Cargo.toml` (if new dependency needed), `examples/triga-drift-city/faber.toml` (shader source path config if needed), `examples/triga-drift-city/tests/run.sh` (add build-output validation) |
| `read_scope` | `faber/src/package/product.rs` (existing `BrowserProductBuild`, `emit_product_json`, `assets.json`/`controllers.json` emission), `faber/src/package/manifest.rs` (manifest struct), `examples/triga-drift-city/faber.toml` (package config), `examples/triga-drift-city/src/shaders/greybox.fab` (U1 shader source), `radix/crates/radix-codegen-wgsl/` (WGSL codegen entry point) |
| `done_when` | (1) `faber build --package .` produces `dist/generated/kernel.wgsl` and `dist/generated/reflection.json`. (2) `dist/product.json` has `"version": 1`, `"stage": 2`, no `"next_stage_artifacts"` field. (3) `"artifacts"` array includes entries for `kernel.wgsl` and `reflection.json` with `"path"`, `"kind"` (e.g., `"wgsl"`, `"reflection"`), `"size"`, and `"sha256"`. (4) WGSL and reflection are written to `dist/generated/` before the page and host assets are copied (so `public/` can reference them). (5) The prebuilt `faber` binary (`faber/target/debug/faber`) succeeds at producing Stage 2 output. The faber crate at `4acabab` does not compile (known baseline debt); U5 uses the prebuilt binary. (6) `tests/run.sh` validates: WGSL file exists and is non-empty, reflection JSON is valid with correct schema_version, product.json stage is 2, no `next_stage_artifacts`, WGSL + reflection in artifacts array. |
| `validation` | ```sh\n# Build product (prebuilt binary)\nFABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"\n"$FABER_BIN" build --package .\n# WGSL compiled and non-empty\ntest -f dist/generated/kernel.wgsl\ntest -s dist/generated/kernel.wgsl\ngrep -q '@vertex' dist/generated/kernel.wgsl\n# Reflection compiled\ntest -f dist/generated/reflection.json\npython3 -c "import json; r=json.load(open('dist/generated/reflection.json')); assert r['schema_version']==1"\n# Product manifest is stage 2\npython3 -c "\nimport json\np = json.load(open('dist/product.json'))\nassert p['stage'] == 2, f'want stage=2, got {p[\"stage\"]}'\nassert 'next_stage_artifacts' not in p, 'next_stage_artifacts must be removed'\nnames = [a['path'] for a in p['artifacts']]\nassert any('kernel.wgsl' in n for n in names), 'kernel.wgsl missing from artifacts'\nassert any('reflection.json' in n for n in names), 'reflection.json missing from artifacts'\nprint('manifest OK')\n"\n# Public assets include shader artifacts\ntest -f dist/public/kernel.wgsl\ntest -f dist/public/reflection.json\n# Full test suite\n./tests/run.sh\n``` |
| `depends_on` | `u1-graphics-shader-pipeline` (shader source location and radix compilation contract) |
| `non_goals` | Do not change the TypeScript emit pipeline. Do not add Hot Module Replacement or dev-server mode. Do not implement incremental compilation or caching — full recompile each build is acceptable at this stage. Do not check-in compiled artifacts to `dist/` — that directory is `.gitignore`-d. |
| `risk` | low — additive change to a known Rust file. The radix compiler must be invocable as a subprocess or library call from `faber build`. If radix does not expose a CLI interface, U5 writes a thin wrapper script or uses the radix library directly. The prebuilt binary constraint applies (same as Stage 1 U2). |

---

## Checkpoints and gates

| After | Checkpoint |
| --- | --- |
| U1 | Shader source compiles via radix. WGSL + reflection produced and validated. Checked into test-data/ as reference. |
| U2 | Host loads WGSL + reflection, creates pipeline, renders one colored triangle. Pixel readback proves non-clear output. |
| U3 | Scene geometry functions produce BufferGeometry for all 10 objects. Payload byte counts validated. |
| U4 | Full drive loop: keyboard → car movement → camera update → visible render. Collision, reset, resize, device-loss exercised. |
| U5 | `faber build` automatically compiles shaders. Product manifest reflects stage 2 with WGSL + reflection artifacts. |

**Stage gate (all units complete):**
1. `faber build --package .` succeeds and produces `dist/product.json` with `"stage": 2`.
2. `dist/generated/kernel.wgsl` and `dist/generated/reflection.json` are valid.
3. Loading the product page in a WebGPU-capable browser renders visible colored geometry (roads, buildings, car).
4. Depth testing is observable: buildings occlude far geometry.
5. Keyboard input (W/A/S/D) visibly moves the car and changes the rendered view.
6. Driving into a building stops the car without penetration (collision evidence visible).
7. Pressing R resets the car to spawn position (heading 0°, position -22, 0.2, 0).
8. Resize preserves correct scene projection.
9. Device loss produces `data-device-status="lost"` with cleanup.
10. No Three.js in `dist/` or `window.THREE`.

## Validation summary

| Criterion | Method | Unit |
| --- | --- | --- |
| Shader source compiles | Static — `radix compile` produces WGSL + reflection | U1 |
| WGSL is valid | Static — `grep` for `@vertex`, `@fragment`, `@binding` | U1 |
| Reflection is valid JSON | Static — `python3 -c` schema check | U1 |
| Host pipeline loads | Static — `grep` for exports in `greybox-host.js` | U2 |
| First pixel renders | Browser — non-clear canvas output | U2 |
| Scene geometry generated | Static — compile and validate vertex/index counts | U3 |
| Colored geometry visible | Browser — roads, buildings, car distinct colors | U4 |
| Depth testing works | Browser — near objects occlude far objects | U4 |
| Keyboard drive visible | Browser — key press changes car position in render | U4 |
| Collision visible | Browser — car stops at building boundary | U4 |
| Reset restores spawn | Browser — R key returns car to origin | U4 |
| Resize correct | Browser — window resize preserves projection | U4 |
| Device loss bounded | Browser — status lost, no errors | U4 |
| Product manifest stage 2 | Static — JSON field check | U5 |
| Build includes WGSL + reflection | Static — file existence + manifest entries | U5 |
| No Three.js | Static + runtime check | U4, U5 |
| Existing tests pass | `tests/run.sh` | U1, U2, U3, U4 |

## Open questions for Mind

All resolved by planner-2 during delivery research (2026-07-27). Incorporated into this revision.

| # | Question | Decision | Applied |
| --- | --- | --- | --- |
| 1 | Shader annotation syntax | `@nex` for vertex entry, `@nment` for fragment entry, matching radix MIR internal names. U1 discovers exact syntax from radix source. | U1 done_when. |
| 2 | Binding layout for transform storage | Group 0 binding 0: 32 × f32 storage buffer (model + view-projection). Single bind group with one storage buffer entry. Matches Stage 1 `updateGraphicsStorage` resource index 0. | U1 shader contract, U4 transform update. |
| 3 | Per-frame geometry vs static upload | Static upload at mount. Scene geometry (roads, buildings, car) does not change shape. Only the transform buffer is updated per frame. | U3 outcome, U4 done_when. |
| 4 | Object count: individual draw vs merged | Individual draw calls (one per object). 10 objects × 1 draw call each. Batching/merging deferred to Stage 3 when measured performance warrants. | U3 outcome (10 objects), U2 host integration (per-object resource lifecycle). |
| 5 | Color scheme for greybox | Roads: mid-gray (0.4, 0.4, 0.4). Buildings: dark gray (0.2, 0.2, 0.25). Car: red (0.8, 0.1, 0.1). Per-vertex color attribute, no textures. | U3 done_when. |
| 6 | Radix invocation from faber build | Prebuilt radix binary (`radix compile --target wgsl`). If no CLI exists, U5 writes a thin shell wrapper. Fallback: check-in shader artifacts and copy them; U5 automates the copy and manifest, not the compilation. | U5 done_when, risk note. |
| 7 | Camera aspect ratio source | Canvas element dimensions (`canvas.width / canvas.height`) each frame, same as Stage 1 U4 approach. | U4 done_when. |
| 8 | Transform payload layout | 32 floats: bytes 0–63 model matrix (column-major), bytes 64–127 view-projection matrix (column-major). Same as Stage 1 frozen contract. Shader reads as `array<f32, 32>` storage buffer, reconstructs `mat4x4<f32>` for each. | U1 shader code, U4 transform update. |

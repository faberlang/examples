# Stage 1 — Goal Check: Canonical Browser Product And Live Host Bridge

**Planner:** planner-1
**Goal path:** `01-stage1-goal-forge.md`
**Date:** 2026-07-26
**Artifact kind:** P2 goal-check

## Verdict: READY

## Evaluator mode

Planner goal-check. Intended consumer: delivery lowering → factory implementation.

## Reasoning

The goal forge defines a bounded, verifiable outcome: one generated browser
product that mounts the drift-city controller, writes a 32-float transform
payload through a generic host storage-buffer update, and handles frame/resize/
device-loss lifecycle. Every claim is grounded in live source. The architecture
direction (direct JS API call → host runtime, not DOM attribute scraping) is
consistent with the hello-voxel Goal 04 pattern. The implementation surface
touches four repos (examples, faber, hosts, triga) with clear ownership seams.
No architecture invention is required. A mid-tier implementer can start without
speculating about interfaces, resource layouts, or host behavior.

## Key points

### Desired end state — concrete
- Product page mounts controller → `.drift-status` reflects live state.
- `product.json` lists all same-build artifacts with sha256.
- Controller calls `host.updateStorageBuffer(0, transformData)` each frame.
- Two readback frames prove different transform values reached GPU storage.
- Resize reconfigures canvas context without controller restart.
- Device loss produces `data-device-status="lost"` and stops frame loop.
- `grep -ri three dist/` returns nothing.

### Grounding — all claims point to live files
- Transform contract: `triga/src/triga.fab` `TransformPayload`, 32-float model+view-projection.
- Controller: `examples/triga-drift-city/src/main.fab` — existing `@WebController`.
- Product build: `faber/src/package/product.rs` — existing `build_browser_product`, `assets.json`.
- Host runtime: `hosts/webgpu-browser/public/src/webgpu-runtime.js` — existing `placementCopyIn`.
- DOM contracts: `faber-web/src/dom.fab` — existing `on_frame`, `on_resize`, `on_focus`.

### Architecture decisions — settled
- **Transform contract**: Frozen as 32-float `TransformPayload`. Model (16) + view-projection (16), column-major. The host sees it as raw bytes at a resource index.
- **Controller→host bridge**: Direct JS API call (`updateStorageBuffer(resourceIndex, Float32Array)`), not DOM attribute scraping. The controller is the sole caller. The host is the sole GPU owner.
- **Product identity**: Separate `product.json` manifest (not extending `assets.json`). Lists generated ESM, controllers.json, host runtime, WGSL, reflection, and references `assets.json` by sha256.
- **Host runtime location**: Copied as `public/` static assets. Self-contained product.
- **Device loss**: Host-side JS only. No `faber-web` contract changes needed.

### Boundaries — clear
- **In**: controller mount/dispose, product manifest, generic storage-buffer update, frame/resize/device-loss lifecycle, no-Three.js check.
- **Out**: visible rendering, geometry upload, scene graph, materials, textures, host-side scene reconstruction.

### Acceptance criteria — objective
Every criterion maps to an automated or scripted check (see `01-stage1-goal-forge.md` acceptance criteria section). No criterion requires interpretation of visual output.

### Validation — practical
- Static checks: `faber build`, `tests/run.sh`, `grep` for Three.js, `product.json` schema validation.
- Host checks: import `updateStorageBuffer` and verify it writes data to a created buffer (Node test with mock device).
- Browser checks: load product page, verify mount/dispose status, verify transform readback across two frames, resize and verify frame count continuity, force device loss and verify error state.

### Implementation handoff — concrete starting path
- `examples/triga-drift-city/`: add canvas to `pages/index.html`, add host init script to `public/`, update controller to call host API.
- `faber/src/package/product.rs`: emit `product.json` after build.
- `hosts/webgpu-browser/public/src/webgpu-runtime.js`: export `updateStorageBuffer`.
- `triga/`: no source changes; contract reference only.

### Open questions — none blocking
The four open questions in the forge are answered with defaults. None require a decision before lowering.

### Staleness — dated (2026-07-26, revised per auditor-1)

All Triga, examples, faber-web, and hosts source claims verified against live tip on 2026-07-26. One known baseline exception:

- **`faber` crate at `4acabab`** does not compile (`cd faber && cargo test --no-run` → 20 errors on `FileFrontmatter` methods and `LoweredMirUnit.validation`). The prebuilt `faber/target/debug/faber` binary (Jul 26 07:02) works; `tests/run.sh` passes via prebuilt binary. P3 U2 validation uses the prebuilt binary, not `cargo test`. The faber compile baseline is a known debt outside Stage 1 scope.

No other obsolete references found.

## Blocking gaps: none

The goal is self-contained. No missing permission, tooling, or prerequisite goal blocks Stage 1 implementation.

## Recommended next step

Delivery lowering (P3). Produce an ordered unit graph with `write_scope`, `done_when`, `validation`, and `depends_on`. Target 4-5 executable units.

## Checks by category

| Category | Status | Notes |
| --- | --- | --- |
| Desired end state | PASS | Concrete, verifiable outcome per acceptance criteria |
| Grounding | PASS | Every claim has a live file path |
| Architecture decisions | PASS | Transform contract, bridge API, product identity, host location all settled |
| Boundaries | PASS | In/out explicitly enumerated; non-goals match campaign |
| Acceptance criteria | PASS | 9 objective criteria with validation commands |
| Validation | PASS | Static + host + browser checks; each criterion has a method |
| Implementation handoff | PASS | Starting paths per repo; no ambiguity about first touchpoint |
| Open questions | PASS | 4 questions, all answered with defaults; none blocking |
| Staleness | PASS (with note) | All claims verified 2026-07-26; faber crate compile baseline recorded |

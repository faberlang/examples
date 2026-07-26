# Stage 1 P2/P3 Audit Report

**Auditor:** auditor-1
**Assignment handle:** 9495407b
**Date:** 2026-07-26
**Artifact kind:** audit (P2 goal-check + P3 delivery spec)
**Repo state:** /Users/ianzepp/work/faberlang (multi-repo)

## Verdict: `residual`

No ship blocker. Five non-blocking findings: one stale-grounding architecture
gap, two infeasible validation commands, one baseline compile failure P3 did
not flag, and one under-specified U1/U3 coupling. P2/P3 are largely faithful to
live source and the campaign map; the residual issues are bounded and fixable
in a P3 revision or hand-off note, not a re-lowering.

## Repo grounding (dated vs live)

| Repo | Cited (dated) | Live HEAD | Source-relevant drift? |
| --- | --- | --- | --- |
| `examples` | `ee17e2a` + `df06d4b` | `df06d4b` | none — at cited tip |
| `triga` | `919c1d1` | `c73b92a` | no drift in `src/triga.fab` (drift only in hello-voxel docs) |
| `hosts` | `735df10` | `9cdd3c9` | **material** — `webgpu-runtime.js` gained `updateGraphicsStorage` + `graphics-storage-update-check.mjs` (106 + 512 lines) |
| `faber` | `4acabab` | `4acabab` | none at cited tip, but `cargo test` does not compile at this tip (baseline) |
| `faber-web` | `299616a` | `299616a` | none — at cited tip |
| `radix` | `eadb78cf0` | `a416791` | not re-grounded (not a Stage 1 participating repo unless a blocker surfaces — none did) |

## Coverage ledger

| Path/symbol | Lens | Callers/consumers | Validation | Disposition |
| --- | --- | --- | --- | --- |
| `triga/src/triga.fab` `TransformPayload` | grounding, architecture | transform_payload, transform_payload_byte_count, model/view-projection accessors | source read | reviewed — contract matches P3 |
| `examples/triga-drift-city/src/main.fab` | grounding, scope | @WebController #triga-drift-city, dom.on_frame/on_keyboard/on_focus | run.sh passes (25/0) | reviewed |
| `examples/triga-drift-city/pages/index.html` | grounding | #triga-drift-city, .drift-status, .drift-facts (no canvas) | source read | reviewed — canvas absent, U1 adds it |
| `examples/triga-drift-city/faber.toml` | grounding | kind=browser-app, public default "public" | source read | reviewed |
| `examples/triga-drift-city/tests/run.sh` | validation feasibility | faber check/run/build, fixture, three.js grep | run.sh passes | reviewed — baseline green |
| `hosts/webgpu-browser/public/src/webgpu-runtime.js` | architecture, disjointness | placementCopyIn, updateGraphicsStorage (NEW), no createHostSession | graphics-storage-update-check.mjs passes (6/6) | reviewed — U3 proposes competing seam |
| `hosts/webgpu-browser/public/src/faber-kernel.js` | grounding | FaberKernelContractError, loadFaberGraphicsPipeline | source read | reviewed |
| `faber/src/package/product.rs` | grounding, scope | build_browser_product, BrowserProductBuild, assets.json sha256 | source read | reviewed — product.json emission is additive |
| `faber/src/package/manifest.rs` | grounding | FaberManifest, ManifestProduct.public default "public" | source read | reviewed |
| `faber-web/src/dom.fab` | grounding | on_frame/on_resize/on_keyboard/on_focus, FrameState, ResizeState, Subscription | source read | reviewed |
| `faber-web/src/web.fab` | grounding | @WebController, Mount, selector_of | source read | reviewed |
| `examples/hello-voxel/pages/index.html` | grounding | `<canvas class="hv-canvas">` pattern | source read | reviewed — pattern exists |
| `examples/hello-voxel/scripta/hv04c-host-proof-app.js` | architecture | DOM-scrape host proof (pattern Stage 1 replaces) | source read | reviewed — P3 correctly avoids this pattern |

## Findings (P2 → P2)

### F1 — Stale grounding: P3 U3 proposes a competing host seam; live host already has `updateStorageBuffer` equivalent

- **severity:** P2
- **confidence:** confirmed
- **category:** architecture authority / scope match / campaign invariants
- **where:** P3 Unit 3 (`u3-generic-host-storage-buffer-update`), `write_scope` `hosts/webgpu-browser/public/src/webgpu-runtime.js`; live source `hosts/webgpu-browser/public/src/webgpu-runtime.js:1651` `updateGraphicsStorage`
- **expected:** P3 should re-ground against the live host. The campaign invariant (CAMPAIGN.md "Generic host seams" + dependency rule "no second accepted renderer path" + "no engine abstraction invention") forbids inventing a competing seam when a generic one exists.
- **actual:** P3 U3 was authored against the dated `hosts @ 735df10` observation, which predates `updateGraphicsStorage`. P3 proposes a new `updateStorageBuffer(resourceIndex, Float32Array)` + `createHostSession(device, bufferDeclarations)` public API. The live host at HEAD (`9cdd3c9`) already exports `updateGraphicsStorage(device, resources, descriptor, { resourceIndex, sourceName, data })` — a reflection-driven, app-agnostic storage update that validates resource index, role, byte bounds, and Float32Array type, then `device.queue.writeBuffer`. It is covered by `graphics-storage-update-check.mjs` (6/6 PASS). U3's `createHostSession(device, bufferDeclarations)` accepts caller-supplied buffer declarations, bypassing reflection — contradicting the campaign rule "The host consumes compiler reflection and declared artifacts."
- **impact:** Implementing U3 as written would create a second, competing, non-reflection host update seam in the same module that already exports the canonical one. This is the exact "second accepted path" the campaign forbids and a clean-break violation per `~/AGENTS.md`.
- **evidence:**
  - `git log --oneline 735df10..HEAD -- webgpu-browser/public/src/webgpu-runtime.js` shows 106 lines added.
  - `git show 735df10:webgpu-browser/public/src/webgpu-runtime.js | grep -c updateGraphicsStorage` = 0; at HEAD = present.
  - `node webgpu-browser/public/src/graphics-storage-update-check.mjs` → 6/6 PASS.
  - `webgpu-runtime.js:1651` `export function updateGraphicsStorage(...)`.
- **reproduction:** `cd hosts && node webgpu-browser/public/src/graphics-storage-update-check.mjs`
- **fix_direction:** Revise P3 U3 to consume the existing `updateGraphicsStorage` (reflection-driven) as the canonical host update seam, not invent `updateStorageBuffer`/`createHostSession`. If a session-level wrapper is still wanted, it must wrap `updateGraphicsStorage` and the existing `resources.storageBuffers` map, not replace them with a caller-supplied declaration map. Re-grounding U3 against HEAD also resolves the disjointness overlap (same file, competing exports).
- **suggested_owner:** planner-1 (P3 revision) before factory hand-off
- **done_when:** P3 U3 `write_scope` and `done_when` reference `updateGraphicsStorage` (or a thin session wrapper over it) and no longer propose a parallel `updateStorageBuffer`/`createHostSession` API; U3 validation imports `updateGraphicsStorage` and reuses `graphics-storage-update-check.mjs`.

### F2 — Infeasible validation: `cargo run -p faber` from `examples/triga-drift-city/` cannot find a workspace

- **severity:** P2
- **confidence:** confirmed
- **category:** validation feasibility
- **where:** P3 U1 `validation`, U2 `validation`, U4 `validation` — all contain `cd examples/triga-drift-city && cargo run -p faber -- build --package .`
- **expected:** Validation commands runnable as written (lens 4).
- **actual:** There is no `Cargo.toml` at `faberlang/`, `examples/`, or `examples/triga-drift-city/`. The `faber` workspace is self-contained at `faber/` (members: `.`, `crates/exempla`, `crates/hygiene-ratchet`). Running `cargo run -p faber` from `examples/triga-drift-city/` fails: `could not find Cargo.toml`. The existing `tests/run.sh` invokes the prebuilt `faber` binary directly (`FABER_BIN`), not `cargo run -p faber`.
- **impact:** All three units' primary build validation commands fail at the shell before any faber logic runs. An implementer following P3 verbatim will see a cargo error, not a faber build result.
- **evidence:**
  - `cd examples/triga-drift-city && cargo run -p faber -- build --package .` → exit 1, "could not find Cargo.toml".
  - `ls examples/Cargo.toml examples/triga-drift-city/Cargo.toml` → both absent.
  - `faber/Cargo.toml` workspace members do not include `examples`.
  - `tests/run.sh` uses `FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"`.
- **reproduction:** `cd examples/triga-drift-city && cargo run -p faber -- build --package .`
- **fix_direction:** Replace `cargo run -p faber -- build --package .` in U1/U2/U4 validation with the prebuilt-binary form `$WORKSPACE/faber/target/debug/faber build --package .` (matching `run.sh`), or with `cd faber && cargo run -p faber -- build --package <abs path>` and drop the `cd examples/triga-drift-city`. State which form is canonical.
- **suggested_owner:** planner-1 (P3 revision)
- **done_when:** Every `cargo run -p faber` in P3 validation either runs from `faber/` or is replaced by the `FABER_BIN` form, and the command succeeds end-to-end.

### F3 — Infeasible validation: U3 `node --import hosts/webgpu-browser/tests/register-hooks.mjs` references a non-existent path

- **severity:** P2
- **confidence:** confirmed
- **category:** validation feasibility
- **where:** P3 U3 `validation` — `node --import hosts/webgpu-browser/tests/register-hooks.mjs -e "..."`.
- **expected:** Validation commands runnable as written (lens 4).
- **actual:** `hosts/webgpu-browser/tests/` does not exist. The only `register-hooks.mjs` in the workspace is `examples/browser-app/tests/register-hooks.mjs`. The `hosts/webgpu-browser/` tree has no `tests/` directory; its check scripts live in `webgpu-browser/public/src/` (e.g. `graphics-storage-update-check.mjs`).
- **impact:** U3's Node smoke test cannot be run as written. An implementer will hit a missing-file error before exercising `updateStorageBuffer`.
- **evidence:**
  - `find hosts -name register-hooks.mjs` → no results.
  - `ls hosts/webgpu-browser/tests/` → "No such file or directory".
  - `find examples/browser-app -name register-hooks.mjs` → `browser-app/tests/register-hooks.mjs`.
- **reproduction:** `node --import hosts/webgpu-browser/tests/register-hooks.mjs -e "..."` from repo root.
- **fix_direction:** Point U3 validation at the actual harness. If F1 is resolved by consuming `updateGraphicsStorage`, reuse `hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` directly. Otherwise, reference `examples/browser-app/tests/register-hooks.mjs` or add a real `hosts/webgpu-browser/tests/` harness — but do not cite a path that does not exist.
- **suggested_owner:** planner-1 (P3 revision)
- **done_when:** U3 validation imports a harness path that exists and the command runs without a file-not-found error.

### F4 — Baseline: `cd faber && cargo test` does not compile at the cited revision `4acabab`

- **severity:** P2
- **confidence:** confirmed
- **category:** validation feasibility / grounding truth
- **where:** P3 U2 `validation` — `cd faber && cargo test`; P2 "Staleness — current" claims "All source claims verified against live tip on 2026-07-26."
- **expected:** P2 staleness check and P3 U2 validation commands should be runnable against the cited revision. Baseline failures should be flagged, not assumed green.
- **actual:** At `faber @ 4acabab` (the cited and current HEAD), `cargo build --lib` and `cargo test --no-run` fail with 20 compile errors (`E0599`, `E0609`, `E0061`, `E0308`) centered on `FileFrontmatter` methods, `LoweredMirUnit.validation` field, and argument-count mismatches. The prebuilt `faber/target/debug/faber` binary (built earlier, Jul 26 07:02) still works and `tests/run.sh` passes via that binary — but `cargo test` against current source does not compile. Working tree has only `Cargo.lock` modified (foreign dirt, class A — lockfile drift, not the cause).
- **impact:** P3 U2 validation `cd faber && cargo test` cannot pass at the cited revision. P2's "Staleness — PASS" overstates grounding: the faber crate at the cited tip is in a non-compiling state for its own tests, even though the binary works. An implementer adding `product.json` emission (U2) cannot run `cargo test` to verify existing tests pass.
- **evidence:**
  - `cd faber && cargo build --lib 2>&1 | grep -cE '^error'` → 21.
  - Sample errors: `no method named paths_source found for reference &FileFrontmatter`, `no field validation on type &LoweredMirUnit`.
  - `faber/target/debug/faber --version` → `faber 1.2.0` (prebuilt binary works).
  - `examples/triga-drift-city/tests/run.sh` → 25 passed, 0 failed (uses prebuilt binary).
  - `git status --short` in faber → only ` M Cargo.lock`.
- **reproduction:** `cd faber && cargo test --no-run`
- **fix_direction:** P2 should record the faber `cargo test` baseline failure in staleness/grounding. P3 U2 should either (a) state that U2 validation requires the faber crate to compile and gate on a prior fix, or (b) fall back to the prebuilt-binary validation plus a focused `product.json` unit test that does not require the whole crate to compile. This is a baseline-debt note, not a P3 invention.
- **suggested_owner:** planner-1 (P3 revision, staleness note); separate faber compile fix is out of Stage 1 scope unless it blocks U2.
- **done_when:** P2 staleness section records the faber `cargo test` baseline failure; P3 U2 validation either restores `cargo test` feasibility or specifies a fallback that does not depend on the whole crate compiling.

### F5 — Under-specified U1/U3 coupling: U1 `host-init.js` exports `updateStorageBuffer` but U1 `non_goals` forbids implementing it

- **severity:** P2
- **confidence:** likely
- **category:** unit disjointness / scope match
- **where:** P3 U1 `done_when` (3) vs U1 `non_goals` and U3 `write_scope`
- **expected:** U1 and U3 are claimed disjoint (P3 "U1 and U3 are provably disjoint"). U1 `non_goals` says "Do not implement `updateStorageBuffer` — that is U3."
- **actual:** U1 `done_when` (3) requires `public/host-init.js` to export `initHost()` returning `{ device, updateStorageBuffer, submitFrame, resize, destroy }`. So U1's `host-init.js` must re-export an `updateStorageBuffer` symbol that only U3 is allowed to create. U1 cannot both be disjoint from U3 and export `updateStorageBuffer` before U3 exists. Either U1 must depend on U3 (breaking the parallel claim), or U1's `host-init.js` must defer the `updateStorageBuffer` field to U4 integration (in which case U1 `done_when` (3) overstates what U1 delivers alone).
- **impact:** The U1/U3 parallelism claim is weaker than stated. An implementer running U1 and U3 in parallel will hit a missing-symbol gap in `host-init.js`. The integration risk is bounded (U4 wires them together), but the disjointness claim and U1 done_when are inconsistent.
- **evidence:**
  - P3 U1 `done_when` (3): `host-init.js` ... exports `initHost()` that returns `{ device, updateStorageBuffer, submitFrame, resize, destroy }`.
  - P3 U1 `non_goals`: "Do not implement `updateStorageBuffer` — that is U3."
  - P3 U3 `write_scope`: `hosts/webgpu-browser/public/src/webgpu-runtime.js` (different repo from U1's `examples/...`).
  - P3 "Ordered unit graph": U1 and U3 parallel, U4 depends on U1+U3.
- **reproduction:** read P3 U1 done_when (3) and non_goals side by side.
- **fix_direction:** Clarify the U1/U3 seam. Either (a) U1 `host-init.js` returns a stub/placeholder `updateStorageBuffer` that throws "not wired" until U4 integration, and U1 `done_when` (3) is relaxed accordingly; or (b) U1 depends on U3 (add `depends_on: u3` to U1) and drop the U1/U3 parallel claim. Note this interacts with F1: if U3 consumes the existing `updateGraphicsStorage`, the seam name changes too.
- **suggested_owner:** planner-1 (P3 revision)
- **done_when:** U1 `done_when` and `non_goals` are consistent on whether U1 exports a working `updateStorageBuffer`/`updateGraphicsStorage` symbol, and the U1/U3 dependency graph matches that statement.

## Lens-by-lens summary

1. **Grounding truth** — mostly PASS. Every cited file path exists at the cited location and says what P2/P3 claims, with one stale exception: P3 U3 was authored against `hosts @ 735df10`, which predates `updateGraphicsStorage` now present at HEAD (F1). `triga/src/triga.fab` has not changed since the cited rev (drift only in hello-voxel docs), so the transform contract grounding is intact.
2. **Scope match** — PASS with caveat. P3 U1-U4 cover the Stage 1 surface (mount, manifest, host update, lifecycle) and gate (no Three.js, readback, resize, device loss). No scope creep outside Stage 1. F1 is an architecture-choice issue, not a scope gap. U4 `non_goals` correctly excludes geometry upload, scene store, pipelines, new Faber syntax, WGSL.
3. **Unit disjointness** — PARTIAL. U1 (examples page/public), U2 (faber product.rs), U3 (hosts webgpu-runtime.js) are repo-disjoint. F5: U1's `host-init.js` exports a symbol only U3 may create, making the U1/U3 parallel claim inconsistent. F1: U3's proposed `updateStorageBuffer` overlaps the existing `updateGraphicsStorage` in the same file.
4. **Validation feasibility** — PARTIAL. F2: `cargo run -p faber` from `examples/triga-drift-city/` fails (no workspace). F3: U3 `register-hooks.mjs` path does not exist. F4: `cd faber && cargo test` does not compile at cited rev. U1 `diff hosts/... examples/.../public/...` and `grep` checks are runnable. U2 `python3 -m json.tool` is runnable. U4 browser checks are correctly noted as requiring a WebGPU browser.
5. **Architecture authority** — PARTIAL. Transform contract matches live `triga.fab` exactly: 32 floats, 16 model + 16 view-projection, column-major (model elements appended first, then view-projection; `transform_payload` and accessors at lines 1213-1260 confirm bytes 0-63 model, 64-127 view-projection). F1: the host bridge authority is stale — P3 proposes a new `updateStorageBuffer` seam when `updateGraphicsStorage` (reflection-driven, app-agnostic) already exists and is tested. The P3 `non_goals` "Do not add GPU buffer creation tied to reflection parsing — `createHostSession` accepts pre-computed buffer declarations from the caller" directly contradicts the campaign rule that the host consumes reflection, not caller-supplied declarations.
6. **Mind decisions** — PASS. All 4 resolved open questions are reflected: (1) WGSL/reflection omitted with `stage=1` + `next_stage_artifacts=["wgsl","reflection"]` in U2 done_when/validation/gate; (2) direct mapped-buffer readback (`MAP_READ | COPY_DST`, no compute dispatch) in U4 done_when (6)/non_goals/risk; (3) copy into `public/` in U1 write_scope; (4) static `host-init.js` in `public/` in U1 write_scope. Verified that drift-city `dist/` has no WGSL/reflection at Stage 1, so the omission is grounded.
7. **Campaign invariants** — PASS with F1 caveat. No Three.js on admitted route (U1 copies only `faber-kernel.js` + `webgpu-runtime.js`, neither references Three.js; the Three.js vendor code lives in `hosts/webgpu-browser/public/vendor/` and `app.js`, which U1 does not copy). No handwritten JS recreating simulation/scene/camera/draw policy (U4 non_goals enforce this; transform computation stays in Faber controller). No new Faber syntax (U4 non_goals). No external asset acquisition. No engine abstraction invention — except F1: `createHostSession` is a new engine-style abstraction that competes with the existing reflection-driven seam.

## Validation run

| Command | Result | Note |
| --- | --- | --- |
| `cd examples/triga-drift-city && ./tests/run.sh` | pass | 25 passed, 0 failed. Baseline Stage 0 green via prebuilt faber binary. |
| `cd examples/triga-drift-city && cargo run -p faber -- build --package .` | blocked | "could not find Cargo.toml" — no workspace at examples. (F2) |
| `cd faber && cargo test --no-run` | fail | 20 compile errors at `faber @ 4acabab`. (F4) |
| `cd faber && cargo build --bin faber` | fail | lib must compile for bin; same 20 errors. Prebuilt binary still works. (F4) |
| `faber/target/debug/faber --version` | pass | `faber 1.2.0` (prebuilt Jul 26 07:02) |
| `node hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` | pass | 6/6 PASS for existing `updateGraphicsStorage`. (F1 evidence) |
| `find hosts -name register-hooks.mjs` | empty | U3 validation path does not exist. (F3) |
| `grep -in three hosts/webgpu-browser/public/src/{faber-kernel,webgpu-runtime}.js` | empty | Admitted host files to be copied do not reference Three.js. |
| `git log --oneline 919c1d1..HEAD -- src/triga.fab` (triga) | empty | `triga.fab` unchanged since cited rev. Transform contract grounding intact. |
| `git log --oneline 735df10..HEAD -- webgpu-browser/public/src/webgpu-runtime.js` (hosts) | non-empty | 106 lines added — `updateGraphicsStorage` + check harness. (F1) |

## Blind spots

- **Browser checks not run.** U1/U4 done_when include real-browser checks (mount, readback across 2 frames, resize, device loss, `window.THREE === undefined`). I did not run a WebGPU-capable browser. These remain implementer/auditor-2 territory at factory time. Does not affect this planning-artifact audit.
- **radix not re-grounded.** `radix` drifted from `eadb78cf0` to `a416791`. Stage 1 does not list radix as a participating repo (only "for a demonstrated artifact/reflection blocker"), and no P2/P3 claim cites a radix file. I did not re-ground radix. If a Stage 1 factory unit later touches radix, re-ground then.
- **`product.json` schema feasibility.** P3 U2 specifies a `product.json` schema (`version`, `stage`, `next_stage_artifacts`, `build_timestamp`, `artifacts[]`, `assets_manifest`). I verified the existing `assets.json`/`controllers.json` emission and `ManifestProduct` shape support an additive manifest, but I did not prototype the `product.json` writer. Schema feasibility is likely but unproven by execution.

## Not claimed

- Global correctness of any repo.
- That the faber crate will compile after a fix — only that it does not at the cited tip.
- That browser-level done_when (U1/U4) will pass — not run.
- GO stamp or product acceptance. This is a planning-artifact audit only; Mind owns disposition.
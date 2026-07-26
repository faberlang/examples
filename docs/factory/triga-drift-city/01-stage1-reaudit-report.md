# Stage 1 P3 Revision Re-Audit Report

**Auditor:** auditor-1
**Assignment handle:** 5785ed27
**Prior audit handle:** 9495407b (verdict: residual, 5 P2 findings)
**Date:** 2026-07-26
**Artifact kind:** re-audit (P3 revision F1-F5 fix verification)

## Verdict: `residual`

All 5 prior findings (F1-F5) are fixed. One new minor P2 finding (N1) introduced by the revision: U4 `depends_on` references a stale U3 unit id. No ship blocker. N1 is a one-line fix in P3; factory hand-off should not proceed until the id reference is reconciled.

## Repo grounding (live HEADs at re-audit)

| Repo | HEAD | Notes |
| --- | --- | --- |
| `examples` | `df06d4b` | unchanged since prior audit — P3/P2 revisions are doc-only here |
| `hosts` | `9cdd3c9` | unchanged — `updateGraphicsStorage` at `webgpu-runtime.js:1651`, harness 6/6 PASS |
| `triga` | `c73b92a` | `src/triga.fab` unchanged since cited `919c1d1` |
| `faber` | `4acabab` | unchanged at cited tip; `cargo test` still infeasible (now via radix-codegen-rust dependency, see F4 note) |
| `faber-web` | `299616a` | unchanged |
| `radix` | `243aeb539` | drifted further since prior audit (`a416791`); foreign dirt present (class B — another agent's WIP, not mine to touch) |

## Per-finding status

### F1 — Stale grounding: competing host seam — **FIXED**

- **status:** fixed
- **evidence:** Revised P3 U3 (`01-browser-product-host-bridge-delivery.md:86-99`) consumes the existing `updateGraphicsStorage` at hosts HEAD. U3 `outcome` explicitly states "U3 does NOT invent a new `updateStorageBuffer`/`createHostSession` API." U3 `non_goals` says "Do not create a new `updateStorageBuffer`/`createHostSession` API (competing seam rejected by campaign clean-break rule)." U3 `done_when` (6) asserts "No competing `updateStorageBuffer` or `createHostSession` exports are added to the same module." U3 `validation` includes `! grep -q 'export function updateStorageBuffer'` and `! grep -q 'export function createHostSession'`. No `createHostSession` or caller-supplied buffer declaration map remains in U3.
- **live re-verify:** `hosts/webgpu-runtime.js:1651 export function updateGraphicsStorage(device, resources, descriptor, { resourceIndex, sourceName, data })` at HEAD `9cdd3c9`. `node hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` → 6/6 PASS (T1a, T1b, T2a, T2b, T3, T4, T5). `resources.storageBuffers` is the canonical buffer store (reflection-resolved, not caller-supplied).

### F2 — Infeasible validation: `cargo run -p faber` from examples — **FIXED**

- **status:** fixed
- **evidence:** `grep -n 'cargo run -p faber\|cargo run' 01-browser-product-host-bridge-delivery.md` → none found. `FABER_BIN` form present 4 times. U1 validation: `FABER_BIN="${FABER:-$PWD/faber/target/debug/faber}"` + `"$FABER_BIN" build --package .`. U2 validation: same `FABER_BIN` form. U4 validation: same `FABER_BIN` form. All three units now match the `tests/run.sh` prebuilt-binary pattern.
- **feasibility re-verify:** `/Users/ianzepp/work/faberlang/faber/target/debug/faber build --package .` from `examples/triga-drift-city/` → exit 0, emits `dist/faber-esm/faber-browser.js`.

### F3 — Infeasible validation: missing `register-hooks.mjs` path — **FIXED**

- **status:** fixed
- **evidence:** `grep -n 'register-hooks' 01-browser-product-host-bridge-delivery.md` → none found. U3 `validation` now runs `node hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs`. U3 `read_scope` cites `graphics-storage-update-check.mjs (6/6 PASS; fake-device harness)`. Path exists: `ls -la hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` → 17653 bytes, Jul 26 18:39.
- **feasibility re-verify:** `node hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` → 6/6 PASS (ran during F1 re-verify).

### F4 — Baseline: `cd faber && cargo test` does not compile at `4acabab` — **FIXED**

- **status:** fixed (operative level); staleness-detail drift noted below
- **evidence (P2 note):** `01-stage1-goal-check.md:74-76` now records: "`faber` crate at `4acabab` does not compile (`cd faber && cargo test --no-run` → 20 errors on `FileFrontmatter` methods and `LoweredMirUnit.validation`). The prebuilt `faber/target/debug/faber` binary (Jul 26 07:02) works; `tests/run.sh` passes via prebuilt binary. P3 U2 validation uses the prebuilt binary, not `cargo test`. The faber compile baseline is a known debt outside Stage 1 scope." Staleness table row updated to "PASS (with note)."
- **evidence (U2 validation):** `grep -n 'cargo test\|cargo run'` in P3 → none. U2 `done_when` (6) explicitly: "The prebuilt `faber` binary (`faber/target/debug/faber`) succeeds at emitting `product.json` and running the existing `tests/run.sh` passes; the faber crate itself does not compile at `4acabab` (20 errors) and that baseline fix is out of Stage 1 scope." U2 `done_when` (7): "A focused `product.json` schema validation script (not `cargo test`) proves the manifest is valid JSON."
- **operative re-verify:** `cd faber && cargo test --no-run` still fails (compile infeasible). Prebuilt `faber/target/debug/faber --version` → `faber 1.2.0`. `examples/triga-drift-city/tests/run.sh` → 25 passed, 0 failed.
- **staleness-detail drift (non-blocking):** The P2 note's specific error attribution ("20 errors on `FileFrontmatter` methods and `LoweredMirUnit.validation`") no longer matches live state. As of this re-audit, `cargo test --no-run` fails earlier at a dependency: `radix-codegen-rust` (lib) with `error[E0433]: cannot find type DiagnosticArg in this scope` (1 error). `radix` HEAD has moved to `243aeb539` with foreign dirt (class B — 8 modified files + untracked `crates/radix-codegen-shared/src/validation.rs`), which is another agent's in-progress WIP on the `DiagnosticArg`/`validation` symbols. The headline claim (cargo test infeasible, use prebuilt binary, baseline debt out of Stage 1 scope) remains true. The error-detail drift is a description staleness, not a re-introduction of F4. I flag it for planner-1 to refresh on next P2 touch; it does not block admission.

### F5 — Under-specified U1/U3 coupling: `host-init.js` exports `updateStorageBuffer` — **FIXED**

- **status:** fixed
- **evidence (U1 stub pattern):** U1 `done_when` (3) now: "`public/host-init.js` exists and, when loaded as a module, exports `initHost()` that returns `{ device, updateGraphicsStorage: placeholder, submitFrame, resize, destroy }` where `updateGraphicsStorage` is a stub that throws `"not wired"` until U4 wires the real `updateGraphicsStorage` from the host." U1 `non_goals`: "Do not implement the real `updateGraphicsStorage` wiring — U3 confirms the canonical seam, and U4 wires it into `host-init.js`. The `updateGraphicsStorage` field on U1's `host-init.js` return value is a stub placeholder that throws `"not wired"`; U4 replaces it with the real import."
- **evidence (U1/U3 parallel):** U1 `depends_on` → `none`. U3 `depends_on` → `none`. Ordered unit graph (line 46-50): "U1 and U3 are provably disjoint ... All three can execute in parallel. U1's `host-init.js` exports a stub `updateGraphicsStorage` ... U4 wires the real host symbol into `host-init.js`."
- **evidence (U4 wires real symbol):** U4 `outcome`: "The drift-city controller calls `host.updateGraphicsStorage` each frame." U4 `done_when` (2): "Controller calls `host.updateGraphicsStorage(device, resources, descriptor, { resourceIndex: 0, data: new Float32Array(payload.values) })` each frame." U4 `write_scope` includes `host-init.js` (host session wiring). U4 `depends_on` → `u1-product-page-canvas-host-loading`, `u3-generic-host-storage-buffer-update` (see N1 — id reference is stale, but the dependency intent is correct).

## New findings introduced by the revision

### N1 — U4 `depends_on` references stale U3 unit id (dangling dependency)

- **severity:** P2
- **confidence:** confirmed
- **category:** unit disjointness / scope match (dependency graph integrity)
- **where:** `01-browser-product-host-bridge-delivery.md:112` (U4 `depends_on`) vs `:90` (U3 `id` field)
- **expected:** U4 `depends_on` should reference U3's actual `id` value so id-based dependency resolution at factory time finds the unit.
- **actual:** U3 `id` is `u3-canonical-host-storage-update` (line 90, renamed by the revision). U4 `depends_on` still cites the pre-revision id `u3-generic-host-storage-buffer-update` (line 112). The old id no longer exists in the spec. An implementer resolving `depends_on` by id will not find U3.
- **impact:** Factory unit dispatch by id would fail to resolve U3 as a U4 dependency. Bounded: the textual "U1 + U3" checkpoint table and the prose dependency make the intent clear, so a human reader can recover. But the structured `depends_on` field is wrong.
- **evidence:**
  - `awk '/^### Unit 3/,/^### Unit 4/' P3 | grep 'id'` → `| id | u3-canonical-host-storage-update |`
  - `awk '/^### Unit 4/,/^## Checkpoints/' P3 | grep 'depends_on'` → `| depends_on | u1-product-page-canvas-host-loading, u3-generic-host-storage-buffer-update |`
  - `grep -n 'u3-generic\|u3-canonical' P3` → line 90 `u3-canonical-host-storage-update`; line 112 `u3-generic-host-storage-buffer-update` (stale).
- **reproduction:** read P3 line 90 vs line 112.
- **fix_direction:** Update U4 `depends_on` (line 112) to `u1-product-page-canvas-host-loading`, `u3-canonical-host-storage-update`. One-line edit in P3. No P1/P2 re-lowering needed.
- **suggested_owner:** planner-1 (P3 one-line edit)
- **done_when:** U4 `depends_on` cites `u3-canonical-host-storage-update` (matches U3 `id`).

## Validation run

| Command | Result | Note |
| --- | --- | --- |
| `node hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` | pass | 6/6 PASS (T1a, T1b, T2a, T2b, T3, T4, T5). F1/F3 re-verify. |
| `grep -n 'cargo run -p faber' P3` | empty | F2 — no `cargo run -p faber` in revised P3. |
| `grep -nc 'FABER_BIN' P3` | 4 | F2 — `FABER_BIN` form present in U1, U2, U4 validation. |
| `grep -n 'register-hooks' P3` | empty | F3 — non-existent path removed. |
| `ls hosts/webgpu-browser/public/src/graphics-storage-update-check.mjs` | exists | F3 — cited harness path exists. |
| `grep -n 'createHostSession\|updateStorageBuffer' P3` | only in rejection assertions | F1 — appears only as `! grep -q 'export function updateStorageBuffer'` and prose "does NOT invent." No invention. |
| `cd faber && cargo test --no-run` | fail | F4 — `radix-codegen-rust` fails: `cannot find type DiagnosticArg` (1 error). P2 note's "20 errors on FileFrontmatter" detail is now stale; headline claim holds. |
| `faber/target/debug/faber --version` | pass | F4 — prebuilt binary works (`faber 1.2.0`). |
| `faber/target/debug/faber build --package .` (from examples/triga-drift-city) | pass | F2/F4 — U2 validation form feasible; emits `dist/faber-esm/faber-browser.js`. |
| `examples/triga-drift-city/tests/run.sh` | pass | 25 passed, 0 failed. Baseline green via prebuilt binary. |
| `awk U3 id` vs `awk U4 depends_on` | mismatch | N1 — U3 id `u3-canonical-host-storage-update`; U4 depends_on cites stale `u3-generic-host-storage-buffer-update`. |

## Blind spots

- **Browser checks not run.** U1/U4 real-WebGPU done_when (mount, readback across 2 frames, resize, device loss, `window.THREE === undefined`) not executed. Factory/auditor-2 territory. Does not affect this planning-artifact re-audit.
- **radix foreign dirt.** `radix` HEAD `243aeb539` has class B foreign WIP (8 modified files + untracked `validation.rs`) on `DiagnosticArg`/`validation`. I inspected but did not touch. This is another agent's in-progress work; the faber compile baseline drift in F4 traces to this. Out of my scope.
- **`product.json` writer not prototyped.** U2 schema feasibility is likely (existing `assets.json`/`controllers.json` emission supports additive manifest) but unproven by execution.

## Not claimed

- Global correctness of any repo.
- That the faber/radix compile baseline will recover — only that P3 U2 no longer gates on it.
- That browser-level done_when (U1/U4) will pass — not run.
- GO stamp or product acceptance. This is a planning-artifact re-audit only; Mind owns disposition.
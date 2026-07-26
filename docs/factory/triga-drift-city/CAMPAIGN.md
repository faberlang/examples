# Campaign: Triga Drift City

**Status:** framework established; roadmap ready for routing only
**Mode:** draft/maintain — this document does not authorize implementation
**Owner repo:** `examples`
**Participating repos:** `examples`, `triga`, `radix`, `hosts`, `faber`, `faber-web`
**Framework package:** [`../../../triga-drift-city/`](../../../triga-drift-city/)
**Selected next stage:** none — lower Stage 1 only after explicit activation
**Release posture:** no release before the playable direct-WebGPU capstone

## Summary

Triga Drift City is the application forcing function for proving that Faber and Triga can support a small browser 3D game. The target is a bounded original nighttime city circuit with one controllable arcade-drift car, collision, a chase camera, visible drift feedback, and a minimal HUD, rendered directly through WebGPU without Three.js or application-specific JavaScript game policy.

The existing package is an executable framework and specification. It owns deterministic simulation, city bounds, collision, camera facts, input, package admission, and tests. It does not yet mount as a live browser product or render a visible scene. This campaign maps the stages required to close that gap. Each implementation stage must lower to its own delivery specification before factory execution.

## Invariant

Driving simulation, city state, collision, camera behavior, scene state, material intent, and draw intent originate in Faber and Triga. Radix, Faber packaging, and browser hosts may lower, transport, and execute those facts, but handwritten JavaScript may not recreate application or renderer policy.

## Problem

The current framework proves useful application behavior but stops before a real browser game:

- the generated controller is admitted by a fixture but is not mounted by a complete browser product path;
- Triga scene facts are published but are not consumed by the reflection-driven WebGPU host;
- the host has indexed and multi-draw primitives but lacks the admitted live application bridge and a public dynamic transform-update seam;
- the current shader and geometry proof surface is too narrow for a moving car plus a city scene;
- textures, atmosphere, drift effects, HUD presentation, performance budgets, and browser capstone evidence are not established;
- existing Hello Voxel and Three.js-equivalence work provides foundations, but neither is the Drift City application acceptance path.

Without one application campaign, these gaps can be solved as disconnected proofs that never become a playable game.

## Desired End State

A user can open a generated browser product and:

1. See one original city circuit, one car, roads, and repeated city structures rendered directly through WebGPU.
2. Focus the game and use keyboard controls to accelerate, brake, reverse, steer, and handbrake drift.
3. Drive around the bounded circuit with deterministic building and boundary collision.
4. Follow the car through a Faber-owned chase camera.
5. Read speed and drift score from a minimal HUD.
6. See enough nighttime presentation to identify the intended experience: textured or materially distinct roads and structures, emissive signs or lights, fog, and visible tire-slip feedback.
7. Reset after leaving the useful play state without reloading the page.
8. Run without Three.js, another renderer, proprietary assets, or application-specific JavaScript simulation and draw policy.

The capstone must prove one coherent workload. It does not require general engine completeness or broad Three.js API parity.

## MVP Contract

### Required

- one bounded original city circuit;
- one controllable car;
- acceleration, braking, reverse, steering, drag, lateral grip, and handbrake drift;
- heading-aware collision against city bounds and structures;
- chase camera;
- direct WebGPU rendering;
- continuous visible frame loop and resize handling;
- road, building, and vehicle geometry;
- basic materials or textures sufficient to distinguish scene surfaces;
- nighttime background, emissive or lit structures, and fog or equivalent depth cue;
- tire smoke, skid marks, or another visible drift cue;
- speed, drift score, renderer status, and reset controls;
- deterministic tests plus real-browser rendering evidence;
- no Three.js runtime on the admitted route.

### Not required

- real Tokyo map data or branding;
- licensed vehicles, music, or proprietary assets;
- open-world streaming;
- traffic, pedestrians, police, missions, or opponents;
- physically exact tire, suspension, drivetrain, or damage simulation;
- mobile controls, networking, multiplayer, saved progression, editor tooling, or production deployment;
- advanced PBR, global illumination, reflections, weather, or exhaustive post-processing;
- general game-engine or Three.js source/API compatibility.

## Development Posture

- **Workload first.** Add only platform capability required by the next visible Drift City checkpoint.
- **Framework, then activation.** This roadmap does not start implementation. A selected stage must first lower through `delivery`.
- **Direct-only accepted path.** Three.js may be consulted as an oracle or used in a separate comparison fixture, but it may not render the admitted product.
- **Generic host seams.** Browser bridges, transform updates, resource lifecycle, and draw scheduling must be reusable host capabilities rather than Drift City-specific JavaScript.
- **Application ownership.** Simulation and scene decisions remain in Faber even when generated ESM transports their results.
- **Clean breaks.** Replace proof-only paths when the canonical live path passes; do not preserve competing runtime routes without an explicit contract.
- **Original bounded content.** Begin with procedural or hand-authored geometry and colors. External asset acquisition requires a separate licensed-source decision.
- **Measured performance.** Delivery specs freeze scene counts, test hardware, and frame budgets from measured baselines. This campaign does not invent thresholds.
- **Honest evidence.** Static checks and fake-device tests are useful gates, but they do not satisfy visible browser-render claims.

## Activation And Delivery Workflow

For every selected stage:

1. Research current executable truth in all participating repositories.
2. Compile the whole coherent stage into a durable `delivery` specification.
3. State the cross-repository invariant and ownership seams before editing.
4. Use `factory` for implementation, focused validation, independent review, polish, and commits.
5. Update this campaign only for routing, stage state, evidence, and next-stage selection.
6. Use a completion audit before promoting a visible milestone or the final MVP.

## Scope Routing

| Surface | Canonical owner | Drift City responsibility |
| --- | --- | --- |
| Application state, city workload, game acceptance | `examples/triga-drift-city` | Simulation, scene construction, controls, scoring, reset, capstone evidence |
| Public geometry, scene, material, and spatial contracts | `triga` | Add only reusable shapes or algorithms exposed by a concrete application blocker |
| Shader stages, graphics MIR, WGSL, reflection | `radix` | Lower typed graphics intent and reject unsupported contracts before execution |
| Browser WebGPU resources and draw lifecycle | `hosts/webgpu-browser` | Generic reflection consumer, dynamic updates, frame submission, resize, loss, cleanup |
| Browser product build and artifact identity | `faber` | Package generated ESM, graphics artifacts, host runtime, pages, styles, and manifests coherently |
| DOM/controller mounting and browser events | `faber-web` | Generated-controller lifecycle, focus, keyboard, frame, resize, and disposal contracts |
| Release/distribution | deferred | Consider only after the playable capstone passes |

## Batching And Split Policy

- Browser product mounting and the live host bridge are **discovery-first** because they establish the canonical application-to-renderer seam.
- Geometry/resource families are **batch-by-default** after one road, one building, and one car pattern execute through the accepted route.
- Material and atmosphere parameters are **batch-by-default** after one typed material and one admitted texture or emissive path render correctly.
- Split only at a demonstrated repository ownership, public artifact schema, resource lifetime, shader legality, browser execution, performance, asset-license, or security boundary.
- Do not split the first visible scene into compiler, host, and application proofs that never execute together.
- Do not add speculative engine abstractions, options, registries, editors, or generalized physics systems for one application.

## Activation Research Inputs

The framework claims were verified in `examples` on 2026-07-26. Sibling capability observations are dated research inputs, not permanent promises. Every activated stage must re-ground them against live source before writing its delivery spec.

| Repository | Observed revision |
| --- | --- |
| `examples` | `ee17e2a` |
| `triga` | `919c1d1` |
| `radix` | `eadb78cf0` |
| `hosts` | `735df10` |
| `faber` | `4acabab` |
| `faber-web` | `299616a` |

Research inputs, in authority order:

1. [`../../../triga-drift-city/src/`](../../../triga-drift-city/src/) and its tests — current framework behavior.
2. [`00-application-foundation-delivery.md`](00-application-foundation-delivery.md) — completed foundation boundary.
3. `triga/src/{triga,geometry,scene}.fab` — public Triga math, geometry, scene, material, and spatial contracts.
4. `hosts/webgpu-browser/public/src/{faber-kernel,webgpu-runtime}.js` — current reflection-driven graphics host primitives.
5. `examples/hello-voxel/` — current Faber browser lifecycle, geometry transport, and resource-lifecycle pressure.
6. `triga/docs/factory/hello-voxel/CAMPAIGN.md` — direct-WebGPU application foundation and known residuals.
7. `triga/docs/factory/triga-threejs-80/` — broader workload-equivalence goals; useful context, not the Drift City execution order.
8. `faber-web/src` and `faber-web/runtime` — controller and browser-event contracts.
9. `faber/src` and Radix target/reflection implementation — live packaging and compiler truth when each stage is lowered.

Planning documents are claims until reconciled with live code during the selected stage's delivery research.

## Current State

| Track | State | Next action |
| --- | --- | --- |
| Project framework | Complete | Preserve as executable specification |
| Vehicle simulation | Deterministic Faber implementation and compiled facts pass | Tune only from visible play evidence |
| City/collision | Bounded Box3 circuit and heading-aware car collision pass | Convert scene facts into retained renderable objects |
| Browser controller | Generated package and fixture mount pass | Establish a real packaged browser mount |
| Direct graphics host | Indexed and multi-draw primitives exist outside the app | Add the canonical live application bridge and dynamic updates |
| Visible scene | Not implemented | Render the first road, structures, and car after Stage 1 |
| Materials/atmosphere | Not implemented for the app | Add after the greybox route is stable |
| Drift feedback/HUD | Simulation facts exist; presentation absent | Add after continuous rendering is accepted |
| Real-browser evidence | Absent | Establish at the first visible scene and strengthen through capstone |
| Release | Deferred | Revisit only after final acceptance |

## Campaign Path

Required closure order:

```text
Stage 0 → Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Stage 6
```

Stage 4 discovery may overlap the tail of Stage 3 only after resource ownership is frozen, but Stage 4 cannot close before Stage 3. All other stages close in order.

### Stage 0 — Framework And Workload Contract

**Status:** complete
**Participating repo:** `examples`
**Source:** [`00-application-foundation-delivery.md`](00-application-foundation-delivery.md)
**Outcome:** package layout, deterministic simulation, city/collision, chase camera, controller facts, tests, and explicit rendering gate.
**Gate:** `triga-drift-city/tests/run.sh` passes without Three.js or handwritten JavaScript game policy.
**Lowers to:** complete; no further factory work in this stage.

### Stage 1 — Canonical Browser Product And Live Host Bridge

**Status:** in-progress; U1+U3+U4 accepted, U2 blocked on faber compile baseline (foreign dirt)
**Participating repos:** `examples`, `faber`, `faber-web`, `hosts`; `radix` only for a demonstrated artifact/reflection blocker
**Depends on:** Stage 0
**Why now:** every later visible feature depends on one admitted path from generated Faber state to the WebGPU host.
**Surface:** real controller mounting, coherent artifact packaging, host-runtime loading, dynamic named storage-buffer updates, frame/resize/device-loss lifecycle, and same-build identity.
**Gate:** the generated product mounts and disposes its controller with inspectable failure state; one product manifest identifies the same-build page, ESM, host runtime, WGSL, and reflection; a Faber-owned changing transform reaches a generic host update before a direct WebGPU frame; resize replaces dependent resources without losing the scene; device loss produces a bounded error and cleanup state; the admitted module graph contains no Three.js.
**Open decision:** freeze the canonical per-object transform/resource contract. Default: generic retained model transforms, not per-frame car vertex baking or DOM-prefix-specific host code. — **RESOLVED 2026-07-26:** transform contract frozen as `triga::TransformPayload` (32 floats: 16 model + 16 view-projection, column-major); host bridge consumes existing reflection-driven `updateGraphicsStorage`, not a competing seam.
**Lowers to:** `delivery` → `factory`.
**Batching:** discovery-first.
**Delivery spec:** [`01-browser-product-host-bridge-delivery.md`](01-browser-product-host-bridge-delivery.md)
**Audit reports:** [`01-stage1-audit-report.md`](01-stage1-audit-report.md) (residual, 5 P2, fixed), [`01-stage1-reaudit-report.md`](01-stage1-reaudit-report.md) (residual, N1 fixed), post-land auditor-2 (residual, U4 F1+F2 repaired).
**Landed units:**
- U1 (`u1-product-page-canvas-host-loading`) — examples `0e44f72`. ACCEPTED.
- U2 (`u2-product-identity-manifest`) — faber `a5b607a`. COMMITTED, blocked on faber compile baseline (foreign dirt). Need `0f3f799c` to operator.
- U3 (`u3-canonical-host-storage-update`) — hosts HEAD `9cdd3c9`, confirmation-only. ACCEPTED.
- U4 (`u4-integration-lifecycle-transform-bridge`) — examples `04d9f97` + `96b350a` (F1+F2 repair), triga `635cb12`. ACCEPTED.
**Stage gate status:** CANNOT CLOSE until U2 is unblocked (faber compile baseline fix) and validated end-to-end.
**Blind spots:** real WebGPU browser checks not run (no headless WebGPU browser); radix not re-grounded (not a Stage 1 participating repo).
**Next:** when operator unblocks faber, rebuild binary, validate U2 end-to-end, re-audit U2, close Stage 1 gate, then select and lower Stage 2 (First Visible Greybox Drive).

### Stage 2 — First Visible Greybox Drive

**Status:** planned
**Participating repos:** `examples`, `triga`, `radix`, `hosts`, `faber`
**Depends on:** Stage 1
**Surface:** one road mesh, a small set of structures, one car, depth testing, chase-camera view projection, continuous indexed rendering, keyboard drive loop, collision, reset, and resize.
**Gate:** a real browser visibly renders the road, structures, and car with depth testing; a deterministic keyboard sequence changes the Faber-owned car and chase camera before the next visible frame; collision evidence shows no structure penetration; reset restores spawn state; resize preserves a correctly projected visible scene; before/after pixels and submit evidence share the product identity; JavaScript owns transport and WebGPU lifecycle only.
**Overlap rule:** shader, reflection, host, geometry, and app changes remain one integrated checkpoint even when committed by repository.
**Lowers to:** `delivery` → `factory`.
**Batching:** discovery-first for the first integrated draw, then batch repeated colored geometry.

### Stage 3 — City Scene And Resource Scale

**Status:** planned
**Participating repos:** `examples`, `triga`, `radix`, `hosts`
**Depends on:** Stage 2
**Surface:** complete bounded circuit geometry, repeated buildings and signs, retained scene resources, batching or instancing where proven useful, culling appropriate to the scene, deterministic resource replacement, and measured browser performance.
**Gate:** the full MVP circuit remains interactive without rebuilding static city resources each frame; repeated structures use the selected retained batching or instancing path; culling decisions and deterministic resource replacement are observable; measured evidence names scene counts, update costs, test environment, and bottlenecks.
**Lowers to:** `delivery` → `factory`.
**Batching:** batch-by-default after one repeated-resource pattern; split on measured scale or lifetime boundaries.

### Stage 4 — Materials, Textures, And Night Atmosphere

**Status:** planned
**Participating repos:** `examples`, `triga`, `radix`, `hosts`
**Depends on:** stable Stage 2 renderer; may overlap late Stage 3 only after resource ownership is frozen
**Surface:** materially distinct road, structure, sign, and car surfaces; one admitted texture/sampler path if required; nighttime background; emissive or basic light cues; fog or equivalent depth cue; explicit color-space behavior.
**Gate:** materially distinct road, structure, sign, and car surfaces render with the selected texture/sampler path when required; nighttime background, emissive or light cues, and fog/depth cues are visible; color-space behavior is recorded; no material defaults are invented by the host; unsupported resource forms fail before drawing.
**Lowers to:** `delivery` → `factory`.
**Batching:** prove one typed material and one texture/resource pattern, then batch the bounded family.

### Stage 5 — Drift Feedback, HUD, And Game Loop Completion

**Status:** planned
**Participating repos:** `examples`, `triga`, `hosts`, `faber-web`
**Depends on:** closed Stages 3 and 4
**Surface:** visible tire-slip feedback through smoke, skid marks, or a simpler accepted cue; speed display; drift score; start/focus/reset state; camera response tuning; clear degraded/error state.
**Gate:** a user can start, focus, drive, initiate a visible drift, accumulate score, collide, and reset without reloading; the chase camera responds to movement without taking ownership from Faber; denied focus, unsupported rendering, or runtime failure produces a clear degraded/error state; all decisions originate in Faber.
**Lowers to:** `delivery` → `factory`.
**Batching:** split only if particles/decals expose a distinct renderer contract from DOM HUD work.

### Stage 6 — Playable MVP Capstone

**Status:** planned
**Participating repos:** all campaign repositories touched by Stages 1–5
**Depends on:** Stages 1–5
**Surface:** integration audit, real-browser execution, dependency scan, visual evidence, deterministic interaction script, resource-lifecycle evidence, measured performance, documentation, and remaining-gap record.
**Gate:** every required MVP contract is exercised in one same-build browser product; deterministic interaction, visual output, resource lifecycle, and measured performance evidence agree on artifact identity; documentation records operation and remaining gaps; no Three.js or application-specific JavaScript renderer appears in the admitted dependency graph; an independent audit accepts the evidence.
**Batching:** split on distinct audit/evidence boundaries; batch homogeneous evidence collection.
**Release checkpoint:** choose an internal milestone, public example release, or continued foundation work explicitly.
**Lowers to:** `delivery` → `factory` for the capstone and audit.

## Dependency Rules

- No implementation stage starts from this campaign directly; each selected stage first receives a delivery spec.
- Stage 1 must establish a generic browser seam before Drift City-specific visible renderer work.
- The host consumes compiler reflection and declared artifacts. It may not parse WGSL or infer layouts from DOM field names.
- A moving car must use the canonical scene/transform resource contract selected in Stage 1. Temporary proof transport may not become a second accepted path.
- Static city geometry must not be regenerated or re-uploaded every frame to avoid defining retained-scene behavior.
- Material breadth waits for a stable visible geometry path; polish cannot substitute for renderer correctness.
- Fake DOM/device checks remain required structural gates but never satisfy real-browser visibility claims.
- Any external asset must have an explicit license and provenance record before entering the package.
- New Faber syntax requires a separate language decision. Drift City should first use existing source constructs, Triga APIs, compiler annotations, and host contracts.
- Physics, audio, and graphics additions belong at their canonical reusable seam only when the bounded MVP demonstrates the need.

## First Useful Milestones

1. **Framework:** deterministic Faber driving and city workload — complete.
2. **First pixels:** visible road, structures, and car through direct WebGPU.
3. **First drive:** keyboard-controlled car and chase camera update the visible scene continuously.
4. **City lap:** complete bounded circuit runs with retained static resources and measured performance.
5. **Recognizable Drift City:** nighttime presentation, visible drift cue, speed, score, and reset.
6. **MVP:** one same-build direct-WebGPU browser product passes the independent capstone audit.

## Campaign Acceptance Criteria

This roadmap is ready for routing when:

- the executable framework is distinguished from the unimplemented visible MVP;
- the MVP contract and non-goals are explicit;
- every planned implementation stage names its dependency, gate, lowering path, and batching posture;
- cross-repository ownership and generic-host constraints are explicit;
- real-browser evidence cannot be replaced by static or fake-device checks;
- no implementation stage is selected without explicit activation;
- the release decision is deferred to the playable capstone.

Campaign completion requires the Stage 6 capstone. Completing this document or the application framework does not complete the campaign.

## Validation

Current framework:

```sh
cd examples/triga-drift-city
./tests/run.sh
```

Future delivery specs must add stage-specific checks. Visible milestones require a real WebGPU-capable browser and durable same-build evidence. The capstone must include dependency, artifact-identity, interaction, visual, resource-lifecycle, and performance records.

## Open Questions

These are routing decisions for future delivery research, not blockers to this roadmap:

1. How will `faber` package the generated controller, browser runtime, WebGPU host runtime, WGSL, reflection, geometry, and page under one same-build product identity?
2. What retained per-object transform contract should Triga and the host expose for the moving car and chase camera?
3. Does the bounded city need instancing for its measured object count, or is batched retained geometry simpler and sufficient?
4. What is the smallest typed material/texture/light contract that communicates the nighttime scene without pulling forward the full Three.js-equivalence roadmap?
5. Should the first drift cue be particles, dynamic line/quad geometry, or a simpler renderer-neutral trail contract?
6. Which named browser and hardware form the first performance and visual-evidence baseline?

Defaults: generic retained transforms; procedural original geometry; batched static city resources until measurement justifies instancing; vertex color before texture breadth; the simplest visible drift cue that exercises a reusable dynamic-geometry seam.

## Stop Conditions

Pause and revise the route when:

- the proposed bridge moves simulation, scene, camera, or draw decisions into handwritten JavaScript;
- a stage requires a second competing renderer path or a Three.js runtime dependency;
- compiler reflection cannot express a required layout or resource without guessing in the host;
- browser execution is unavailable but the stage gate requires visible GPU evidence;
- a public artifact schema, language syntax, security boundary, external asset license, or release decision is unresolved;
- implementation scope expands into a general engine, open world, advanced physics, or broad Three.js parity rather than the bounded MVP;
- measured performance contradicts the selected batching/resource strategy.

# Triga Drift City — Application Foundation Delivery

**Status:** complete — application foundation
**Owner repo:** `examples`
**Package:** `triga-drift-city/`
**Checkpoint:** a checked browser package owns a deterministic driving simulation and exposes a renderer-neutral Triga scene contract without claiming a rendered game.

## Goal

Create the first honest Triga Drift City example package. The unit establishes the application state and workload that later direct-WebGPU work must render: one arcade-drift car, a bounded city circuit, collision, a chase camera, browser input, and inspectable frame output.

## Invariant

The driving simulation, city state, collision decisions, camera state, and render intent are authored in Faber and represented with Triga values. A browser host may execute generic rendering contracts later, but it may not recreate game state or driving behavior in JavaScript.

## Scope

### In

- `examples/triga-drift-city/` browser-app package
- deterministic Faber vehicle state and keyboard input
- acceleration, braking/reverse, steering, lateral grip, handbrake drift, drag, and frame-delta clamping
- a bounded original city circuit represented by Triga boxes
- car-versus-city collision with deterministic rejection and velocity loss
- chase-camera position and target facts
- renderer-neutral scene facts for the road, buildings, and car
- a `WebController` that advances Faber state and publishes inspectable frame facts
- generated-package admission and compiled Faber fact tests
- clear documentation of implemented and blocked MVP surfaces
- top-level examples inventory entry

### Out

- Three.js or another rendering runtime
- an application-specific JavaScript renderer
- direct WebGPU presentation before the canonical host/package seam can consume this package
- textures, PBR, shadows, post-processing, audio, traffic, pedestrians, streaming, multiplayer, or proprietary assets
- changes to Triga, Radix, Faber, hosts, or faber-web in this unit

## Implementation

1. Add the browser package manifest, authored page, styles, and generated-output ignore rules.
2. Add `city.fab` with a bounded road/city layout, obstacle boxes, collision queries, and renderer-neutral scene counts/facts.
3. Add `vehicle.fab` with deterministic input, vehicle stepping, drift facts, collision response, and chase-camera facts.
4. Add `main.fab` with frame and keyboard subscriptions. Keep live state in Faber and publish position, heading, speed, drift, camera, scene, and render-admission attributes.
5. Add compiled fact tests for city layout, forward/reverse motion, steering, handbrake drift, collision, frame clamping, and camera following.
6. Add a package build/browser-controller harness and document the direct-render gate.

## Acceptance

- `faber check` accepts all authored source and fact files.
- Compiled fact tests pass.
- `faber build --package .` produces the browser ESM and controller manifest.
- The controller selector is `#triga-drift-city`.
- A browser fixture proves mount, keyboard delivery, frame advancement, and inspectable Faber-owned output.
- No authored or generated application source imports Three.js.
- No JavaScript file implements vehicle simulation, city collision, camera behavior, or rendering.
- The README says plainly that this unit is not yet the rendered Drift City MVP and names the direct-WebGPU gate.

## Deferred gate

The next unit must connect this package's Triga scene and per-frame transform facts to the canonical reflection-driven WebGPU graphics host. That gate is complete only when the page visibly renders the car and city without Three.js or application-specific JavaScript draw policy.

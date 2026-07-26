# Triga Drift City — Application Foundation

This browser package owns a deterministic arcade-driving simulation in Faber. It defines a bounded city circuit, vehicle input and drift dynamics, collision rejection, a chase camera, and renderer-neutral Triga scene facts.

This unit is **not yet the rendered Drift City MVP**. When mounted, the generated controller publishes inspectable `data-*` facts and reports rendering as `blocked` with the gate `pending-direct-webgpu`. The current browser product does not yet provide the live mounting and direct-WebGPU bridge, so this package does not claim an independently runnable page or visible game rendering.

The cross-repository path from this framework to the playable MVP is documented in [`../docs/factory/triga-drift-city/CAMPAIGN.md`](../docs/factory/triga-drift-city/CAMPAIGN.md). The campaign is a routing document and does not authorize implementation by itself.

## Controls

- `W` or `ArrowUp`: accelerate
- `S` or `ArrowDown`: brake, then reverse
- `A`/`D` or `ArrowLeft`/`ArrowRight`: steer
- `Space`: handbrake drift

## Build and test

From this directory:

```sh
./tests/run.sh
```

The script checks all authored Faber files, compiles and runs the city and vehicle fact programs, builds the browser package, verifies the controller manifest, and runs a minimal DOM admission fixture.

## Ownership

- `src/city.fab` owns the circuit, road and building `Triga Box3` values, collision queries, and scene facts.
- `src/vehicle.fab` owns input, frame clamping, deterministic drift dynamics, collision response, and chase-camera state.
- `src/main.fab` owns browser subscriptions and publishes Faber state as inspectable DOM attributes.
- Handwritten JavaScript exists only in the test fixture to mount built controllers and observe outputs. It does not simulate, collide, position the camera, or render; generated ESM contains the compiled Faber behavior.

## Deferred direct-WebGPU gate

Browser mounting and visible rendering remain blocked until the browser product can load the generated controller and the canonical reflection-driven WebGPU host can consume this package's Triga scene boxes and per-frame vehicle/camera facts directly. That host must not recreate city, vehicle, collision, camera, or draw-policy state in application-specific JavaScript.

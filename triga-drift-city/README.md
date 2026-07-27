# Triga Drift City — Application Foundation

This browser package owns a deterministic arcade-driving simulation in Faber. It defines a bounded city circuit, vehicle input and drift dynamics, sliding collision response, a chase camera, and renderer-neutral Triga scene facts.

The generated controller mounts, publishes its scene geometry once, and publishes a Triga transform payload every frame. The WebGPU host reads those facts and draws the greybox scene directly. This unit is **not yet the Drift City MVP**: it is a greybox drive with no materials, atmosphere, drift feedback, or HUD.

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

## Serve (Stage 2 browser check)

Rebuild the product and serve **`dist/`** (required so `/faber-esm/*` resolves):

```sh
./serve.sh                  # build + serve on :8765
./serve.sh --rebuild-faber  # cargo build -p faber first (shared cache)
./serve.sh --port 9000
./serve.sh --no-build       # restart server only
```

Open **http://127.0.0.1:8765/pages/index.html** and hard-refresh after rebuild.

`FABER` may point at a binary; otherwise the script tries
`~/.cache/faberlang-target/faber/debug/faber` (faber’s shared target-dir), then
`faber/target/debug/faber`.

## Ownership

- `src/city.fab` owns the circuit, road and building `Triga Box3` values, collision queries, and scene facts.
- `src/vehicle.fab` owns input, frame clamping, deterministic drift dynamics, collision response, chase-camera state, and the model-space car body.
- `src/scene.fab` and `src/box_geom.fab` own scene geometry assembly.
- `src/main.fab` owns browser subscriptions and publishes Faber state as inspectable DOM attributes.
- `public/*.js` owns WebGPU transport and lifecycle only: pipeline creation, buffer uploads, draw submission, resize, and device loss. It holds no simulation constants, no spawn position, and no draw policy of its own.

## Ownership boundaries worth keeping

Four couplings are easy to break silently:

- **Yaw convention.** `heading_degrees` is a Triga camera yaw: `camera_forward_planus_ex_yaw` swings travel from -Z toward +X as it increases. A right-handed rotation about +Y turns the opposite way, so `compute_model_matrix` rotates the body by the *negated* heading. Drop the negation and the car yaws against its own path.
- **Projection aspect.** `styles/main.css` pins `.drift-canvas` to a 16:9 box and `src/main.fab` uses a matching constant. The controller never measures the element, and window size is not canvas size. Change the ratio in one place and the scene skews.
- **Car mesh space.** Faber publishes the car body in model space through `vehicle_local_box()`; the host applies the vehicle model matrix. The host must never re-centre vertices or know where the car spawns.
- **Render status.** The controller reports simulation state only. `data-render-status`, `data-render-gate`, and `data-device-status` are host-owned, and the host claims `live-direct-webgpu` only after a scene frame has actually been submitted.

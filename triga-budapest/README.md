# Triga Budapest — Chain Bridge Renderer Showcase

Triga Budapest is a static browser scene for proving Faber/Triga 3D rendering
surface area without Drift City's gameplay, collision, HUD, or simulation.

The first scene is a stylized Budapest Chain Bridge: Danube plane, bridge deck,
portal towers, suspension chains, hangers, rail posts, lamps, simple skyline
blocks, and low-detail lion markers. It is intentionally not a polygon-density
or historical-accuracy benchmark. Its job is to pressure the 3D library path:
scene facts, many meshes, camera projection, material intent by object color,
and direct WebGPU drawing.

## Controls

- `ArrowLeft` / `ArrowRight`: orbit yaw
- `ArrowUp` / `ArrowDown`: orbit pitch
- `W` / `S`: dolly in and out
- `A` / `D`: pan left and right
- `Q` / `E`: pan along the bridge axis

## Build and Test

From this directory:

```sh
./tests/run.sh
```

To serve the browser product:

```sh
./serve.sh
```

Open `http://127.0.0.1:8770/pages/index.html`.

## Ownership

- `src/bridge.fab` owns Chain Bridge scene facts and object placement.
- `src/camera.fab` owns orbit camera state and keyboard movement.
- `src/scene.fab` and `src/box_geom.fab` own geometry payload assembly.
- `src/main.fab` owns controller mount and DOM facts for the host bridge.
- `public/*.js` owns WebGPU transport and lifecycle only.

Renderer completeness work should move from this greybox surface toward
normals, UVs, texture/sampler facts, material uniforms, retained resource
batches, and reflection-driven graphics pipeline loading.

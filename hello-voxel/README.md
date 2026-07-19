# Hello Voxel

Hello Voxel is the campaign application package for the Triga direct WebGPU
proof. This scaffold proves package admission only. It does not claim a rendered
cube, voxel world, input loop, or WebGPU execution.

## Current State

- `src/main.fab` defines one `WebController`.
- The controller marks the package root as ready through `web:dom`.
- The page reserves a canvas for the later direct WebGPU host.

## Build

```sh
./tests/run.sh
```

The script writes a local `faber.lock` that points `web` to the sibling
`faber-web` package, builds the browser product, and checks the generated
controller manifest.

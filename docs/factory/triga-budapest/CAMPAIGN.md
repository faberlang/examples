# Triga Budapest — Renderer Completeness Showcase

Status: Stage 0 scaffold active; Chain Bridge greybox package present; material,
texture, asset, and reflection-pipeline completion still open.

## Goal

Triga Budapest is a static browser 3D showcase for demonstrating the
completeness of the Faber/Triga graphics stack. The first scene is a stylized
Budapest Chain Bridge, chosen for recognizable structure rather than polygon
density or historical precision.

This campaign is renderer-first. It deliberately excludes Drift City's driving
mechanics, collision, HUD, reset loop, and gameplay state.

## Non-Negotiables

- Faber/Triga own scene facts, camera state, geometry intent, material intent,
  and draw intent.
- Browser JavaScript owns WebGPU transport and lifecycle only.
- The scene must remain direct WebGPU; no Three.js runtime authority.
- Visual quality comes from rendering capabilities, not app-specific JS scene
  reconstruction.
- Acceptance claims require real browser evidence, not static file presence.

## Stage Plan

| Stage | Name | Exit |
| --- | --- | --- |
| 0 | Static Chain Bridge scaffold | Package builds; scene facts expose bridge/towers/chains/lions; direct WebGPU host mounts many static meshes. |
| 1 | Orbit camera evidence | Keyboard and pointer/orbit camera controls update Faber-owned transform facts; browser screenshot proves movement. |
| 2 | Materials and lighting | At least road/stone/metal/water/lamp material facts are typed and reflected; no flat color-only renderer claim. |
| 3 | Texture/sampler path | One licensed or generated texture flows through Triga/Radix reflection and host upload. |
| 4 | Asset/import pressure | One non-box decorative mesh, likely a stylized lion marker or lamp, enters via a documented asset pipeline. |
| 5 | Product renderer proof | Reflection-driven graphics pipeline replaces flat custom descriptor path; real-browser evidence captures final scene. |

## Initial Scene

- Danube river plane and embankments.
- Bridge deck and sidewalks.
- Two portal towers.
- Suspension chains and hangers.
- Rail posts and lamps.
- Four low-detail lion markers.
- Simple skyline blocks at each end.

## Open Questions

- Whether the first imported asset path should be a glTF/GLB subset or a
  Faber-authored packed mesh fixture.
- Whether material facts live first in Triga-only source or need immediate
  Radix reflection schema changes.
- Whether camera pointer/orbit controls should stay fully Faber-owned or use a
  generated host helper for raw pointer deltas.

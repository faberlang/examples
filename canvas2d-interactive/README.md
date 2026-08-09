# canvas2d-interactive — Unit 2 interactive fixture

End-to-end proof for `web:canvas2d` Unit 2 (`canvas2d-u2-paths-path2d-text`):
a Faber program compiled by the real compiler drives a pannable/zoomable
world grid with one draggable rectangle in a real browser, redrawn every
`on_frame` tick, verified by Playwright with real pointer/wheel events and
pixel readback.

## What the program does (`src/main.fab`)

| Behavior | Mechanism |
| --- | --- |
| Pan | pointer drag on empty space moves the camera (userland `screen = world * zoom + offset`; **no camera genus in the binding** — delivery non-goal) |
| Zoom | each wheel event multiplies `zoom` by a fixed 1.2 factor (see Zoom note) |
| Drag | pointer drag on the rectangle moves it (userland `point_in_rect` hit-test; **no hit-test genus in the binding** — delivery non-goal) |
| Redraw | the whole scene re-renders every `on_frame` callback; frame counter written to `data-frame-count` |

### Scene — every Unit 2 draw surface exercised

| Element | Binding calls |
| --- | --- |
| Grid (world 50-unit steps + origin axes) | `begin_path` + `move_to` + `line_to` + `stroke` |
| Clipped blue region (world box −200,−200…−120,−120) | `move_to`/`line_to`/`close_path` + `clip` + `fill_rect` |
| Green origin-circle marker | `arc` + `fill` |
| Steelblue ellipse west of origin | `ellipse` + `fill` |
| Gold Path2D star at world (150,−100) | `path2d_new_from_svg` + `path2d_fill` + `path2d_stroke` (under `save`/`translate`/`restore`) |
| Draggable rect + labels | `fill_rect` + `fill_text` with `set_font` / `set_text_align` / `set_text_baseline` |

## Assertions (`tests/interactive-test.mjs`)

Run in a real Chromium (Playwright) against a real canvas:

- **initial render** — pixel probes at every scene element's expected screen
  position (tomato rect, gold star, steelblue ellipse, green arc, blue clip
  region, white background)
- **drag** — pointer down on the rect, move +60,+60, up: rect interior
  tomato at the new position, old position no longer tomato, `data-rect-*`
  attrs read 60,60
- **pan** — pointer drag on empty space by +20,+10: `data-cam-*` attrs read
  340,250 and the rect's screen position shifts accordingly
- **zoom** — one `page.mouse.wheel` event: `data-zoom` reads 1.2, and a probe
  that was outside the rect at zoom 1 lands inside it at zoom 1.2 (pixel-proof
  that the scene scaled)
- **redraw** — the whole scene re-renders under the new transform (star /
  ellipse / arc / clip probes at their zoomed positions), and `data-frame-count`
  keeps advancing (the `on_frame` loop is live)

## Run

```sh
node tests/interactive-test.mjs
```

Requires: the faber CLI (`FABER` env or default
`../../faber/target/debug/faber`), the workspace `node_modules` (playwright),
and a global `typescript` module (resolved next to `node`). The fixture
`faber.lock` is regenerated with workspace paths, same as `web-canvas2d-smoke`
and `browser-app`.

For manual browser verification, open `pages/index.html` alongside the built
ESM and drag the rectangle, drag empty space, and scroll.

## Zoom note (honest userland limitation)

The `web:dom` binding surfaces no wheel delta (`PointerState`/`DomEvent`
carry no `delta_y`), so wheel direction is not readable from userland Faber.
The fixture therefore zooms **in by a fixed 1.2× factor per wheel event** —
the unit's done-when ("mouse wheel zooms") is met, but zoom-out is not
selectable until a consumer needs wheel-direction data in the binding
(deferred to Unit 3 / on-demand coverage).

## Packaging note (stale faber binary)

The running `faber` binary at `faber/target/debug/faber` predates hand-5's
`b7cc2e9` per-stem shim fix, so the browser product build's `tsc`
verification still fails for a second binding module: `[shims.canvas2d]`
(`runtime/canvas2d.ts`) is declared in `faber-web/bindings/ts.toml`, but the
current binary ignores it and emits the old single-shim facade (importing
`webCanvas2d*` from the dom shim). The test therefore snapshots the emitted
TypeScript from the build's staging directory before the tsc step fails and
wires the real `faber-web/runtime/*.ts` through a hand-written facade that
mirrors what the product generator emits (including the
`Canvas2dContext`/`Path2D` genus-value exports). Once `faber` is rebuilt from
`b7cc2e9`-and-newer, the product build should pass end-to-end and this
hand-written facade can be deleted.

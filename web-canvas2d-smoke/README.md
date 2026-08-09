# web-canvas2d-smoke — Unit 1 smoke fixture

End-to-end proof for `web:canvas2d` Unit 1 (core draw surface,
`canvas2d-u1-core-draw`): a Faber program compiled by the real compiler draws
a colored, rotated rectangle in a real browser canvas through the
`web:canvas2d` runtime, verified by pixel readback.

## What the program draws (`src/main.fab`)

| Step | Binding calls exercised |
| --- | --- |
| White background fill | `canvas2d_set_fill_style` + `canvas2d_fill_rect` |
| Blue filled rect (top-left) | `canvas2d_set_fill_style` + `canvas2d_fill_rect` |
| Green filled diamond around center | `canvas2d_translate` + `canvas2d_rotate` + `canvas2d_fill_rect` |
| Red stroked diamond | `canvas2d_set_stroke_style` + `canvas2d_stroke_rect` |
| Cleared patch (identity space) | `canvas2d_set_transform` + `canvas2d_clear_rect` |
| 1×1 probe filled blue | `canvas2d_set_fill_style` + `canvas2d_fill_rect` |

## Pixel readback assertions (`tests/smoke-test.mjs`)

Run in a real Chromium (Playwright) against a real canvas:

- probe 1×1 center — **non-white** (blue) — the required assertion
- stage center — green (translate + rotate + fill_rect landed)
- stage top-left — blue (fill_rect landed)
- rotated red stroke locus — red (stroke_rect landed)
- clear patch — transparent (clear_rect landed)

## Run

```sh
node tests/smoke-test.mjs
```

Requires: the faber CLI (`FABER` env or default
`../../faber/target/debug/faber`), the workspace `node_modules` (playwright),
and a global `typescript` module (resolved next to `node`). The fixture
`faber.lock` is regenerated with workspace paths, same as `browser-app`.

## Packaging gap this unit surfaced (honest note)

The smoke test cannot use `faber build --package .`'s output directly. The
browser product build compiles `src/main.fab` to TypeScript correctly, but its
own `tsc` verification cannot pass for a second binding module:

1. **Single shim per package.** `faber-web/bindings/ts.toml` declares one
   `[shim]` (`runtime/dom.ts`). The product build copies that one file as the
   package's runtime shim and generates a `web:canvas2d` facade importing
   `webCanvas2d*` symbols from it — symbols the dom shim does not export.
2. **Facade type/value exports.** The generated facade re-exports genus values
   (`Canvas2dContext`) only for the `dom` module (`DOM_TYPE_ALIASES`
   special-case in `faber/src/package/product/ts_emit.rs`); the emitted app
   code imports `Canvas2dContext` as a value from the canvas2d facade, so tsc
   fails for any app that holds a `Canvas2dContext`.

Both fixes belong to the faber packaging (faber repo), outside this unit's
write scope. The harness therefore snapshots the emitted TypeScript from the
build's staging directory before the tsc step fails, wires the real
`runtime/canvas2d.ts` through a facade that mirrors the product generator's
output, and runs the assertions in a real browser. The emitted `main.ts` is
genuine compiler output; nothing is hand-written except the thin module
facade, which is exactly what the product generator would produce once the
packaging gap closes.

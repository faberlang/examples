# Browser Application Fixture (WEB5)

Proof-of-concept static site proving Faber-compiled ESM controllers produce
observable DOM mutations under a browser/DOM harness.

## Controllers

| Controller | Selector | Behavior |
| --- | --- | --- |
| `toggle_controller` | `#toggle-demo` | Click button → toggle `active` class on label |
| `filter_controller` | `#filter-demo` | Input → add/remove `hidden` class on list items |
| `submit_controller` | `#submit-demo` | Submit form → set status text, prevent default |
| `frame_controller` | `#frame-demo` | Animation frame → set status text/class; generated dispose cancels scheduling |
| `resize_controller` | `#resize-demo` | Initial and dispatched resize → set status text/class; generated dispose removes listener |

## Build

```sh
# From examples/browser-app/
../../faber/target/debug/faber build --package .
```

Output: `dist/faber-esm/faber-browser.js` (ESM entry), `dist/controllers.json`,
`dist/index.html` (from `pages/`), `dist/styles/` (from `styles/`).

## Test

```sh
./tests/run.sh
```

Builds the product and runs a Node.js DOM harness that imports the built ESM,
mounts controllers against a fake DOM, simulates events, and asserts mutations.

## Architecture

- **Faber source** (`src/main.fab`) defines five `@ WebController` functions.
- Radix compiles each to TypeScript; faber product packaging invokes `tsc` to
  produce browser ESM and writes `controllers.json`.
- The built ESM imports `{ dom }` from `"web:dom"` and `{ web }` from
  `"web:web"` — bare specifiers resolved by the test harness to a runtime
  bridge that delegates to a fake DOM.

### Known codegen gap

The Radix TypeScript backend does not yet `await` `@ futura` calls inside
`fac`/`cape` blocks. `dom.fetch_text` success and failure are therefore
exercised at the runtime-bridge level in the harness, not from the Faber
controller body. When the async codegen gap closes, the submit controller can
be extended to call `dom.fetch_text` directly.

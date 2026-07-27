# TypeScript → HIR examples (intake corpus)

**Campaign**: radix `docs/factory/typescript-to-hir/`  
**Purpose**: committed TypeScript programs for Stage 6+ intake (check / convert), not HIR→TS emit.

## Profile (v1)

Static ESM application surface: functions, classes, control flow, collections, `console.*`, `process.argv` / `process.exit(0)`, `Math.*`, `JSON.*`.  
No DOM, React, CJS, npm deps, dynamic `import()`, async/await, or `fs` (except **neg-fs**, which is intentionally fenced).

## Programs

| Dir | Role | Oracle (manual / later harness) |
| --- | --- | --- |
| `fib/` | **Spike starter** (C10) | `npx tsx fib/index.ts 10` → `55` |
| `jsonfmt/` | JSON pretty-print (C1) | stdin JSON → pretty JSON |
| `wc-ts/` | word/line/char counts (C2) | stdin text → counts |
| `calc/` | CLI calculator (C3) | `calc/index.ts "2 + 3 * 4"` → `14` |
| `base64/` | encode/decode (C9) | encode/decode round-trip |
| `neg-fs/` | **Negative** (C11) | must get `TS-FENCE-*` under check; uses `fs` + CJS |

## Run (Node, for authoring only)

```bash
cd examples/typescript-to-hir
npx --yes tsc -p tsconfig.json   # typecheck only (needs @types/node)
npx --yes tsx fib/index.ts 10
```

Intake validation will be owned by the future TS→HIR driver; these files are the fixtures.

## Notes

- Keep programs small and dependency-free.
- Prefer constructs that score `maps` / `desugars` in the construct matrix.
- Expand with more corpus IDs only when they stay in-profile.

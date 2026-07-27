# Oracles for typescript-to-hir examples

| Program | Command | Expected |
| --- | --- | --- |
| fib | `tsx fib/index.ts 10` | stdout `55` + exit 0 |
| fib | `tsx fib/index.ts 0` | stdout `0` |
| jsonfmt | `tsx jsonfmt/index.ts '{"a":1}'` | pretty JSON with `"a": 1` |
| jsonfmt | `tsx jsonfmt/index.ts not-json` | exit 1, stderr `invalid JSON` |
| wc-ts | `tsx wc-ts/index.ts $'hello world\nfoo'` | lines/words/chars TSV |
| calc | `tsx calc/index.ts 2 + 3` | `5` |
| calc | `tsx calc/index.ts sqrt 16` | `4` |
| calc | `tsx calc/index.ts 1 / 0` | exit 1, division by zero |
| base64 | `tsx base64/index.ts encode hello` | `aGVsbG8=` |
| base64 | `tsx base64/index.ts decode aGVsbG8=` | `hello` |
| neg-fs | (check lane only) | must emit fence codes for `fs` / CJS; not a convert target |

Authoring smoke (optional): `npx tsx <entry> ...` under Node. Product gate is future intake driver.

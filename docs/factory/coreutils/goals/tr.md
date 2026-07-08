# Goal: coreutils — `tr`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/tr/`

## Utility

GNU coreutils `tr` — Stage 4 stdin-only ASCII stepper slice.

## Objective

Implement a Faber package that matches GNU `tr` for declared stdin fixtures:
ASCII transliteration from SET1 to SET2, deletion with `-d SET1`, squeezing
repeated SET1 characters with `-s SET1`, simple range expansion for `a-z`,
`A-Z`, and `0-9`, and repeated use of a single SET2 replacement character for a
longer SET1. In transliteration mode, `-t SET1 SET2` truncates expanded SET1 to
the expanded SET2 length before mapping, so unmatched SET1 tail characters pass
through unchanged.

## Deliverables

- `examples/coreutils/packages/tr/faber.toml`
- `examples/coreutils/packages/tr/src/main.fab`
- `examples/coreutils/harness/fixtures/tr/cases.toml`
- Inline `probandum` / `proba` coverage for pure set expansion and line
  transformation helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin transliteration `SET1 SET2` | slice | pending | Reads nullable `lege` until EOF |
| range expansion `a-z` | slice | pending | ASCII lowercase only |
| range expansion `A-Z` | slice | pending | ASCII uppercase only |
| range expansion `0-9` | slice | pending | ASCII digits only |
| single SET2 char repeated for longer SET1 | slice | pending | Example: `0-9` to `#` |
| truncate-set1 / `-t` | slice | pending | Transliteration mode only; SET1 tail passes through |
| delete `-d SET1` | slice | pending | Removes SET1 chars from each stdin line |
| squeeze `-s SET1` | slice | pending | Collapses repeated SET1 chars per line |
| multiple stdin lines | slice | pending | Emits one output line per input line |
| complement sets | no | pending | Deferred GNU surface |
| character classes / equivalence classes | no | pending | Deferred GNU surface |
| escape sequences | no | pending | Only plain literals and declared ranges |
| zero-terminated records | no | pending | Deferred `-z` semantics |
| diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |
| multibyte semantics | no | pending | This slice is ASCII-only |

## Unsupported-in-stepper policy

This slice is stdin-only, line-oriented, and ASCII-only. It intentionally avoids
complement sets, character classes, equivalence classes, escape handling beyond
plain literal text and the declared ranges, zero-terminated records,
diagnostics, help/version output, file inputs, and multibyte semantics. Fixtures
use only valid in-scope forms: `tr SET1 SET2`, `tr -t SET1 SET2`, `tr -d SET1`,
and `tr -s SET1`.

`lege` returns `textus ∪ nihil`; EOF stops processing without producing a
synthetic final line. Each input line is transformed independently and emitted
with the harness newline writer. This means squeeze state does not cross line
boundaries in the Stage 4 contract.

## Acceptance

- `faber check examples/coreutils/packages/tr` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/tr`.
- `./scripta/check-coreutils-parity tr --backend stepper` passes declared
  Stage 4 fixtures against GNU `gtr`.

## Validation

```bash
cargo run -q -p faber-cli -- format examples/coreutils/packages/tr/src/main.fab
timeout 120 cargo run -p faber-cli -- check examples/coreutils/packages/tr
timeout 120 cargo run -p faber-cli -- test examples/coreutils/packages/tr
timeout 120 ./scripta/check-coreutils-parity tr --backend stepper
git diff --check
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for declared range expansion, lowercase-to-uppercase
  transliteration, single-character replacement repetition, `-t` truncation,
  deletion, and squeezing.
- parity fixtures for lowercase to uppercase, digit replacement with one
  character, truncate-set1 behavior, deleting `a`, squeezing `a`, and preserving
  newline behavior across multiple stdin lines.

Remaining unsupported GNU surfaces: complement sets, character classes,
equivalence classes, escapes beyond plain literals/ranges, zero-terminated
records, diagnostics, help/version, multibyte semantics, and Rust ship
validation.

## Lowers from

Campaign Stage 4.

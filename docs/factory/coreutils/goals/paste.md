# Goal: coreutils — `paste`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/paste/`

## Utility

GNU coreutils `paste` — Stage 4 stdin-only stepper slice.

## Objective

Implement a Faber package that matches GNU `gpaste` for declared stdin
fixtures: default single-stream stdin passthrough, blank line preservation,
serial mode with `-s` joining all stdin lines with tabs, and serial mode with
`-s -d DELIMS` cycling ASCII delimiter scalars between stdin records.

## Deliverables

- `coreutils/packages/paste/faber.toml`
- `coreutils/packages/paste/src/main.fab`
- `coreutils/harness/fixtures/paste/cases.toml`
- Inline `probandum` / `proba` coverage for pure delimiter and serial joining
  helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| default stdin passthrough | slice | pending | Reads nullable `lege` until EOF |
| blank stdin lines | slice | pending | Empty input records emit empty output lines |
| empty stdin | slice | pending | Emits no synthetic output |
| serial `-s` | slice | pending | Joins all stdin lines into one output line |
| default serial delimiter | slice | pending | Uses a tab between records |
| serial `-s -d DELIMS` | slice | pending | Cycles ASCII scalars from `DELIMS` between records |
| serial `-s -d ''` | slice | pending | Empty delimiter sequence emits no separators |
| multiple files / streams | no | pending | Deferred source adapter work |
| delimiter escapes | no | pending | No `\n`, `\t`, `\0`, or GNU escape decoding |
| zero-terminated records | no | pending | Deferred `-z` semantics |
| diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |
| missing-final-newline byte parity | no | pending | Stepper works with line records |
| multibyte/display semantics | no | pending | Fixtures are ASCII |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids multiple
files or streams, delimiter escape decoding, zero-terminated records,
diagnostics, help/version output, byte-exact missing-final-newline behavior,
and multibyte/display semantics. Fixtures use only valid in-scope forms:
`paste`, `paste -s`, `paste -s -d ,`, `paste -s -d ,;`, and `paste -s -d ''`.

`lege` returns `textus ∪ nihil`; EOF stops default passthrough without producing
a synthetic final line. Serial mode buffers stdin line records and emits a
single joined line only when at least one input line was read, so empty stdin
matches GNU `gpaste` by producing no output.

## Acceptance

- `faber check coreutils/packages/paste` passes.
- Inline package tests pass through `faber test coreutils/packages/paste`.
- `./scripta/check-coreutils-parity paste --backend stepper` passes declared
  Stage 4 fixtures against GNU `gpaste`.

## Validation

```bash
cargo run -q --manifest-path ../faber/Cargo.toml -- format coreutils/packages/paste/src/main.fab
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- check coreutils/packages/paste
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- test coreutils/packages/paste
timeout 120 ./scripta/check-coreutils-parity paste --backend stepper
git diff --check
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for default tab delimiter selection, empty delimiter
  selection, delimiter scalar cycling, serial delimiter joining, and
  blank-record preservation in serial helper logic.
- parity fixtures for empty stdin, default single-stream passthrough, blank
  line preservation, `-s` tab joining, `-s -d ,` comma joining, `-s -d ,;`
  delimiter cycling, and `-s -d ''` empty-delimiter joining.

Remaining unsupported GNU surfaces: multiple files or streams, delimiter
escapes, zero-terminated records, diagnostics, help/version,
byte-exact missing-final-newline behavior, multibyte/display semantics, and
Rust ship validation.

## Lowers from

Campaign Stage 4.

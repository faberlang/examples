# Goal: coreutils — `sort`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/sort/`

## Utility

GNU coreutils `sort` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `sort` for declared stdin fixtures:
default keyless lexicographic ordering over newline-terminated ASCII lines,
with `-r` reverse ordering, `-u` duplicate removal over sorted output, and
GNU `-f` fold-case comparison over ASCII lines under `LC_ALL=C`.

## Deliverables

- `examples/coreutils/packages/sort/faber.toml`
- `examples/coreutils/packages/sort/src/main.fab`
- `examples/coreutils/harness/fixtures/sort/cases.toml`
- Inline `probandum` / `proba` coverage for pure line sorting helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin keyless default sort | slice | pending | Reads nullable `lege` until EOF |
| duplicate line preservation | slice | pending | Default mode preserves duplicate lines |
| `-u` unique sorted lines | slice | pending | Removes adjacent duplicates after sorting |
| `-r` reverse ordering | slice | pending | Reverses the sorted result |
| combined `-r -u` | slice | pending | Deduplicates sorted lines, then reverses |
| `-f` fold-case ordering | slice | pending | Compares ASCII lowercase keys, then original text |
| combined `-f -u` | slice | pending | Keeps one representative per folded key for declared stdin fixtures |
| combined `-f -r` | slice | pending | Reverses folded ordering |
| blank line preservation | slice | pending | Blank lines sort before nonblank ASCII lines |
| multiple stdin lines | slice | pending | Emits all sorted lines through `scribe_linea` |
| file operands | no | pending | Deferred source adapter work |
| key fields / `-k` | no | pending | Deferred GNU field semantics |
| numeric, month, version, random sorts | no | pending | Deferred comparator families |
| locale collation | no | pending | This slice is ASCII-only |
| stable / merge / check modes | no | pending | Deferred option surface |
| invalid option diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, key fields, numeric/month/version/random comparator families, locale
collation beyond ASCII `LC_ALL=C` fixtures, stable/merge/check modes,
diagnostics, and help/version output. Fixtures are newline-terminated ASCII
cases that the stepper can honestly compare against GNU `gsort`. Supported
options are limited to `-r`, `-u`, and `-f`.

`lege` returns `textus ∪ nihil`; EOF stops collection without producing a
synthetic final line. The implementation stores each input line, sorts the
resulting `lista<textus>` with the compiler-owned default ordering, optionally
removes adjacent duplicates from that sorted list for `-u`, optionally reverses
for `-r`, and emits each line with the harness newline writer. For `-f`, a small
package-local insertion sort compares ASCII lowercase fold keys and uses the
original text as the tie-breaker. For the declared `-f -u` fixture, the package
keeps the first input representative for each folded key, then sorts those
representatives by the folded comparison. The Stage 4 contract is ASCII only;
non-ASCII collation is not claimed.

## Acceptance

- `faber check examples/coreutils/packages/sort` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/sort`.
- `./scripta/check-coreutils-parity sort --backend stepper` passes declared
  Stage 4 fixtures against GNU `gsort`.
- `faber format --check examples/coreutils/packages/sort/src/main.fab` passes.

## Validation

```bash
faber check examples/coreutils/packages/sort
faber test examples/coreutils/packages/sort
./scripta/check-coreutils-parity sort --backend stepper
faber format --check examples/coreutils/packages/sort/src/main.fab
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for empty input, already sorted input, unsorted ASCII
  input, duplicate preservation, and blank-line ordering in pure helper logic.
- parity fixtures for empty stdin, already sorted lines, unsorted lines,
  duplicates, and blank lines.

Follow-on stepper slice adds:

- inline `proba` coverage for reverse ordering, unique duplicate removal, and
  combined reverse+unique ordering.
- parity fixtures for `-r`, `-u`, and combined `-r -u` over stdin ASCII input.

Fold-case stepper slice adds:

- inline `proba` coverage for ASCII fold-case ordering, `-f -u`
  representative selection for the declared GNU fixture, and `-f -r` reverse
  folded ordering.
- parity fixtures for `-f`, `-f -u`, and `-f -r` over stdin ASCII input under
  `LC_ALL=C`.

Remaining unsupported GNU surfaces: file operands, key fields, non-default sort
families, locale collation beyond ASCII fixtures, stable/merge/check modes,
diagnostics, help/version, and Rust ship validation.

## Lowers from

Campaign Stage 4.

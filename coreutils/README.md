# Coreutils Application Exempla

Faber re-implementations of GNU coreutils for **application-lane** proof, not as
a replacement binary distribution.

**Campaign control plane:** [`docs/factory/coreutils/CAMPAIGN.md`](../docs/factory/coreutils/CAMPAIGN.md)

## Purpose

- Demonstrate Faber building real CLI programs (argv, stdio, exit codes, host I/O)
- Verify behavior against host GNU utilities via the parity harness
- Stay separate from syntax exempla in `crates/exempla/corpus/`

## Layout

```text
examples/coreutils/
  README.md                 # this file
  common/
    gnu/                    # shared pure Faber (argv, format, parse) — Stage 2+
  packages/
    <utility>/              # one Faber package per GNU binary
      faber.toml
      src/
        main.fab
  harness/
    fixtures/
      <utility>/
        cases.toml          # parity cases — see parity-contract.md
```

## DevCycle (inner loop)

```bash
faber check examples/coreutils/packages/<utility>
faber test examples/coreutils/packages/<utility>
faber format examples/coreutils/packages/<utility>/src/main.fab
faber run --interpret examples/coreutils/packages/<utility> -- <args>
./scripta/check-coreutils-parity <utility> --backend stepper
```

Example package sources should include concise line-start `#` comments for the
Faber constructs and utility-slice boundaries that readers need to understand.

Ship milestone (per utility):

```bash
faber build examples/coreutils/packages/<utility>
./scripta/check-coreutils-parity <utility> --backend rust
```

## Documentation

| Doc | Role |
| --- | --- |
| [`CAMPAIGN.md`](../docs/factory/coreutils/CAMPAIGN.md) | Routing, stages, dependencies |
| [`ledger.md`](../docs/factory/coreutils/ledger.md) | Per-utility status |
| [`parity-contract.md`](../docs/factory/coreutils/parity-contract.md) | Fixture format, lanes |
| [`goals/_template.md`](../docs/factory/coreutils/goals/_template.md) | Factory goal template |

## Status

Stage 1 (scaffold + `true`/`false`) is complete. Stage 2 has the first shared
`common/gnu/*` helpers and inline `proba` package tests. Stage 3 has initial
`echo`, `basename`, `dirname`, `printf`, and `seq` stepper slices plus follow-on
option, formatting, range, and path normalization coverage. Stage 4 has
nullable-stdin slices for `cat`, `head`, `tail`, `wc`, `tac`, `uniq`, `fold`,
`nl`, `expand`, `unexpand`, `sort`, `cut`, `grep`, `tr`, `tee`, and `paste`;
continue from
[`CAMPAIGN.md`](../docs/factory/coreutils/CAMPAIGN.md).

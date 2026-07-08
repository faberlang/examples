# Goal: coreutils — `false`

**Status**: stepper-complete
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Tier 0
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/false/`

## Utility

GNU coreutils `false` — Tier A stepper slice.

## Objective

Implement `false` as a Faber package that exits `1`.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| no-op exit failure | yes | pending | Tier A |

## Acceptance

- Stepper fixtures pass through `./scripta/check-coreutils-parity false --backend stepper`.
- Inline package tests pass through `faber test coreutils/packages/false`.
- Rust ship gate remains a later milestone.

## Validation

```bash
faber check coreutils/packages/false
faber test coreutils/packages/false
faber run --interpret coreutils/packages/false
./scripta/check-coreutils-parity false --backend stepper
```

## Lowers from

Campaign Stage 1.

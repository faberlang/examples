# Goal: coreutils — `true`

**Status**: stepper-complete
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Tier 0
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/true/`

## Utility

GNU coreutils `true` — Tier A stepper slice.

## Objective

Implement `true` as a Faber package that exits `0` and ignores operands like GNU
`gtrue`.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| no-op exit success | yes | pending | Tier A |
| ignore extra args | yes | pending | GNU-compatible |

## Acceptance

- Stepper fixtures pass through `./scripta/check-coreutils-parity true --backend stepper`.
- Inline package tests pass through `faber test examples/coreutils/packages/true`.
- Rust ship gate remains a later milestone.

## Validation

```bash
faber check examples/coreutils/packages/true
faber test examples/coreutils/packages/true
faber run --interpret examples/coreutils/packages/true
./scripta/check-coreutils-parity true --backend stepper
```

## Lowers from

Campaign Stage 1.

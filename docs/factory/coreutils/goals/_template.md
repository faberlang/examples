# Goal: coreutils — `<utility>`

**Status**: planned
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § `<section>`
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Factory artifact dir**: `docs/factory/coreutils/`
**Primary surfaces**: `coreutils/packages/<utility>/`

---

## Utility

GNU coreutils `<utility>` — man section N, parity tier target **A** (list B/C
out-of-scope below).

## Objective

Implement `<utility>` as a Faber package that matches GNU behavior for the
declared capability slices.

## Deliverables

- `coreutils/packages/<utility>/faber.toml`
- `coreutils/packages/<utility>/src/main.fab` (+ modules as needed)
- `coreutils/harness/fixtures/<utility>/cases.toml`
- `proba` blocks for extractable pure logic (optional)
- Imports from `coreutils/common/gnu/*` where applicable

## Package layout

```text
coreutils/packages/<utility>/
  faber.toml
  src/
    main.fab       # @ cli, incipit argumenta, dispatch
    core.fab       # pure logic (optional)
    source.fab     # stdin vs file adapters (optional)
```

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| (fill per utility) | yes/no | yes | |

## Unsupported-in-stepper policy

- Flags blocked in stepper: (list)
- Runtime behavior: diagnostic + non-zero exit (prefer `2` for usage)
- Fixtures: no `lane = stepper` case may require blocked actions

## DevCycle (mandatory)

```bash
faber check coreutils/packages/<utility>
faber run --interpret coreutils/packages/<utility> -- <args>
./scripta/check-coreutils-parity <utility> --backend stepper
# closeout only:
faber build coreutils/packages/<utility>
./scripta/check-coreutils-parity <utility> --backend rust
```

## Host imports

> **One-source rule (resolved):** utility source imports `norma:*` for both
> lanes — interpreted package execution bridges `norma:*` to the stepper
> kernels (Stage 1b, owned by `faber-script-runtime`), and compiled package
> execution uses the normal `norma` Rust backing. `faber:*` is the direct
> script/kernel namespace, not a package dialect. Do not add lane-conditional
> or paired `faber:*`/`norma:*` imports. Until Stage 1b lands, keep file reads
> on `lane = rust` fixtures only.

| Lane | Import surface |
| --- | --- |
| Both (interpreted + compiled) | `norma:solum`, `norma:processus` |
| Pure shared | `../../common/gnu/*` relative imports |

Until Stage 1b: keep file reads on `lane = rust` fixtures only.

## Acceptance

### Stepper-complete

- All `lane = stepper`, `tier = A` fixtures pass
- `faber check` clean
- Ledger updated: stepper = `complete` or `slice`

### Ship-complete

- All `tier = A` fixtures pass (`--backend all`)
- `faber build` succeeds
- Ledger updated: ship = `complete` or `slice`

## Out of scope (this goal)

- Tier B/C flags: (list)
- Locale-specific behavior: (list)
- (other)

## Blockers

- [ ] (none, or link to prerequisite goal)

## Validation

```bash
faber check coreutils/packages/<utility>
faber run --interpret coreutils/packages/<utility> -- ...
./scripta/check-coreutils-parity <utility> --backend stepper
```

Ship:

```bash
faber build coreutils/packages/<utility>
./scripta/check-coreutils-parity <utility> --backend rust
```

## Lowers from

Campaign Stage N, ledger row `<utility>`.
# Stage 1: Coreutils Scaffold + Parity Harness v0

**Status**: complete (2026-07-07)
**Campaign**: [`CAMPAIGN.md`](CAMPAIGN.md) Stage 1
**Created**: 2026-07-06
**Target repo**: `/Users/ianzepp/work/faberlang/examples`
**Factory artifact dir**: `docs/factory/coreutils/`
**Primary surfaces**: `coreutils/`, `scripta/check-coreutils-parity`,
`crates/exempla/corpus/applications/`

**Related**: [`parity-contract.md`](parity-contract.md), [`ledger.md`](ledger.md)

---

## Objective

Establish the coreutils application workspace, parity harness, and first two
utilities (`true`, `false`) with stepper-complete Tier A fixtures. Prove the
stepper-first DevCycle before scheduling further utilities.

## Non-goals

- `common/gnu/*` substrate (Stage 2; now landed as follow-on)
- `faber build` / Rust ship gate for `true`/`false` (optional stretch)
- Stage 1b package MIR kernel bridge
- Full GNU utility inventory implementation

## Deliverables

### 1. Workspace layout

Create directory tree per [`coreutils/README.md`](../../../coreutils/README.md):

```text
coreutils/
  README.md
  common/gnu/          # empty placeholder until Stage 2
  packages/
    true/
    false/
  harness/
    fixtures/
      true/cases.toml
      false/cases.toml
```

### 2. Packages `true` and `false`

Each package:

```toml
[package]
name = "true"   # or "false" — matches GNU binary name
version = "0.1.0"
edition = "2026"

[paths]
source = "src"
entry = "main.fab"

[build]
target = "rust"
kind = "bin"
```

`main.fab` requirements:

- `@ cli` root with utility name
- `@ descriptio` noting GNU parity exemplum
- `incipit argumenta args` — ignore unknown flags for Tier A or match GNU usage
- `true`: `incipit argumenta args exitus 0 { }`
- `false`: `incipit argumenta args exitus 1 { }`
- No `norma:*` or `faber:*` imports required — exit via the `exitus` keyword
  modifier (`incipit argumenta args exitus <int> { }`; see
  `crates/exempla/corpus/exitus/exitus.fab`; package MIR honors `CliExit::Fixed`)

Verify package MIR path:

```bash
faber check coreutils/packages/true
faber run --interpret coreutils/packages/true
faber run --interpret coreutils/packages/false
```

### 3. Parity fixtures

`harness/fixtures/true/cases.toml` and `false/cases.toml` per
[`parity-contract.md`](parity-contract.md). Minimum cases:

| Utility | id | exit |
| --- | --- | --- |
| `true` | `exit-zero` | 0 |
| `true` | `ignore-extra-args` | 0 with `args = ["--", "x"]` if GNU accepts |
| `false` | `exit-one` | 1 |

All cases: `lane = "stepper"`, `tier = "A"`.

### 4. Harness script

`scripta/check-coreutils-parity`:

- Args: `<utility> [--backend stepper|rust|all] [--tier A] [--case <id>]`
- Stepper backend: `faber run --interpret coreutils/packages/<utility> --`
- GNU baseline: explicit `g<utility>` (keg-only; never `command -v`, which
  resolves shell builtins or BSD — see parity contract) with same
  args/stdin/env/cwd
- Compare stdout, stderr, exit per parity contract
- `rust` backend: `faber build` + run binary (may stub as "not implemented" for
  Stage 1 if build not required for closeout)
- Exit non-zero on mismatch; print case id and diff

Stage 1 closeout requires `--backend stepper` green for `true` and `false`.

### 5. Applications pointer exemplum

`crates/exempla/corpus/applications/coreutils.fab`:

- `+++` frontmatter: `term = "applications"`, meta/kind appropriate for pointer
- Body explains application exempla live in `coreutils/`
- Links campaign path `docs/factory/coreutils/CAMPAIGN.md`
- Runnable smoke: `incipit { nota "coreutils application exempla" }`

Regenerate exempla index:

```bash
python3.11 scripta/generate-exempla-index.py
```

### 6. Factory goals for utilities

Copy template to:

- `docs/factory/coreutils/goals/true.md`
- `docs/factory/coreutils/goals/false.md`

Fill capability matrices (minimal). Mark ship-complete as optional stretch.

## Acceptance criteria

- [x] Layout exists under `coreutils/`
- [x] `true` and `false` packages pass `faber check`
- [x] `faber run --interpret` exits 0/1 respectively with no args
- [x] `./scripta/check-coreutils-parity true --backend stepper` passes all Tier A cases
- [x] `./scripta/check-coreutils-parity false --backend stepper` passes all Tier A cases
- [x] `applications/coreutils.fab` indexed in `corpus/index.toml`
- [x] [`ledger.md`](ledger.md) updated: infrastructure + `true`/`false` stepper = `complete`
- [x] [`CAMPAIGN.md`](CAMPAIGN.md) Stage 1 status → complete with evidence

## Completion evidence

```text
faber check coreutils/packages/true: ok
faber check coreutils/packages/false: ok
faber run --interpret coreutils/packages/true: exit 0
faber run --interpret coreutils/packages/false: exit 1
check-coreutils-parity true --backend stepper: 2/2 pass
check-coreutils-parity false --backend stepper: 2/2 pass
```

## DevCycle (locked for campaign)

```bash
faber check coreutils/packages/<util>
faber run --interpret coreutils/packages/<util> -- <args>
./scripta/check-coreutils-parity <util> --backend stepper
```

## Validation

```bash
faber check coreutils/packages/true
faber check coreutils/packages/false
faber run --interpret coreutils/packages/true
faber run --interpret coreutils/packages/false
./scripta/check-coreutils-parity true --backend stepper
./scripta/check-coreutils-parity false --backend stepper
python3.11 scripta/generate-exempla-index.py
rg -n "applications/coreutils" crates/exempla/corpus/index.toml
```

Optional stretch:

```bash
faber build coreutils/packages/true
./scripta/check-coreutils-parity true --backend rust
```

## Open decisions (resolve in implementation)

| Decision | Proposal |
| --- | --- |
| Binary name | `package.name` = `true` / `false` (GNU names) |
| Rust Stage 1 | Optional; stepper-only closeout is sufficient |

Exit surface is settled: the `exitus` keyword modifier (see §2).

## Lowers from

Campaign Stage 1 → factory execution.

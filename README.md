# Faber examples

Public Faber language corpus, named tracks, and application packages.

## Layout

```text
corpus/          Keyword / language reference (faber explain source)
gpu-workload/    GPU systems workload rungs
air/             AIR lane demos
script-kernel/   faber:* script-kernel demos
coreutils/       GNU coreutils reimplementation (application campaign)
automation/      automation sketch packages
reader-locale/   locale pack demos
fixtures/        boundary fixtures used by tooling tests
cista-lab/       package-store lab material
```

Norma stdlib tours live in the sibling **`norma/exempla/`** tree, not here.
The private Radix `crates/exempla` crate owns harnesses only and resolves these
paths at runtime.

## Requirements

- A built `faber` tool (from the public `faber` repo or a private org build)
- Sibling Norma library home (`FABER_LIBRARY_HOME` or `faberlang/norma`)

## Local layout

```text
faberlang/
  faber/      public CLI
  norma/      public stdlib
  examples/   this repo
  radix/      private compiler (optional for consuming prebuilt faber)
```

## Coreutils parity

Parity fixtures live under `coreutils/harness/fixtures/`. Campaign control plane:
[`docs/factory/coreutils/CAMPAIGN.md`](docs/factory/coreutils/CAMPAIGN.md).
The parity harness script lives in private Radix `scripta/`; invoke `faber`
against packages here and the sibling radix script when developing
compiler-side gates.

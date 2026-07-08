# Faber examples

Public Faber application examples and demos.

This repository is the home for runnable Faber packages that are not the
language syntax corpus (`exempla` inside the private Radix compiler tree).

## Layout

```text
coreutils/       GNU coreutils reimplementation (application exempla campaign)
automation/      automation sketch packages
reader-locale/   locale pack demos
fixtures/        boundary fixtures used by tooling tests
cista-lab/       package-store lab material
```

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

Parity fixtures live under `coreutils/harness/fixtures/`. The harness script
historically lived in Radix `scripta/`; prefer invoking `faber` against packages
here and the sibling radix script when developing compiler-side gates.

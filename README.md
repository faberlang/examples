# Faber examples

Public application packages, tracks, and package-shaped fixtures.

Language keyword exempla live in the sibling private **`radix/corpus/`** tree
(see `radix/docs/factory/corpus-split-radix-faber`).

## Layout

```text
corpus/            Redirect stub only (language → radix/corpus; packages → faber/corpus)
gpu-workload/      GPU systems workload rungs
hello-voxel/       Direct WebGPU campaign application scaffold
triga-budapest/    Static Chain Bridge renderer-completeness showcase
triga-drift-city/  Arcade driving workload and direct-WebGPU game capstone
browser-app/       Browser WEB5 application fixture (WebController ESM demos)
conversio-matrix/  Type conversion matrix (conversion pair exempla)
ai-workbench/      AI workbench evidence maps and oracle fixtures
typescript-to-hir/ TypeScript intake corpus for HIR conversion work
air/               AIR lane demos
script-kernel/     faber:* script-kernel demos
coreutils/         GNU coreutils reimplementation (application campaign)
automation/        automation sketch packages
training/          Training and FMIR workload examples (incl. `training/device-summa/` — differentiable-GPU S1-6 vertical-slice proof: one tree-reduction kernel through Metal/CUDA device execution with pinned CPU oracle references; and `training/device-summa-recollige/` — the S2-5 ordinary two-kernel fixture: two dependent tree reductions sharing a device-resident intermediate). `training/mlp/` (100-step) and `training/bert-tiny-fragment/` (8-step) are the **Stage 7 release-candidate fixtures**: compiled self-contained FMIR packages with device payloads, proven at RC level (faber `1.6.0-rc.1`, pinned revisions) on burgus (Metal, Apple M5 Max) and pharos (CUDA, NVIDIA RTX 5070) by the E6/E7 receipts — all numeric-policy v1.0.0 rows PASS. RC-local posture: no E8/stable claim.
reader-locale/     Locale pack demos
vivilite/          ViviLite mailspace application
sqlite/            SQLite runtime bindings
arena-handle/      Arena handle exempla
generated-backward/ Generated-backward compatibility fixture
fixtures/          Boundary fixtures used by tooling tests
cista-lab/         Package-store lab material
scripta/           Check scripts and verifiers
docs/              Factory campaign documentation
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

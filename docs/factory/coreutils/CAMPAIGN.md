# Campaign: Coreutils Application Exempla

**Status**: active (opened 2026-07-06; long-lived)
**Mode**: routing artifact — does not implement code directly
**Target repo**: `/Users/ianzepp/work/faberlang/examples`
**Primary surfaces**: `coreutils/` (this repo), `docs/factory/coreutils/`,
sibling radix `scripta/check-coreutils-parity`, sibling radix
`crates/exempla/corpus/applications/` (pointer layer only)

## Summary

This campaign coordinates re-implementation of GNU coreutils as Faber application
packages. Each utility is a runnable binary with GNU argv and I/O behavior,
verified against the host-installed baseline. The work is **application exempla**:
it proves Faber can build real CLI programs, not syntax tutorials.

The syntax corpus (`crates/exempla/corpus/`) stays focused on language constructs.
Coreutils lives under `examples/coreutils/` as a package workspace with a
stepper-first DevCycle and a Rust ship gate.

## Problem

The exempla corpus demonstrates syntax and compiler surfaces well. It does not
demonstrate that Faber can sustain a large family of real command-line
applications with:

- structured argv (`@ cli`, `@ optio`, operands, rest args);
- stdin/stdout/stderr and exit-code contracts;
- file and process host effects through `norma:*` (ship) and `faber:*` (dev);
- behavioral parity against a known external baseline (GNU coreutils).

Without a dedicated campaign, agents may scatter application examples into the
keyword exempla tree, mix stdlib work with application work, or default to slow
Cargo builds for every edit.

## Desired End State

- `examples/coreutils/` holds one Faber package per utility plus shared
  `common/gnu/*` pure modules.
- Pure utility logic is covered by inline `proba` / `probandum` blocks in the
  package `.fab` files; separate `.proba` files are deferred until package
  discovery supports that convention.
- Every scheduled utility has a ledger row, a factory goal, and a fixture set
  with explicit `lane` tags (`stepper` vs `rust`).
- Inner DevCycle uses `faber run --interpret` and stepper fixtures; ship
  milestones use `faber build` and full Tier A parity.
- Capability-sliced utilities: stdin/text slices ship in stepper mode before
  file-I/O slices; file-backed flags are explicitly blocked or deferred in
  stepper, not silently wrong on Rust.
- GNU parity is fixture-driven (stdout, stderr, exit code); Tier B/C extensions
  are demand-driven.
- The campaign remains the intake and routing authority for new utilities,
  toolchain gaps, and exempla-boundary decisions.

## Development Posture

- **Application exempla, not stdlib.** Shared code lives in
  `examples/coreutils/common/`. Do not add coreutils modules to `stdlib/norma`.
- **Stepper-first inner loop.** Prefer `faber check` and
  `faber run --interpret` over `faber build` during implementation. Rust compile
  is a milestone gate, not an edit-run cycle.
- **Two-lane delivery.** Dev lane = MIR stepper (`--interpret`). Ship lane =
  HIR→Rust (`faber build`). See [Parity contract](parity-contract.md).
- **Capability-sliced utilities.** A utility is not blocked whole-cloth because
  one flag needs file I/O. Implement stdin/text slices in stepper; file-backed
  actions are labeled in the ledger and fixtures. Example: `grep` on stdin is
  in-scope for stepper; `grep FILE` waits on Stage 1b (package-mode kernel
  import resolution — the stepper already has the read primitive) or Rust
  closeout.
- **GNU parity tiers.** Tier A = common/POSIX usage; Tier B = documented GNU
  extensions; Tier C = edge cases / full GNU test-suite depth (deferred).
- **Faber-first bodies.** Utilities are Faber source compiled through the
  application lane. No Rust shims in utility source unless a campaign stage
  records an explicit exception.
- **Honest host boundaries.** Stepper mode rejects unreachable file flags with
  a clear diagnostic or documents them as `lane = rust` only. The Rust path is
  authoritative for full Tier A parity.
- **One factory goal per binary** (`split-on-boundary`). Stages are coarse
  routing units; the ledger lowers individual utilities to factory goals.

## Implementation Workflow

1. Add or update a row in [`ledger.md`](ledger.md) before starting a utility.
2. Copy [`goals/_template.md`](goals/_template.md) to `goals/<util>.md` and
   fill the capability matrix and fixture scope.
3. Lower the next eligible stage or ledger row through `delivery` (if the slice
   needs a phase graph) or directly through `factory`.
4. Implement with stepper fixtures green before Rust closeout.
5. Add line-start `#` comments in example `.fab` files where they help readers
   understand the Faber feature or coreutils slice being demonstrated.
6. Add inline `proba` coverage for pure logic when a package has any helper or
   parsing behavior worth unit testing.
7. Run `faber format` on touched Faber package sources before validation.
8. Update the ledger with stepper-complete / ship-complete evidence.
9. Do not implement directly from this campaign artifact.

## Scope Routing

**In campaign**

- `examples/coreutils/` package workspace and shared `common/gnu/*`
- Parity harness (`scripta/check-coreutils-parity`) and fixture corpora
- Per-utility factory goals under `docs/factory/coreutils/goals/`
- Thin pointer exemplum under `crates/exempla/corpus/applications/` (meta only)
- Toolchain follow-ons that unblock file-I/O stepper slices (Stage 1b)

**Out of campaign unless explicitly pulled in**

- Syntax/keyword exempla in `crates/exempla/corpus/<term>/`
- `stdlib/norma` growth (route to
  [`core-stdlib/CAMPAIGN.md`](../core-stdlib/CAMPAIGN.md))
- Compiler/MIR work except gaps filed from coreutils utility goals
- Full GNU test-suite import or locale matrix certification
- `cista` package publication (exempla only, not a registry release)
- TS/Go experimental emit for utilities (Rust is the only ship backend)

## Batching And Split Policy

| Scope | Policy |
| --- | --- |
| Campaign stages | Coarse routing (`discovery-first` for Stage 1–2) |
| Utilities | `split-on-boundary` — one factory goal per binary |
| Within a utility | `batch-by-default` — fixtures + package + proba in one phase when the slice is homogeneous |
| Inner-loop validation | **Lean:** `faber format/check/test` + `./scripta/check-coreutils-parity <util> --backend stepper` once per touched utility; commit. No per-batch scratch logs, double parity, or global `check-factory-goal-status` (housekeeping only) |
| Stepper vs Rust | Two gates per utility where needed: stepper-complete, then ship-complete |

Do not encode dozens of factory phases in this artifact. The ledger holds
per-utility state; stages hold track-level routing.

## Ground Truth Researched

| Source | Authority for |
| --- | --- |
| [`AGENTS.md`](../../../AGENTS.md) | Workspace lanes, tooling, grammar rules |
| [`README.md`](../../../README.md) | Package manifest, compiler performance, CLI roles |
| [`crates/exempla/corpus/cli/cli.fab`](../../../crates/exempla/corpus/cli/cli.fab) | `@ cli` / `@ optio` / operand patterns |
| [`examples/fixtures/exempla-boundary/package-cli/`](../../../examples/fixtures/exempla-boundary/package-cli/) | Package CLI mounts |
| [`docs/factory/faber-kernel-solum/`](../faber-kernel-solum/) · [`docs/factory/faber-kernel-namespace/`](../faber-kernel-namespace/) | `faber:*` kernel modules (`solum`, `processus`) backing dev-lane host I/O |
| [`docs/factory/faber-script-kernel/CAMPAIGN.md`](../faber-script-kernel/CAMPAIGN.md) | Script-mode kernel dispatch (`faber run script.fab`) |
| [`docs/factory/faber-script-runtime/CAMPAIGN.md`](../faber-script-runtime/CAMPAIGN.md) | `faber script` lane + Stage 1b package host import bridge (owns the `norma:*` → stepper-kernel dispatch) |
| [`crates/faber-cli/src/commands/run.rs`](../../../crates/faber-cli/src/commands/run.rs) | `faber run` interpret vs compile policy |
| [`crates/faber-cli/src/package/mir.rs`](../../../crates/faber-cli/src/package/mir.rs) | Package MIR limits (library imports, CLI surfaces) |
| [`docs/factory/core-stdlib/CAMPAIGN.md`](../core-stdlib/CAMPAIGN.md) | `norma:*` readiness for file/process ship lane |

## Track Ledger

Authoritative per-utility queue: [`ledger.md`](ledger.md).

Summary (2026-07-07):

| Track | State | Next action |
| --- | --- | --- |
| Campaign scaffold | Complete | Stage 1 evidence recorded below |
| Parity harness v0 | Complete | prior utilities stepper parity green; `comm`, `join`, and `split` slices landed in Stage 4 cycle 18 (validate with harness commands below) |
| Shared `common/gnu/*` | Complete for pure helpers | Extend helpers only when a utility needs them |
| Inline `proba` package tests | Active | Keep tests in existing `.fab` files until `.proba` discovery is implemented |
| Package-mode kernel import resolution | Complete for Stage 5 scalar bridge helpers | Stage 1b routes supported `norma:*` host imports to existing stepper kernels; rich genus materialization remains separate |
| Tier-0 utilities | Active | Continue with Stage 3 utility goals |
| Stdin/text utilities | Active | Nullable-stdin slices landed for `cat`, `head`, `tail`, `wc`, `tac`, `uniq`, `fold`, `nl`, `expand`, `unexpand`, `sort`, `cut`, `grep`, `tr`, `tee`, and `paste`; continue parallel with Stage 1b where stdin-only |
| File/metadata utilities | Active | Stage 5 first slices landed for simple file/path mutation tools; continue metadata/richer-option goals |
| Deferred/hard utilities | Deferred | Record in ledger; no scheduling |

## Campaign Path

### Stage 0 — Open Campaign

**Status**: complete (this artifact).
**Gate**: campaign, ledger, parity contract, goal template, Stage 1 goal exist.
**Lowers to**: docs commit.

### Stage 1 — Scaffold + Parity Harness v0

**Status**: complete (2026-07-07).
**Source**: [`stage-1-scaffold-goal.md`](stage-1-scaffold-goal.md).
**Why now**: proves layout, fixture contract, and stepper compare loop before
utility throughput.
**Deliverables**: `examples/coreutils/` skeleton, `scripta/check-coreutils-parity`,
`true` and `false` stepper-complete, applications pointer exemplum.
**Gate**: Stage 1 goal acceptance criteria green.
**Evidence**: `true` and `false` pass `faber check` and
`./scripta/check-coreutils-parity <util> --backend stepper`.
**Lowers to**: complete.

### Stage 1b — Package-Mode Kernel Import Resolution (dependency; owned elsewhere)

**Status**: complete for bridged scalar/list/file mutation, scalar metadata,
mode, symbolic-link, and byte-write verbs; not a global blocker.
**Owner**: [`faber-script-runtime/CAMPAIGN.md`](../faber-script-runtime/CAMPAIGN.md)
Stage 1b (package host import bridge). Coreutils routes to it; it does not own
the bridge.
**Why now**: the stepper already implements file/env/cwd primitives
(`crates/radix/src/mir/stepper/kernel/{solum,processus}.rs`: `lege`/`hauri`/
`enumera`, `sedes`/`muta`/`lege`/`scribe`), but package mode rejects `faber:`
imports (`kernel_script_mode_only_message` in `crates/radix/src/kernel/mod.rs`).
The bridge lets interpreted package execution satisfy supported `norma:*` host
imports through the stepper kernels, so file-backed stepper slices work without
Cargo.
**Resolved decision**: one package-source import string for both lanes —
`norma:*`. Utility source imports `norma:solum`/`norma:processus` and runs
unchanged on both the interpreted (stepper) and compiled (Rust `norma` backing)
lanes. `faber:*` stays the direct script/kernel namespace, not a second package
dialect. No lane-conditional imports in utility source.
**Gate**: a coreutils-shaped fixture imports `norma:solum` once and performs
file mutations through interpreted package execution without a second
stepper-only source file.
**Evidence**: Stage 5 file slices for `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`,
`readlink`, and `realpath` pass stepper parity through package `norma:solum`
imports. A follow-up bridge slice added scalar metadata predicates, `modum`,
`vincula`, and `funde`; hard-link creation remains intentionally deferred.
**Lowers to**: complete for the scalar/list/file mutation subset; route rich
genus materialization and remaining host metadata gaps through their own goals.
**Note**: stdin/text utilities proceed without Stage 1b.

### Stage 2 — Shared Application Substrate

**Status**: complete for pure-helper substrate and `echo` operand slice
(2026-07-07) — package-MIR blockers resolved in
[`DEFER-107`](../deferred/defer-107.md).
**Why now**: one argv/stdio pattern for all utilities to copy.
**Deliverables**: `common/gnu/{argv,stdio,exitus,format}.fab`; reference utility
(`echo` or `wc`) with Tier A stdin/stepper fixtures.
**Gate**: substrate imported by ≥2 packages; stepper fixtures documented in
parity contract.
**Evidence**: `true`, `false`, and `echo` import shared `common/gnu/*` helpers
directly; inline package tests pass via `faber test`; `echo` passes 3/3 Tier A
operand fixtures in stepper parity.
**Lowers to**: Stage 3 utility goals.

### Stage 3 — Tier-0 Utilities Track

**Status**: active.
**Utilities**: `true`, `false`, `echo`, `yes`, `pwd`, `basename`, `dirname`,
`printenv`, `printf` (subset), `seq` (subset).
**Gate per utility**: stepper-complete for declared slice; ship-complete on
milestone.
**Evidence**: `basename` and `dirname` first slices landed through parallel
sub-agent utility scopes and passed parent validation. A second parallel cycle
extended `echo -E`, `basename -s` / `--suffix`, and `dirname` slash
normalization. A third parallel cycle added stepper slices for newline-limited
`printf` formatting and integer `seq` ranges. A follow-on batch extended `seq`
with custom separators and equal-width integer output while preserving negative
range operands through local option parsing.
**Evidence**: a follow-on cycle added stepper slices for infinite-output `yes`
(harness-capped stdout), logical `pwd` via `norma:processus.sedes`, and set-name
`printenv` via `norma:processus.lege`.
**Lowers to**: one factory goal per binary.
**Evidence (2026-07-08)**: package-MIR host bridge gained `norma:consolum`
(`dic`/`scribe`/`mone`) so `echo -n` passes stepper parity (11/11). Raw
no-newline calls must live in the package entry unit today — shared
`common/gnu/*` imports of `norma:consolum` still leave an unresolved package
provider under `--interpret` (residual linker gap).
**Next useful slice**: broader `printf` raw no-newline parity (entry-unit
`consolum.dic`), or `printenv` unset lookup once optional env read exists;
`-e` escapes remain deferred for `echo`.

### Stage 4 — Stdin/Text Utilities Track

**Status**: active.
**Utilities**: `cat` (stdin slice), `grep`, `wc`, `sort`, `uniq`, `cut`, `tr`,
`fold`, `head`, `tail`, `tac`, `nl`, `expand`, `unexpand`, `tee` (stdin slice),
`comm`, `join`, `paste`, `split`, `od`, `cksum`.
**Evidence**: the first parallel Stage 4 cycle added stepper slices for
zero-operand line-oriented `cat` and stdin line-count `head`. The cycle also
fixed a straightforward Radix gap so `lege` typechecks, validates, and emits
as `textus ∪ nihil`, allowing EOF to stop stdin loops without double-wrapping
nullable values in Rust codegen. A second parallel Stage 4 cycle added
stdin-only `tail` and `wc` slices with inline proba, formatted commented Faber
sources, and stepper parity fixtures. A third cycle added stdin-only `tac` and
`uniq` slices for reverse-line output and adjacent duplicate grouping. A fourth
cycle added `fold` width wrapping and `nl` body-line numbering slices. A fifth
cycle added ASCII tab expansion/compression slices for `expand` and `unexpand`.
A sixth cycle added keyless ASCII line sorting and field-selection slices for
`sort` and `cut`. A seventh cycle added literal stdin matching for `grep` and
ASCII transliteration/delete/squeeze support for `tr`. An eighth cycle added
stdout passthrough for `tee` and single-stream/serial joining for `paste`.
A ninth cycle extended `sort` with `-r`/`-u` and `cut` with `-s` plus
`--complement` over the existing stdin field subset.
A tenth cycle extended `uniq` with ASCII `-i` grouping and `fold` with
space-preferred `-s` wrapping over the existing stdin line subset.
An eleventh cycle extended `expand` with GNU-compatible initial-only `-i` /
`--initial` tab expansion over the existing ASCII stdin subset.
A twelfth cycle extended `grep` with repeated literal `-e` pattern OR matching
and `tr` with transliteration-mode `-t` truncate-set1 behavior.
A thirteenth cycle extended `sort` with ASCII fold-case `-f` ordering and
`uniq` with character-key `-s` / `-w` comparison slices.
A fourteenth cycle extended `paste` with serial delimiter cycling and empty
delimiters, and `nl` with line-number start, increment, width, and `ln`
formatting options.
A fifteenth cycle extended `head` with all-but-final negative `-n` line counts
and `tail` with signed last-count and `+N` start-line `-n` semantics.
A sixteenth cycle extended `expand` and `unexpand` with GNU comma/list finite
absolute tab stops (`-t 4,8`), post-final-list single-space fallback for
`expand`, and `-a` plus leading-only list-stop compression for `unexpand`.
A seventeenth cycle added POSIX stdin `cksum` and default `-t o2` stdin `od`
slices with shared `common/gnu/bytes` helpers.
An eighteenth cycle added sorted two-file `comm` (column suppress flags and
stdin `-` second operand), default field-1 `join`, and stdin `-l` line-chunk
`split` with harness `files` map verification for output suffixes.
**Gate**: stdin `lane = stepper` Tier A green; file slices per ledger.
**Lowers to**: one factory goal per binary.

### Stage 5 — File/Metadata Utilities Track

**Status**: active.
**Utilities**: `ls`, `stat`, `test`, `chmod`, `mkdir`, `touch`, `cp`, `mv`, `rm`,
`ln`, `readlink`, `realpath`, `cat` (file slice), `du`, `df`.
**Dependency**: `norma:solum` / process routes; prefer Stage 1b for stepper file
slices.
**Evidence**: first stepper slices landed for `mkdir`, `touch`, `cp`, `mv`,
`rm`, `readlink`, `realpath`, and the `cat` file operand slice after the
package host bridge gained the required `norma:solum` mutation/path verbs.
**Lowers to**: one factory goal per binary.

### Stage 6 — System/Info Utilities Track

**Status**: planned.
**Utilities**: `env`, `id`, `whoami`, `uname`, `hostname`, `date`, `timeout`,
`sleep`, `nproc`.
**Lowers to**: one factory goal per binary.

### Stage 7 — Deferred / Hard Utilities

**Status**: deferred.
**Examples**: `dd`, `install`, `chroot`, `runcon`, `mknod`, `shred`, `stty`, full
`expr`, checksum suite depth, locale-sensitive `sort`/`wc -m`.
**Stop condition**: do not schedule until Stages 3–5 prove throughput and parity
model.
**Lowers to**: individual goals only after explicit campaign promotion.

## Dependency Rules

- If a utility needs file/process effects on the **ship** lane, check
  [`core-stdlib/CAMPAIGN.md`](../core-stdlib/CAMPAIGN.md) before implementing.
- If a utility needs host I/O on the **stepper** lane, it depends on Stage 1b
  (package host import bridge, owned by
  [`faber-script-runtime/CAMPAIGN.md`](../faber-script-runtime/CAMPAIGN.md)).
  Utility source imports `norma:*` (resolved: one string, both lanes — the
  interpreted lane bridges `norma:*` to the stepper kernels). Until Stage 1b,
  use stdin-only slices or `lane = rust` fixtures.
- If `faber run --interpret` rejects a CLI surface, file a focused compiler/cli
  goal; do not bypass with Rust-only development as the default loop.
- If a construct is missing from codegen, fix upstream in `crates/radix`; do not
  guess types in utility source.
- New utilities require a ledger row before factory work starts.
- Do not register every utility in `crates/exempla/corpus/index.toml` as keyword
  exempla; use `applications/` pointer only.
- Parity fixtures assume `C`/`POSIX` locale unless a utility explicitly tests
  locale (Tier B+); record locale assumptions in the utility goal.

## First Useful Milestones

- **M1:** `true`/`false` pass stepper parity harness (layout + loop proven).
- **M2:** `echo` Tier A stdin/stepper slice (substrate + argv patterns).
- **M3:** Five Tier-0 utilities stepper-complete (factory throughput).
- **M4:** `grep` or `wc` stdin slice (text utility pattern).
- **M5:** First file-primary utility ship-complete on Rust (`cat` or `ls`).

## Acceptance Criteria

This campaign artifact is healthy when:

- every scheduled utility appears in [`ledger.md`](ledger.md);
- Stage 1 is lowered and executed or explicitly deferred with reason;
- parity contract is the harness authority;
- stepper-first DevCycle is documented and used in factory goals;
- capability slices are explicit (not whole-utility blocked on file I/O);
- toolchain gaps route to named follow-on goals, not silent workarounds.

The campaign closes only if Faber adopts a different application-exempla
governance model. Individual utility ship-complete rows update the ledger; they
do not close the campaign.

## Validation

Campaign artifact checks:

```bash
rg -n "coreutils|Coreutils Application" docs/factory/coreutils docs/factory
test -f docs/factory/coreutils/CAMPAIGN.md
test -f docs/factory/coreutils/ledger.md
test -f docs/factory/coreutils/parity-contract.md
```

Downstream validation (Stage 1+):

```bash
faber check examples/coreutils/packages/true
faber test examples/coreutils/packages/true
faber run --interpret examples/coreutils/packages/true
./scripta/check-coreutils-parity true --backend stepper
./scripta/check-coreutils-parity echo --backend stepper
./scripta/check-coreutils-parity basename --backend stepper
./scripta/check-coreutils-parity dirname --backend stepper
./scripta/check-coreutils-parity printf --backend stepper
./scripta/check-coreutils-parity seq --backend stepper
./scripta/check-coreutils-parity cat --backend stepper
./scripta/check-coreutils-parity head --backend stepper
./scripta/check-coreutils-parity tail --backend stepper
./scripta/check-coreutils-parity wc --backend stepper
./scripta/check-coreutils-parity tac --backend stepper
./scripta/check-coreutils-parity uniq --backend stepper
./scripta/check-coreutils-parity fold --backend stepper
./scripta/check-coreutils-parity nl --backend stepper
./scripta/check-coreutils-parity expand --backend stepper
./scripta/check-coreutils-parity unexpand --backend stepper
./scripta/check-coreutils-parity sort --backend stepper
./scripta/check-coreutils-parity cut --backend stepper
./scripta/check-coreutils-parity grep --backend stepper
./scripta/check-coreutils-parity tr --backend stepper
./scripta/check-coreutils-parity tee --backend stepper
./scripta/check-coreutils-parity paste --backend stepper
./scripta/check-coreutils-parity yes --backend stepper
./scripta/check-coreutils-parity pwd --backend stepper
./scripta/check-coreutils-parity printenv --backend stepper
./scripta/check-coreutils-parity cksum --backend stepper
./scripta/check-coreutils-parity od --backend stepper
./scripta/check-coreutils-parity comm --backend stepper
./scripta/check-coreutils-parity join --backend stepper
./scripta/check-coreutils-parity split --backend stepper
./scripta/check-coreutils-parity mkdir --backend stepper
./scripta/check-coreutils-parity touch --backend stepper
./scripta/check-coreutils-parity cp --backend stepper
./scripta/check-coreutils-parity mv --backend stepper
./scripta/check-coreutils-parity rm --backend stepper
./scripta/check-coreutils-parity readlink --backend stepper
./scripta/check-coreutils-parity realpath --backend stepper
```

Full utility ship gate (milestone):

```bash
faber build examples/coreutils/packages/<util>
./scripta/check-coreutils-parity <util> --backend rust
```

Default `./scripta/test` remains unchanged; coreutils parity is opt-in until
Stage 1 promotes an optional CI hook.

## Open Questions

- **Binary naming:** generated Cargo bin name matches GNU (`echo`) vs prefixed
  (`coreutils-echo`) — Stage 1 goal proposes `echo` via `package.name`.
- **GNU baseline invocation:** brew coreutils is keg-only (`g`-prefix only,
  no BSD shadowing); harness invokes `g<util>` and bypasses shell builtins
  (`echo`/`true`/`false`/`printf`/`test`/`[`/`time`). `grep` baseline is
  `ggrep` (separate package). Container pinning remains optional.
- **Stage 1b timing:** land the faber-script-runtime package host import bridge
  before Stage 4 file slices vs on first utility that needs it. (The
  import-string decision is resolved: `norma:*` one-source, both lanes.)
- **Applications exemplum:** single meta exemplum vs small `applications/cli`
  tour — Stage 1 creates pointer only.

## Stop Conditions

Pause and return to the campaign before implementing when:

- a utility would land in `crates/exempla/corpus/<keyword>/` instead of
  `examples/coreutils/`;
- a factory goal would add behavior to `stdlib/norma` for one utility;
- stepper and Rust paths would diverge without fixture/documentation update;
- a proposal schedules Stage 7 utilities before M3;
- file-I/O flags are stubbed to pass stepper fixtures while Rust path is wrong.

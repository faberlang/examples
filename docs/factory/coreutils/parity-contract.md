# Parity Contract: Coreutils Application Exempla

**Campaign**: [`CAMPAIGN.md`](CAMPAIGN.md)
**Fixture root**: `examples/coreutils/harness/fixtures/<utility>/`

This document is the authority for GNU baseline comparison, fixture shape, and
two-lane (`stepper` / `rust`) validation.

## Compared outputs

For each fixture case, compare against the host GNU utility (resolved by explicit
`g<util>` — see [GNU baseline](#gnu-baseline); never `command -v <util>`, which
resolves shell builtins or BSD binaries):

| Stream | Rule |
| --- | --- |
| **stdout** | Exact byte match after normalization (see below) |
| **stderr** | Exact match for Tier A; message text may differ for usage errors if exit code matches and Rust path documents divergence |
| **exit code** | Must match GNU |

Normalization (apply to both sides before compare):

- Trailing newline policy: fixtures declare `stdout_newline = true|false`
- Default: append single `\n` to stdout expectation when `stdout_newline` omitted and GNU emits trailing newline
- Line endings: `\n` only in Tier A fixtures (`C` locale, UTF-8 text)

## Lanes

| Lane | Runner | When |
| --- | --- | --- |
| `stepper` | `faber run --interpret <package> -- <args>` | Inner DevCycle; default harness mode |
| `rust` | `faber build <package>` then run emitted binary with `<args>` | Utility ship-complete gate |

Harness command (Stage 1 deliverable):

```bash
./scripta/check-coreutils-parity <utility> [--backend stepper|rust|all] [--tier A|B] [--case <id>]
```

Default: `--backend stepper`, `--tier A`.

A case runs only when its `lane` tag matches the selected backend. `--backend all`
runs the **union** — `lane = stepper` cases on the stepper plus `lane = rust`
cases on rust — and does not cross-run a single-lane case on the other backend.

## Fixture file format

TOML per utility. File: `harness/fixtures/<utility>/cases.toml`.

```toml
# harness/fixtures/true/cases.toml

[[case]]
id = "exit-zero"
lane = "stepper"
tier = "A"
args = []
stdin = ""
stdout = ""
stderr = ""
exit = 0

[[case]]
id = "gnu-baseline-smoke"
lane = "rust"
tier = "A"
args = []
stdin = ""
stdout = ""
stderr = ""
exit = 0
```

### Case fields

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Stable identifier for `--case` |
| `lane` | yes | `stepper`, `rust`, or both via duplicate cases |
| `tier` | yes | `A`, `B`, or `C` |
| `args` | yes | argv after `--` (program name excluded) |
| `stdin` | no | default `""` |
| `env` | no | map of `KEY = "value"` overrides |
| `cwd` | no | working directory relative to fixture temp root |
| `setup` | no | shell snippet run in temp dir before Faber/GNU (creates files) |
| `stdout` | yes | expected stdout (after normalization) |
| `stderr` | no | default `""` |
| `exit` | yes | expected exit code |
| `stdout_newline` | no | default: infer from `stdout` content |
| `deferred` | no | if `true`, harness skips unless `--include-deferred` |
| `skip_gnu` | no | if `true`, compare only across Faber backends (rare) |

### Setup scripts

`setup` runs in an isolated temp directory shared by GNU and Faber invocations.
Use for file operands on the **rust** lane only until Stage 1b enables file
reads in stepper.

## GNU baseline

Tier A assumes:

- GNU **coreutils 9.11** and **grep 3.12** installed via Homebrew (keg-only:
  binaries are `g`-prefixed — `gecho`, `gwc`, `gsort`, `ggrep`, …). They do
  **not** shadow BSD `/usr/bin/<util>`.
- Harness resolves the GNU binary by explicit `g<util>` name (or prepends
  `/opt/homebrew/opt/coreutils/libexec/gnubin` to `PATH`); never
  `command -v <util>`.
- **Builtin bypass:** `echo`, `true`, `false`, `printf`, `test`, `[`, `time`
  resolve to shell builtins under `command -v`. The harness must invoke the
  `g`-prefixed binary for these.
- `LC_ALL=C` unless a case sets `env`.
- macOS or Linux host — document known divergences in the utility goal when
  unavoidable (e.g. do not baseline against BSD `stat`; use `gstat`).

Baseline gaps (no GNU coreutils source):

- `hostname` — moved to inetutils; not in brew coreutils. Deferred (Stage 7).
- `grep` — separate package; baseline is `ggrep` (`brew install grep`).

Optional future: pin baseline via container image; record image digest in
campaign when adopted.

## Capability-sliced policy

Utilities may ship partial surfaces:

1. Declare **stepper surface** in the utility goal and ledger.
2. Tag file-backed cases `lane = "rust"` only.
3. In stepper mode, unreachable flags must either:
   - not appear in any `lane = stepper` fixture, and
   - at runtime: exit non-zero with a diagnostic naming the unsupported flag
     (prefer exit `2` for usage errors when practical).

Never make Rust behavior wrong to keep stepper fixtures green.

## proba vs harness

| Tool | Scope |
| --- | --- |
| `proba` / `probandum` in package | Pure logic, argv parsing helpers, formatting units |
| `check-coreutils-parity` | End-to-end GNU behavioral parity |

Run `faber test` on packages for proba; run parity harness for behavioral gates.

## CI posture

| Gate | Command | Default CI |
| --- | --- | --- |
| Fast repo test | `./scripta/test` | yes — unchanged |
| Coreutils stepper | `./scripta/check-coreutils-parity --changed` | no until Stage 1 promotes hook |
| Coreutils rust milestone | per-utility `--backend rust` | release/nightly optional |

## Evidence recording

Factory goals record parity evidence as:

```text
check-coreutils-parity <util> --backend stepper: N/N Tier A pass
check-coreutils-parity <util> --backend rust: N/N Tier A pass
```

Update [`ledger.md`](ledger.md) stepper/ship columns when thresholds are met.
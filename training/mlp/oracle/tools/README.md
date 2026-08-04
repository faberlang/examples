# oracle/tools — regeneration tooling for the S0-C oracle (fixture)

Two self-contained scripts make the oracle reference regenerable from committed
tooling, per the S0-C audit finding P2-2 (fd-validation.json and the
determinism-evidence replay must be reproducible from the repo alone).

| Script | Purpose | Writes |
|---|---|---|
| `fd_probe.py` | Regenerates `fd-validation.json` by running the actual faber computation with each trainable element perturbed ±ε (central difference, ε = 1e-3, N1.9), comparing against the companion gradients in `gradients.json` step 0. | `oracle/fd-validation.json` |
| `replay_loss.py` | Independent f64 replay of the loss trajectory from the captured initial values (`capture.txt`) and per-step gradients (`gradients.json`), checked against `loss-trace.json` under the N1.9 reduction-scalar rule. | stdout report |
| `replay_f32.py` | Independent strict-f32 replay (every op rounded to f32, including GELU) of the same trajectory, checked against `loss-trace.json` and `final-params.json` under the N1.9 rules. Proves the executed contract is the f32-typed program (the FMIR stepper computes f64; f32 rounding bounds the deviation). | stdout report |

## Usage

```bash
# from the package directory (examples/training/<fixture>)
faber run -t fmir oracle/capture.fab > oracle/capture.txt   # regenerate capture first
shasum -a 256 oracle/capture.txt                            # must equal capture.sha256

python3 oracle/tools/fd_probe.py            # writes oracle/fd-validation.json
python3 oracle/tools/replay_loss.py         # prints the per-step replay deltas
python3 oracle/tools/replay_f32.py          # strict-f32 trajectory replay
```

Both replay scripts are **step-count-agnostic**: the trajectory length is
auto-detected from the capture (gradients.json steps vs loss-trace.json, which
must agree — a mismatch is a hard error; a `capture.txt` step_loss-marker
mismatch is only a warning). The replay validates an 8-step capture and a
100-step capture identically, with the same N1.9 rules and no weakened
tolerances. Optional `--max-steps N` caps per-step validation/printing while
still applying every update, so the final-params check keeps covering the full
trajectory (handy for a quick dry-run on a long capture).

`fd_probe.py` accepts `--faber PATH` (if faber is not on PATH), `--eps` (default
1e-3), `--output PATH`, and `--dry-run` (parse/check only). See the script
header for details. Exit codes: `0` all elements pass, `2` failures written to
the `"failures"` list, `1` error.

## faber prerequisite

The probe perturbs the *actual* faber computation, so it needs a `faber` that
builds this fixture. This fixture exercises tensor GELU (BERT/MLP) — the radix
R-W1 fix (radix commit `4197839e9`, "accept tensor float unary ops in MIR
validator") must be present in the build; a stale binary rejects it with
`float unary operand is not fractus` / `fmir image build failed`. The oracle
was captured and regenerated with the prebuilt
`faber/target/debug/faber` (SHA-256
`2a4cfbcc8aab6b06784a285906ac3b1f8680d13bd6ec7a7c18d6ce763cde9120`,
2026-08-03), which reproduces all three captures byte-identically. Once faber
main is built against a radix containing the R-W1 fix, `faber` on PATH works.

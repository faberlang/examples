# oracle/tools — regeneration tooling for the S0-C oracle (fixture)

Two self-contained scripts make the oracle reference regenerable from committed
tooling, per the S0-C audit finding P2-2 (fd-validation.json and the
determinism-evidence replay must be reproducible from the repo alone).

| Script | Purpose | Writes |
|---|---|---|
| `fd_probe.py` | Regenerates `fd-validation.json` by running the actual faber computation with each trainable element perturbed ±ε (central difference, ε = 1e-3, N1.9), comparing against the companion gradients in `gradients.json` step 0. | `oracle/fd-validation.json` |
| `replay_loss.py` | Independent f64 replay of the 8-step loss trajectory from the captured initial values (`capture.txt`) and per-step gradients (`gradients.json`), checked against `loss-trace.json` under the N1.9 reduction-scalar rule. | stdout report |

## Usage

```bash
# from the package directory (examples/training/<fixture>)
faber run -t fmir oracle/capture.fab > oracle/capture.txt   # regenerate capture first
shasum -a 256 oracle/capture.txt                            # must equal capture.sha256

python3 oracle/tools/fd_probe.py            # writes oracle/fd-validation.json
python3 oracle/tools/replay_loss.py         # prints the per-step replay deltas
```

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

# oracle/tools — regeneration tooling for the S0-C / S6-U8 oracle (fixture)

Self-contained scripts make the oracle reference regenerable from committed
tooling, per the S0-C audit finding P2-2 (fd-validation.json and the
determinism-evidence replay must be reproducible from the repo alone) and the
S6-U8 exit-gate extension (intermediates, gradient norms, update states,
softmax row sums, finite checks).

| Script | Purpose | Writes |
|---|---|---|
| `extract_reference.py` | Rebuilds all JSON reference files from a fresh `capture.txt`: `inputs.json`, `loss-trace.json`, `gradients.json` (trainable 18), `gradients-full.json` (all 21 gradients + L2 norms), `final-params.json`, `intermediates.json` (ln1/scores/attn/context/ln2/ln3 per step), `update-states.json` (18 tensors after each of the 8 SGD steps), `row-sums.json` (softmax row sums per step). | the JSON reference files |
| `finiteness.py` | Finite-check over every captured value (capture.txt marker stream + every numeric leaf of the JSON references); writes the exit-gate finiteness receipt. | `oracle/finiteness.json` |
| `fd_probe.py` | Regenerates `fd-validation.json` by running the actual faber computation with each trainable element perturbed ±ε (central difference, ε = 1e-3, N1.9), comparing against the companion gradients in `gradients.json` step 0. | `oracle/fd-validation.json` |
| `replay_loss.py` | Independent f64 replay of the 8-step loss trajectory from the captured initial values (`capture.txt`) and per-step gradients (`gradients.json`), checked against `loss-trace.json` under the N1.9 reduction-scalar rule. The replay mirrors the S6-U8 `[8]`-bias broadcast (the S6-C2 `addita_bias` rank-extension add). | stdout report |

## Usage

```bash
# from the package directory (examples/training/bert-tiny-fragment)
faber run -t fmir oracle/capture.fab > oracle/capture.txt   # regenerate capture first
shasum -a 256 oracle/capture.txt                            # must equal capture.sha256

python3 oracle/tools/extract_reference.py   # rebuild the JSON reference files
python3 oracle/tools/finiteness.py          # write oracle/finiteness.json
python3 oracle/tools/fd_probe.py            # writes oracle/fd-validation.json
python3 oracle/tools/replay_loss.py         # prints the per-step replay deltas
```

`fd_probe.py` accepts `--faber PATH` (if faber is not on PATH), `--eps` (default
1e-3), `--output PATH`, and `--dry-run` (parse/check only). See the script
header for details. Exit codes: `0` all elements pass, `2` failures written to
the `"failures"` list, `1` error. `finiteness.py` returns `0` all finite, `2`
non-finite values found, `1` error.

## faber prerequisite

The FD probe perturbs the *actual* faber computation, so it needs a `faber` that
builds this fixture. This fixture exercises tensor GELU (BERT/MLP) and the
S6-C2 `addita_bias` rank-extension add — the radix R-W1 fix (radix commit
`4197839e9`, "accept tensor float unary ops in MIR validator") and the S6-C1/C2
stepper broadcast must be present in the build; a stale binary rejects it with
`float unary operand is not fractus` / `fmir image build failed`. The oracle
was captured and regenerated with the workspace faber binary
(`faber/target/debug/faber`, built 2026-08-05), which reproduces all three
captures byte-identically.

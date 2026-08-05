# mlp — CPU hyperparameter sweep (steps × lr grid)

**Date:** 2026-08-05 · **Host:** burgus.local · **Route:** CPU/FMIR oracle capture (`faber run -t fmir oracle/capture.fab`) · **Faber:** `/Users/ianzepp/work/faberlang/faber/target/debug/faber` (faber 1.4.0)

Stage 5 science sweep (Vivi task 9d6b8248) for the faberlang GPU training campaign — learning-curve data across the operator (steps × lr) grid on the S5-U7 deterministic CPU/FMIR oracle. The committed acceptance state (steps=100, lr=0.1) is the 100/0.1 row; the fixture files were restored byte-identical to HEAD after every combo (asserted via `git diff`).

## Method

Per combo the sweep patches in place — `src/train.fab` and `oracle/capture.fab` get the `lr` literal and the loop bound `fixum numerus steps ← <n>`, and `faber.toml` gets `[device] steps = <n>` (the loop bound and the manifest step count must match; the step-count validation fails closed) — runs the capture (`faber run -t fmir oracle/capture.fab`, `FABER_LIBRARY_HOME=…/faberlang`), extracts the trajectory stats and wall-clock, then restores the fixture. Each combo's `git diff` on the patched files is asserted empty.

Convergence rule: the first 0-based step where `loss < 0.1 × loss0` (`none` if the 1000-step budget never reaches it). `loss0` is `1.576448169383708` for every combo — the initial params are fixed literals, so step-0 loss is lr-independent.

## Grid

steps ∈ {100, 500, 1000} × lr ∈ {0.01, 0.05, 0.1} — 9 combos.

## Table

| steps | lr | loss0 | loss_final | final/initial | convergence step | all-finite | wall-clock (s) |
|---|---|---|---|---|---|---|---|
| 100 | 0.01 | 1.576448169383708 | 0.7941141822864916 | 0.503736 | none | yes | 0.164 |
| 100 | 0.05 | 1.576448169383708 | 0.14161566563946937 | 0.0898321 | 95 | yes | 0.164 |
| 100 | 0.1 | 1.576448169383708 | 0.017928625511508454 | 0.0113728 | 48 | yes | 0.167 |
| 500 | 0.01 | 1.576448169383708 | 0.1388771243786265 | 0.088095 | 472 | yes | 0.264 |
| 500 | 0.05 | 1.576448169383708 | 0.00012592074067485287 | 7.98762e-05 | 95 | yes | 0.268 |
| 500 | 0.1 | 1.576448169383708 | 0.00000008128812444775062 | 5.15641e-08 | 48 | yes | 0.265 |
| 1000 | 0.01 | 1.576448169383708 | 0.01731064702773774 | 0.0109808 | 472 | yes | 0.392 |
| 1000 | 0.05 | 1.576448169383708 | 0.00000008222757842931463 | 5.216e-08 | 95 | yes | 0.391 |
| 1000 | 0.1 | 1.576448169383708 | 0.00000000000004334710941717283 | 2.74967e-14 | 48 | yes | 0.387 |

## Determinism spot-check

The 1000/0.01 combo was captured twice. Loss traces identical: **True**; capture outputs byte-identical: **True** (per-combo capture sha256s are in the embedded data block below). This matches the S5-U7 determinism evidence (the FMIR stepper is deterministic).

## Read

The learning rate dominates the step budget. The convergence step is a pure function of lr — the first step where loss < 0.1×loss0 is 48 (lr=0.1), 95 (lr=0.05), and 472 (lr=0.01), identical across the 100/500/1000 step budgets — so the trajectory is deterministic and lr-scaled.

The 0.794 plateau at 100/0.01 is a small-lr artifact, not a fixture limit: at lr=0.01 the loss falls only to 0.794 in 100 steps (0.504×loss0, no convergence), but reaches 0.139 in 500 steps and 0.0173 in 1000 steps (crossing the gate at step 472). Raising lr dissolves the plateau faster: lr=0.05 reaches 0.142 in the same 100-step budget (0.0898×loss0, just under the gate) and lr=0.1 reaches 0.0179 (0.0114×loss0).

Gate (final < 0.1×loss0): 8 of 9 combos meet it; only 100/0.01 does not (0.504×loss0). The marginal cases are 100/0.05 (0.0898, ≈1.1× margin, crossing on step 95 of 100) and 500/0.01 (0.0881, ≈1.1×). The committed acceptance state 100/0.1 has an 8.8× margin; 1000/0.01 reaches 0.0110 (9.1×); 500/0.05 reaches 8.0×10^-5 (~1,250×); 500/0.1 and 1000/0.05 land at ≈5×10^-8, and 1000/0.1 at 4×10^-14 (machine-level convergence).

Wall-clock scales linearly with steps on top of a fixed build cost: 0.16–0.17s (100 steps), 0.26–0.27s (500), 0.39s (1000) per capture, of which ~0.14s is the FMIR image build; the stepper adds ~0.025s per 100 steps (~0.25 ms/step) at this 4×4 problem size. A 1000-step device-side run's CPU-side math is sub-second, so the Stage 8 performance gate will be dominated by device launch/transfer overhead, not compute.

All 9 combos are all-finite. Determinism spot-check: the 1000/0.01 combo captured twice produced byte-identical loss traces and captures, consistent with the S5-U7 determinism evidence.

<!-- sweep-data-json v1:{"fixture":"examples/training/mlp","date":"2026-08-05","host":"burgus.local","route":"fmir","backend":null,"faber_binary":"/Users/ianzepp/work/faberlang/faber/target/debug/faber","faber_version":"faber 1.4.0","faber_sha256":"f991e19358dd867c09a64e5eca4d18f8e5e1b0ab904a85819a965cc4d4df6397","grid":{"steps":[100,500,1000],"lr":["0.01","0.05","0.1"]},"convergence_rule":"first 0-based step where loss < 0.1 * loss0","expected_loss0":"1.576448169383708","determinism":{"combo":[1000,"0.01"],"loss_traces_identical":true,"captures_identical":true},"combos":[{"steps":100,"lr":"0.01","loss0":"1.576448169383708","loss_final":"0.7941141822864916","convergence_step":null,"all_finite":true,"wall_clock_s":0.164,"capture_sha256":"c275463879bba4356741dd8fe711ec33f35d4f9472f7da929d5340ea9203e168"},{"steps":100,"lr":"0.05","loss0":"1.576448169383708","loss_final":"0.14161566563946937","convergence_step":95,"all_finite":true,"wall_clock_s":0.164,"capture_sha256":"d44150fc231e2613b955a56a968a066298b605d91cf1c0479a316be4df2b4f46"},{"steps":100,"lr":"0.1","loss0":"1.576448169383708","loss_final":"0.017928625511508454","convergence_step":48,"all_finite":true,"wall_clock_s":0.167,"capture_sha256":"b0ad783243162d6f53e97c7d1c2af4e42ab8a722d7044826bb54aa950b1b3e0f"},{"steps":500,"lr":"0.01","loss0":"1.576448169383708","loss_final":"0.1388771243786265","convergence_step":472,"all_finite":true,"wall_clock_s":0.264,"capture_sha256":"61ce30552785dc65e87e9867cb81af6e0faf8bfa78290a8a993102a86d0369f8"},{"steps":500,"lr":"0.05","loss0":"1.576448169383708","loss_final":"0.00012592074067485287","convergence_step":95,"all_finite":true,"wall_clock_s":0.268,"capture_sha256":"7f858b35bb317dc4fb78a03bd53d17c3322d39d3f2833658f0d4733a06785291"},{"steps":500,"lr":"0.1","loss0":"1.576448169383708","loss_final":"0.00000008128812444775062","convergence_step":48,"all_finite":true,"wall_clock_s":0.265,"capture_sha256":"bcff4e698aaec256429ba3808920ab7f3d03106e99e0a071fde9b295e5b61c4a"},{"steps":1000,"lr":"0.01","loss0":"1.576448169383708","loss_final":"0.01731064702773774","convergence_step":472,"all_finite":true,"wall_clock_s":0.392,"capture_sha256":"5fd8cf8cddb84f77fcfedd96e1d789955df3242b3b45aec477cb70dc3280bd39"},{"steps":1000,"lr":"0.05","loss0":"1.576448169383708","loss_final":"0.00000008222757842931463","convergence_step":95,"all_finite":true,"wall_clock_s":0.391,"capture_sha256":"fea60ad8a2be26e65a0c343fb35db7d4c4ccdccc869244198ad2aec657b9876a"},{"steps":1000,"lr":"0.1","loss0":"1.576448169383708","loss_final":"0.00000000000004334710941717283","convergence_step":48,"all_finite":true,"wall_clock_s":0.387,"capture_sha256":"8d47d49c9d8fd99f0cb8f1e74d8b42e29907c3c1c5a0d634dad9d9623b7bd6ec"}],"notes":"The learning rate dominates the step budget. The convergence step is a pure function of lr \u2014 the first step where loss < 0.1\u00d7loss0 is 48 (lr=0.1), 95 (lr=0.05), and 472 (lr=0.01), identical across the 100/500/1000 step budgets \u2014 so the trajectory is deterministic and lr-scaled.\n\nThe 0.794 plateau at 100/0.01 is a small-lr artifact, not a fixture limit: at lr=0.01 the loss falls only to 0.794 in 100 steps (0.504\u00d7loss0, no convergence), but reaches 0.139 in 500 steps and 0.0173 in 1000 steps (crossing the gate at step 472). Raising lr dissolves the plateau faster: lr=0.05 reaches 0.142 in the same 100-step budget (0.0898\u00d7loss0, just under the gate) and lr=0.1 reaches 0.0179 (0.0114\u00d7loss0).\n\nGate (final < 0.1\u00d7loss0): 8 of 9 combos meet it; only 100/0.01 does not (0.504\u00d7loss0). The marginal cases are 100/0.05 (0.0898, \u22481.1\u00d7 margin, crossing on step 95 of 100) and 500/0.01 (0.0881, \u22481.1\u00d7). The committed acceptance state 100/0.1 has an 8.8\u00d7 margin; 1000/0.01 reaches 0.0110 (9.1\u00d7); 500/0.05 reaches 8.0\u00d710^-5 (~1,250\u00d7); 500/0.1 and 1000/0.05 land at \u22485\u00d710^-8, and 1000/0.1 at 4\u00d710^-14 (machine-level convergence).\n\nWall-clock scales linearly with steps on top of a fixed build cost: 0.16\u20130.17s (100 steps), 0.26\u20130.27s (500), 0.39s (1000) per capture, of which ~0.14s is the FMIR image build; the stepper adds ~0.025s per 100 steps (~0.25 ms/step) at this 4\u00d74 problem size. A 1000-step device-side run's CPU-side math is sub-second, so the Stage 8 performance gate will be dominated by device launch/transfer overhead, not compute.\n\nAll 9 combos are all-finite. Determinism spot-check: the 1000/0.01 combo captured twice produced byte-identical loss traces and captures, consistent with the S5-U7 determinism evidence."} -->

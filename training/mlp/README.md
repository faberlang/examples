# mlp — release-candidate device-training fixture

Gradus-backed MLP device fixture (differentiable-GPU campaign S5-U7): a
100-step deterministic training loop (`train.fab`, manifest `[device] steps =
100`) with a `@ nucleum` compute kernel and per-step loss observation.

## Demonstrated support (Stage 7, faber `1.6.0-rc.1`, pinned revisions)

This package is one of the two Stage 7 release-candidate fixtures. What is
demonstrated, exactly, per the TR7 receipts
(`radix/docs/factory/gpu-training-lowering/stage-7-*`):

| Level | Command | Machine / backend | Receipt |
| --- | --- | --- | --- |
| E6 — RC binary | `faber run --backend metal .` | burgus / Metal (Apple M5 Max, Metal 4) | `stage-7-evidence-burgus-metal-e6.md` (TR7-U2) |
| E6 — RC binary | `faber run --backend cuda .` | pharos / CUDA (NVIDIA RTX 5070, driver 595.71.05, CUDA 13.2) | `stage-7-evidence-pharos-cuda-e6.md` (TR7-U3) |
| E7 — clean-room extracted archive | `__fmir-run image.fmir --backend metal` | burgus / Metal | `stage-7-evidence-burgus-metal-e7.md` (TR7-U4) |
| E7 — clean-room extracted archive | `__fmir-run image.fmir --backend cuda` | pharos / CUDA | `stage-7-evidence-pharos-cuda-e7.md` (TR7-U5) |

All runs exited 0 on one session each; every numeric-policy v1.0.0 row PASS vs
the pinned CPU/FMIR oracle (`oracle/`, S5-U7): loss trace worst delta
`1.318e-07`, forward `≤2.907e-07`, final gradients `≤3.565e-08`, final params
`≤2.308e-07`, convergence ratio `0.01137 < 0.1`. Leak-free teardown
(`live_handle_count()=0`) and observation-only readback (per-step readback is
only the loss scalar).

## Scope of the claim

- **RC-local**: `package=yes` / `run=yes` at release-candidate level on the
  named machines at the pinned revisions. No E8, no stable publication, no
  broad-hardware wording (Stage 8 owns publication).
- **Device-observability caveat (unchanged from S6/E6/E7):** the `ln1` /
  `attn` / `context` / `ln2` intermediates and softmax row sums are not in the
  declared EndOfRun forward set for the bert fixture — this mlp fixture has no
  such caveat (all four forward buffers, four gradient buffers, and four param
  buffers are in the declared EndOfRun set).
- **Command routes**: `faber run --backend <metal|cuda> .` is the source
  package route (dev-container posture, `FABER_LIBRARY_HOME` per E6); the
  archive image runner `__fmir-run image.fmir --backend <metal|cuda>` runs the
  compiled self-contained package from the RC archive (E7).
- **PTX delta (CUDA, recorded honestly)**: the RC archive's compiled image
  embeds the Stage 0 contract `ptx87` payload; E6's source route recompiled to
  ptx 7.8 at runtime. A10 identity, execution-descriptor hash
  (`25181bd996f0173b`), and device trajectory are byte-identical across both
  routes (`stage-7-evidence-pharos-cuda-e7.md` §9).

## Package layout

- `faber.toml` — manifest (`target = "fmir"`, `kind = "bin"`, `[device]`
  section with the pinned oracle initial values)
- `src/train.fab` — the 100-step device training loop
- `oracle/` — pinned CPU/FMIR oracle references (loss trace, gradients, final
  params, capture)

## Related

- BERT-tiny sibling fixture: `../bert-tiny-fragment/`
- Campaign control plane: `radix/docs/factory/gpu-training-lowering/`

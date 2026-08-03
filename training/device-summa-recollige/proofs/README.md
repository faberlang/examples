# device-summa-recollige — S2-8 two-machine acceptance proofs

Real-device receipts for the S2-8 hard gate (A9/A10 multi-kernel receipts),
recorded 2026-08-03. The canonical acceptance receipt lives at
`radix/docs/factory/gpu-training-lowering/s2-8-acceptance-receipt.md`; this
file pins the machine outputs next to the fixture.

## burgus — Metal (Apple M5 Max)

```
$ faber run --backend metal .
device: selected backend `metal` on Apple M5 Max (artifact fnv64:db842cebeeb7119d)
device: module hash fnv64:db842cebeeb7119d launches 2 syncs 1 transfers 2 readbacks 1 releases 2 allocated 3
device: declared resource graph (A10):
device:   buffer 1 `a` input per-program version 1 (f32[1024])
device:   buffer 2 `medius` in-out per-step version 1 (f32[4])
device:   buffer 3 `result` output observation-point version 1 (f32[1])
device:   data-flow 1 -> 2 via buffer 2 version 1
device: output buffer 3 `result` = [262912]
device: leak proof: 5 run(s) then teardown -> live_handle_count()=0, driver counters at baseline (module loads 0 releases 0 buffer allocs 0 releases 0)
```

## pharos — CUDA (NVIDIA GeForce RTX 5070, driver 595.71.05)

```
$ faber run --backend cuda .
device: selected backend `cuda` on NVIDIA GeForce RTX 5070, 595.71.05 (artifact fnv64:1c3a7b09adcb1a54)
device: module hash fnv64:1c3a7b09adcb1a54 launches 2 syncs 1 transfers 2 readbacks 1 releases 2 allocated 3
device: declared resource graph (A10):
device:   buffer 1 `a` input per-program version 1 (f32[1024])
device:   buffer 2 `medius` in-out per-step version 1 (f32[4])
device:   buffer 3 `result` output observation-point version 1 (f32[1])
device:   data-flow 1 -> 2 via buffer 2 version 1
device: output buffer 3 `result` = [262912]
device: leak proof: 5 run(s) then teardown -> live_handle_count()=0, driver counters at baseline (module loads 0 releases 0 buffer allocs 0 releases 0)
```

## Numeric parity (numeric-policy v1.0.0, §3.1 reduction-sum row)

| Machine | Observed | Reference | max \|a−b\| | rule bound | finite | PASS |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| burgus (Metal) | 262912 | 262912.0 | 0 | 0.262913 | yes | **PASS** |
| pharos (CUDA) | 262912 | 262912.0 | 0 | 0.262913 | yes | **PASS** |

Oracle: `oracle/capture.txt`, SHA-256
`318f3683bfc5c7347a6116f4a5a9d1cb6e388f5eecf327fd05381e59cd229fce`
(captured twice, byte-identical, before any device observation).

## Leak proof

`FABER_DEVICE_REPEAT=5` ran the two-kernel chain 5 times on one session,
then teardown: `live_handle_count()==0` and driver counters at baseline on
both machines (no leak of contexts/modules/buffers).

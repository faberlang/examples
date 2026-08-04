# device-summa-recollige — 3R U7 G5 ordinary two-kernel acceptance receipts

Real-device receipts for the G5 ordinary composed product path (3R U7),
recorded 2026-08-04 with the 3R repaired semantic contract. The receipt now
carries the **semantic graph hash** (F1–F7 carried facts), the completion
boundary (R9), the launch order (F3 — never declaration order), and the
declared resource graph with observation-only readback (F6). The Stage 3
`E_DEVICE_DESCRIPTOR` contradiction is gone: compiler construction and host
admission agree, and the ordinary two-kernel chain executes without any
intermediate CPU readback.

## burgus — Metal (Apple M5 Max)

```
$ faber run --backend metal .
device: selected backend `metal` on Apple M5 Max (artifact fnv64:db842cebeeb7119d)
device: identity sha256:38ffffee69c4632f5539696e8acdba8dd0ff4290567938069c877fd81bc9eb1d (A10, complete program)
device: module hash fnv64:db842cebeeb7119d semantic graph hash fnv64:156415e2c118beb3 launches 2 syncs 3 transfers 2 readbacks 1 releases 2 allocated 3
device: completion guaranteed at the explicit step-boundary sync after launch 2
device: launch order: [#0 id=1 kernel_index=0 backend_entry=`collige`, #1 id=2 kernel_index=1 backend_entry=`recollige`]
device: declared resource graph (A10, host receipt):
device:   buffer 1 `a` input per-program version 1 (f32[1024])
device:   buffer 2 `medius` in-out per-step version 1 (f32[4])
device:   buffer 3 `result` output observation-point version 1 (f32[1])
device:   data-flow 1 -> 2 via buffer 2 version 1
device: output buffer 3 `result` = [262912]
device: leak proof: 1 run(s) then teardown -> live_handle_count()=0, driver counters at baseline (module loads 0 releases 0 buffer allocs 0 releases 0)
```

## pharos — CUDA (NVIDIA GeForce RTX 5070)

```
$ faber run --backend cuda .
device: selected backend `cuda` on NVIDIA GeForce RTX 5070 (artifact fnv64:1c3a7b09adcb1a54)
device: identity sha256:38ffffee69c4632f5539696e8acdba8dd0ff4290567938069c877fd81bc9eb1d (A10, complete program)
device: module hash fnv64:1c3a7b09adcb1a54 semantic graph hash fnv64:156415e2c118beb3 launches 2 syncs 3 transfers 2 readbacks 1 releases 2 allocated 3
device: completion guaranteed at the explicit step-boundary sync after launch 2
device: launch order: [#0 id=1 kernel_index=0 backend_entry=`collige`, #1 id=2 kernel_index=1 backend_entry=`recollige`]
device: declared resource graph (A10, host receipt):
device:   buffer 1 `a` input per-program version 1 (f32[1024])
device:   buffer 2 `medius` in-out per-step version 1 (f32[4])
device:   buffer 3 `result` output observation-point version 1 (f32[1])
device:   data-flow 1 -> 2 via buffer 2 version 1
device: output buffer 3 `result` = [262912]
device: leak proof: 1 run(s) then teardown -> live_handle_count()=0, driver counters at baseline (module loads 0 releases 0 buffer allocs 0 releases 0)
```

## Numeric parity (numeric-policy v1.0.0, §3.1 reduction-sum row)

| Machine | Observed | Reference | max \|a−b\| | rule bound | finite | PASS |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| burgus (Metal) | 262912 | 262912.0 | 0 | 0.262913 | yes | **PASS** |
| pharos (CUDA) | 262912 | 262912.0 | 0 | 0.262913 | yes | **PASS** |

Oracle: `oracle/capture.txt`, SHA-256
`318f3683bfc5c7347a6116f4a5a9d1cb6e388f5eecf327fd05381e59cd229fce`
(captured twice, byte-identical, before any device observation).

## The semantic graph hash is backend-neutral (G8)

The semantic graph hash `fnv64:156415e2c118beb3` is computed from the
carried wire facts (semantic values, generations, roots, dependencies,
results, initialization) — the SAME backend-neutral device-program bytes run
on both machines; only the backend module (MSL vs PTX) differs. The receipt
reports it identically on burgus and pharos.

## Leak proof

`FABER_DEVICE_REPEAT=N` runs the two-kernel chain N times on one session,
then teardown: `live_handle_count()==0` and driver counters at baseline on
both machines (no leak of contexts/modules/buffers).

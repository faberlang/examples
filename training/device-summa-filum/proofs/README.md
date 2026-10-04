# device-summa-filum — SFR-6 Metal native-collective receipt

Real-device receipt for the declared distributed sum
(`reducta via summa ex … filum …`), recorded 2026-08-23
(summa-filum-reduction SFR-6). The kernel lowers through
`CollectionKernelPlan::DistributedSum` to the Metal native collective: cyclic
per-lane term-body inline with private register accumulation, exactly ONE
`simd_sum` at group exit, broadcast result — never the portable shared-memory
tree floor.

The source now uses the additive spelling `reducta via summa ex`. The MSL,
device readback, and CPU oracle below are the existing 2026-08-23 evidence;
this syntax update did not rerun the GPU or change the recorded receipt.

## Emitted MSL (from `target/faber-mir/image.fmir`, kernel `column_dot`)

```metal
float acc = 0.0;
for (uint g = i; g < 32u; g += 32u) {
    acc += (a_in[g] * 1.4140625f);
}
float total = simd_sum(acc);
if (local_id.x == 0u && workgroup_id.x < 1u) { output[workgroup_id.x] = total; }
```

Exactly one `simd_sum(` occurrence in the emitted kernel source (the other
`strings` hit is this README's own header carried in the image); no
`threadgroup_barrier`, no `threadgroup float` (the tree floor is NOT
emitted).

## burgus — Metal (Apple M5 Max)

```
$ faber run --backend metal .
outputs: buffer 2 = [62.21875]
launches 1, launch_entries: ["column_dot"], copy_ins 1, syncs 1, transfers 2, readbacks 1, kernel_count 1
```

(CUDA artifact not emitted — `MIR-to-LLVM unsupported: kernel runtime call`;
the CUDA/NVVM native arm is SFR-7, not in this unit.)

## Numeric parity (numeric-policy v1.0.0, §3.1 reduction-sum row)

| Machine | Observed | Reference | max \|a−b\| | rule bound (atol+rtol·\|b\|) | finite | PASS |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| burgus (Metal) | 62.21875 | 62.21875 | 0 | 6.222e-5 | yes | **PASS** |

The comparison applies the tolerance row and never asserts bit-exactness
(the distributed `filum` reduction and sequential oracle fold sum in
different orders by construction). This fixture's
inputs, weight, and per-term products all sit exactly on the binary16 grid,
so the f32 lane accumulations are also exact — the tolerance row is the
contract, not a coincidence being relied on.

Oracle: `oracle/capture.txt`, SHA-256
`2d1dbf1d39c13183fd1f5f2b57673161fc6e5e378a2bcb227711030c5b9f2708`
(captured twice, byte-identical, before any device observation).

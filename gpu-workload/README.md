# GPU workload exempla

Public systems-track workload rungs (matmul, softmax, MLP, …) used by the Radix
GPU workload floor harness.

These are not language-keyword dictionary entries; they live beside
`examples/corpus/` as a named track.

## Rung 3 autograd oracle contract

Rung 3 records the future AIR reverse-mode acceptance target as an oracle, not
as a generated-gradient proof. The scalar loss is:

`rung3_loss(x, weight, target) = (x * weight - target)^2`

For `x = 2.0`, `weight = 3.0`, and `target = 4.0`, the forward loss is `4.0`.
The hand-derived gradient is:

`d_weight = 2 * (x * weight - target) * x = 8.0`

`gpu-workload/rung-3-linear-backward.ref.json` is the consumer oracle for that
future AIR grad seed. The current output-checked device/autograd floor remains
`0`: the rung source emits only the scalar forward loss and does not claim that
AIR, CUDA, or training infrastructure has produced the gradient.

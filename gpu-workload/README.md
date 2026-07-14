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
Accordingly, `gpu-workload/rung-3-linear-backward.expected` records only the
current emitted forward-loss result; `d_weight = 8.0` belongs to the reference
oracle and future acceptance target.

## Rung 4 toy-train/session contract

Rung 4 is an examples-owned toy training/session oracle, not a PyTorch parity
claim and not an optimizer/session workflow proof. The intentionally small
workload is scalar linear regression with fixed values:

- `x = 2.0`
- `y = 4.0`
- `rate = 0.25`
- initial `weight = 0.0`
- update rule: `weight = weight - rate * (weight * x - y) * x`

The two-step oracle is:

| step | previous weight | loss `(weight * x - y)^2` | next weight |
| --- | ---: | ---: | ---: |
| 0 | 0.0 | 16.0 | 2.0 |
| 1 | 2.0 | 0.0 | 2.0 |

`gpu-workload/rung-4-toy-train.ref.json` is the contract map for this rung.
It records the scalar oracle, the expected two launch/session events, the dense
autograd dependency inherited from rung 3, and the current blockers. The
checked sidecar remains an oracle packet for future producer gates; it must not
be cited as proof that Faber currently has optimizer state, session lifecycle,
PyTorch equivalence, or executable CUDA training support.

Validate the examples-owned oracle packet with:

```bash
python3 scripta/check-gpu-workload-contracts.py
```

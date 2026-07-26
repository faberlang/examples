# Training Session Exemplum

A composable training session pattern for Faber language, demonstrating
the model + loss + optimizer + loop structure that every training program
shares.

## Pattern Overview

A training session has four components:

| Component | Role | In this exemplum |
|-----------|------|------------------|
| **Model** | Differentiable forward function | 2×2 linear layer (`input·weight + bias`) |
| **Loss** | Scalar reduction of prediction error | MSE: `mean((prediction − target)²)` |
| **Optimizer** | Parameter update rule | Inline SGD: `param -= lr × grad` |
| **Loop** | Iterate step N times | 8 steps, record loss trace |

The model and loss are combined into one `@ radix backward`-annotated
function (`model_loss`). The compiler generates a backward companion that
returns gradients for every tensor parameter.

### File structure

```
session-exemplum/
  faber.toml        # Package manifest (fmir target, bin kind)
  src/train.fab     # Training session code
  README.md         # This file
```

### Running

```bash
faber run -t fmir examples/training/session-exemplum/
```

Output: 8-element loss trace (should monotonically decrease) followed by
the final weight and bias tensors.

---

## How to swap the model

Define a new differentiable function with `@ radix backward`:

```faber
@ radix lane "air"
@ radix backward "my_model_backward"
functio my_loss(
    tensor<f32, [N,M]> input,
    tensor<f32, [M,K]> weight,
    tensor<f32, [M,K]> bias,
    tensor<f32, [M,K]> target
) → fractus {
    # Your forward math here
    redde ...
}
```

Then in the loop body:
1. Replace the forward math with your model's computation.
2. Call `my_model_backward(...)` instead of `model_backward(...)`.
3. Destructure the gradient tuple to match your parameter count.

**Note on shapes:** Current reverse AD requires all parameter tensors to
share the same shape (no rank-extension broadcast). Biases must be shaped
`[N,M]` (same as the layer output), not `[M]`.

**Existing models to study:**
- `examples/training/linear-regression/` — 2×2 linear + MSE (simplest)
- `examples/training/mlp/` — Two-layer MLP with GELU activation
- `examples/training/bert-tiny-fragment/` — Single-layer BERT-tiny
  (22 trainable params, 16 differentiable ops)

---

## How to swap the loss

The loss is the last operation in the forward function:

```faber
# MSE loss
fixum tensor<f32, [M,K]> residual ← shifted.subtrahe(target)
fixum tensor<f32, [M,K]> squared  ← residual.multiplica(residual)
redde squared.media()

# Cross-entropy loss (PSC-1: runtime layer only — FAB binding pending)
# redde prediction.crux_entropia(target)
```

MSE is the default and ships in the current compiler. Cross-entropy loss
(`crux_entropia`) is available at the Rust runtime layer (PSC-1,
`faber-runtime` commit `bfba771`) — the `Tensor<f32>::crux_entropia(&self,
targets)` method performs softmax → negative log-likelihood with analytical
VJP and domain validation. The FAB → runtime binding is not yet wired, so
the call site above remains commented out in this exemplum.

---

## How the optimizer step works

The current best practice is **inline SGD**:

```faber
# For each trainable parameter:
fixum tensor<f32, [M,K]> lr_fill ← seed.crea(lr, param.magnitudines())
fixum tensor<f32, [M,K]> scaled  ← grad.multiplica(lr_fill)
param ← param.subtrahe(scaled)
```

- `seed.crea(lr, shape)` creates a tensor filled with the learning rate
- `grad.multiplica(lr_fill)` scales the gradient by the learning rate
- `param.subtrahe(scaled)` applies the update

Concrete shape-specific SGD overloads exist in `norma:optimizer` for
`[4]`, `[2,2]`, `[1,2]`, and `[]` shapes. A shape-generic version is
blocked on Radix shape generics (radix tip 8ed5c1434).

---

## Explicit non-claims

This exemplum is **not**:

- A product training library (`norma:training` does not exist)
- A generic tensor-shape SGD implementation
- A dataloader or data pipeline abstraction
- A checkpointing or model serialization mechanism
- A multi-device or GPU training runtime
- A `norma:loss` package
- A replacement for PyTorch or any other training framework

---

## Validation

```bash
faber run -t fmir examples/training/session-exemplum/
```

Expected: 8 loss values (monotonically decreasing) + final weight + final bias.

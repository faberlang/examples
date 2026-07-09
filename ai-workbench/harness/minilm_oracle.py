#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import pathlib
import struct
from dataclasses import dataclass
from typing import Any

import numpy as np
import torch
from tokenizers import Tokenizer


DEFAULT_MODEL_DIR = pathlib.Path("/Users/ianzepp/ai/models/all-MiniLM-L6-v2")
DEFAULT_ORACLE_LABEL = "manual-minilm-torch"


@dataclass(frozen=True)
class MiniLMConfig:
    hidden_size: int
    intermediate_size: int
    layer_norm_eps: float
    max_seq_length: int
    num_attention_heads: int
    num_hidden_layers: int


def read_texts(path: pathlib.Path) -> list[str]:
    return [line.strip() for line in path.read_text().splitlines() if line.strip()]


def read_config(model_dir: pathlib.Path) -> MiniLMConfig:
    config = json.loads((model_dir / "config.json").read_text())
    sentence_config_path = model_dir / "sentence_bert_config.json"
    max_seq_length = 256
    if sentence_config_path.exists():
        sentence_config = json.loads(sentence_config_path.read_text())
        max_seq_length = int(sentence_config.get("max_seq_length", max_seq_length))
    return MiniLMConfig(
        hidden_size=int(config["hidden_size"]),
        intermediate_size=int(config["intermediate_size"]),
        layer_norm_eps=float(config["layer_norm_eps"]),
        max_seq_length=max_seq_length,
        num_attention_heads=int(config["num_attention_heads"]),
        num_hidden_layers=int(config["num_hidden_layers"]),
    )


def load_safetensors(path: pathlib.Path) -> dict[str, torch.Tensor]:
    data = path.read_bytes()
    header_size = struct.unpack("<Q", data[:8])[0]
    header = json.loads(data[8 : 8 + header_size])
    base = 8 + header_size
    weights: dict[str, torch.Tensor] = {}
    dtype_map = {"F32": np.dtype("<f4"), "I64": np.dtype("<i8")}
    for name, meta in header.items():
        if name == "__metadata__":
            continue
        dtype = dtype_map.get(meta["dtype"])
        if dtype is None:
            raise ValueError(f"unsupported safetensors dtype {meta['dtype']} for {name}")
        shape = list(meta["shape"])
        count = math.prod(shape)
        start, _end = meta["data_offsets"]
        array = np.frombuffer(data, dtype=dtype, count=count, offset=base + start)
        tensor = torch.from_numpy(array.reshape(shape).copy())
        weights[name] = tensor.float() if meta["dtype"] == "F32" else tensor.long()
    return weights


def encode_texts(model_dir: pathlib.Path, texts: list[str], max_seq_length: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
    tokenizer.enable_truncation(max_length=max_seq_length)
    encoded = tokenizer.encode_batch(texts)
    max_len = max(len(item.ids) for item in encoded)
    input_ids: list[list[int]] = []
    attention_mask: list[list[int]] = []
    token_type_ids: list[list[int]] = []
    for item in encoded:
        pad = max_len - len(item.ids)
        input_ids.append(item.ids + ([0] * pad))
        attention_mask.append(item.attention_mask + ([0] * pad))
        token_type_ids.append(item.type_ids + ([0] * pad))
    return (
        torch.tensor(input_ids, dtype=torch.long),
        torch.tensor(attention_mask, dtype=torch.long),
        torch.tensor(token_type_ids, dtype=torch.long),
    )


class MiniLMEncoder:
    def __init__(self, config: MiniLMConfig, weights: dict[str, torch.Tensor]) -> None:
        self.config = config
        self.weights = weights

    def layer_norm(self, value: torch.Tensor, prefix: str) -> torch.Tensor:
        return torch.nn.functional.layer_norm(
            value,
            (self.config.hidden_size,),
            self.weights[f"{prefix}.weight"],
            self.weights[f"{prefix}.bias"],
            self.config.layer_norm_eps,
        )

    def linear(self, value: torch.Tensor, prefix: str) -> torch.Tensor:
        return torch.nn.functional.linear(
            value,
            self.weights[f"{prefix}.weight"],
            self.weights[f"{prefix}.bias"],
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        token_type_ids: torch.Tensor,
    ) -> torch.Tensor:
        batch_size, seq_len = input_ids.shape
        positions = torch.arange(seq_len, dtype=torch.long).unsqueeze(0).expand(batch_size, seq_len)
        hidden = self.weights["embeddings.word_embeddings.weight"][input_ids]
        hidden = hidden + self.weights["embeddings.position_embeddings.weight"][positions]
        hidden = hidden + self.weights["embeddings.token_type_embeddings.weight"][token_type_ids]
        hidden = self.layer_norm(hidden, "embeddings.LayerNorm")
        extended_mask = (1.0 - attention_mask[:, None, None, :].float()) * -10000.0

        head_count = self.config.num_attention_heads
        head_size = self.config.hidden_size // head_count

        def split_heads(value: torch.Tensor) -> torch.Tensor:
            return value.view(batch_size, seq_len, head_count, head_size).permute(0, 2, 1, 3)

        for index in range(self.config.num_hidden_layers):
            prefix = f"encoder.layer.{index}"
            query = split_heads(self.linear(hidden, f"{prefix}.attention.self.query"))
            key = split_heads(self.linear(hidden, f"{prefix}.attention.self.key"))
            value = split_heads(self.linear(hidden, f"{prefix}.attention.self.value"))
            scores = torch.matmul(query, key.transpose(-1, -2)) / math.sqrt(head_size)
            probs = torch.nn.functional.softmax(scores + extended_mask, dim=-1)
            context = torch.matmul(probs, value)
            context = context.permute(0, 2, 1, 3).contiguous().view(batch_size, seq_len, self.config.hidden_size)
            attention_output = self.linear(context, f"{prefix}.attention.output.dense")
            hidden = self.layer_norm(attention_output + hidden, f"{prefix}.attention.output.LayerNorm")
            intermediate = torch.nn.functional.gelu(
                self.linear(hidden, f"{prefix}.intermediate.dense"),
                approximate="none",
            )
            layer_output = self.linear(intermediate, f"{prefix}.output.dense")
            hidden = self.layer_norm(layer_output + hidden, f"{prefix}.output.LayerNorm")

        mask = attention_mask.unsqueeze(-1).float()
        pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
        return torch.nn.functional.normalize(pooled, p=2, dim=1)


def embed(model_dir: pathlib.Path, texts: list[str]) -> list[list[float]]:
    if not texts:
        raise ValueError("embedding oracle requires at least one input text")
    torch.set_num_threads(1)
    config = read_config(model_dir)
    weights = load_safetensors(model_dir / "model.safetensors")
    input_ids, attention_mask, token_type_ids = encode_texts(model_dir, texts, config.max_seq_length)
    encoder = MiniLMEncoder(config, weights)
    with torch.no_grad():
        vectors = encoder.forward(input_ids, attention_mask, token_type_ids)
    return [[float(value) for value in row] for row in vectors.tolist()]


def artifact(
    *,
    model_alias: str,
    source: str,
    oracle_label: str,
    texts: list[str],
    vectors: list[list[float]],
) -> dict[str, Any]:
    dimensions = len(vectors[0]) if vectors else 0
    return {
        "format": "fvi-stage2",
        "model": model_alias,
        "source": source,
        "status": "oracle-backed",
        "input_count": len(texts),
        "dimensions": dimensions,
        "normalization": "l2",
        "oracle": oracle_label,
        "vectors": [
            {"id": index, "text": text, "values": values}
            for index, (text, values) in enumerate(zip(texts, vectors))
        ],
        "diagnostics": [
            "vectors generated by manual MiniLM Torch oracle from local durable inventory"
        ],
    }


def max_abs_error(left: dict[str, Any], right: dict[str, Any]) -> float:
    left_vectors = left["vectors"]
    right_vectors = right["vectors"]
    if len(left_vectors) != len(right_vectors):
        raise ValueError("vector count mismatch")
    maximum = 0.0
    for index, (left_item, right_item) in enumerate(zip(left_vectors, right_vectors)):
        left_values = left_item["values"]
        right_values = right_item["values"]
        if len(left_values) != len(right_values):
            raise ValueError(f"dimension mismatch at vector {index}")
        for left_value, right_value in zip(left_values, right_values):
            maximum = max(maximum, abs(float(left_value) - float(right_value)))
    return maximum


def write_artifact(path: pathlib.Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a local MiniLM Stage 2 oracle artifact")
    parser.add_argument("--model-dir", type=pathlib.Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--texts", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    parser.add_argument("--model-alias", default="basic/minilm")
    parser.add_argument("--source", default="sentence-transformers/all-MiniLM-L6-v2")
    parser.add_argument("--oracle-label", default=DEFAULT_ORACLE_LABEL)
    args = parser.parse_args()

    texts = read_texts(args.texts)
    vectors = embed(args.model_dir, texts)
    write_artifact(
        args.out,
        artifact(
            model_alias=args.model_alias,
            source=args.source,
            oracle_label=args.oracle_label,
            texts=texts,
            vectors=vectors,
        ),
    )
    print(f"wrote {len(texts)} vectors with dimension {len(vectors[0]) if vectors else 0} to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

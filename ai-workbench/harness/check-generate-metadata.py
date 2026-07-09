#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import shutil
import struct
import sys
import tempfile
from collections import Counter
from typing import Any


DTYPE_BYTES = {
    "BF16": 2,
    "F16": 2,
    "F32": 4,
    "F64": 8,
    "F8_E4M3": 1,
    "I64": 8,
    "U64": 8,
}


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def read_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_safetensors(path: pathlib.Path, tensors: dict[str, dict[str, Any]]) -> None:
    header = json.dumps(tensors, separators=(",", ":")).encode("ascii")
    body_size = 0
    for tensor in tensors.values():
        count = 1
        for dim in tensor["shape"]:
            count *= dim
        body_size += count * DTYPE_BYTES[tensor["dtype"]]
    path.write_bytes(struct.pack("<Q", len(header)) + header + b"\0" * body_size)


def prepare_fixture_model(source: pathlib.Path, target: pathlib.Path) -> None:
    shutil.copytree(source, target)
    write_safetensors(
        target / "model-00001-of-00002.safetensors",
        {
            "model.embed_tokens.weight": {
                "dtype": "BF16",
                "shape": [4, 4],
                "data_offsets": [0, 32],
            },
            "model.layers.0.mlp.down_proj.weight": {
                "dtype": "F8_E4M3",
                "shape": [4, 4],
                "data_offsets": [32, 48],
            },
        },
    )
    write_safetensors(
        target / "model-00002-of-00002.safetensors",
        {
            "lm_head.weight": {
                "dtype": "F8_E4M3",
                "shape": [4, 8],
                "data_offsets": [0, 32],
            }
        },
    )


def read_safetensors_header(path: pathlib.Path) -> dict[str, Any]:
    with path.open("rb") as file:
        header_len = struct.unpack("<Q", file.read(8))[0]
        if header_len > 16 * 1024 * 1024:
            raise ValueError(f"safetensors header too large: {path}")
        return json.loads(file.read(header_len))


def inspect_model(model_dir: pathlib.Path) -> dict[str, Any]:
    config = read_json(model_dir / "config.json")
    generation = read_json(model_dir / "generation_config.json")
    tokenizer_config = read_json(model_dir / "tokenizer_config.json")
    index = read_json(model_dir / "model.safetensors.index.json")
    weight_map = index["weight_map"]
    shards = sorted(set(weight_map.values()))

    dtype_mix: Counter[str] = Counter()
    estimated_from_headers = 0
    header_tensor_count = 0
    for shard in shards:
        header = read_safetensors_header(model_dir / shard)
        for name, tensor in header.items():
            if name == "__metadata__":
                continue
            dtype = tensor["dtype"]
            dtype_mix[dtype] += 1
            header_tensor_count += 1
            count = 1
            for dim in tensor["shape"]:
                count *= dim
            estimated_from_headers += count * DTYPE_BYTES.get(dtype, 0)

    total_size = int(index.get("metadata", {}).get("total_size", 0))
    tokenizer_json = model_dir / "tokenizer.json"
    tokenizer_json_present = tokenizer_json.is_file() and tokenizer_json.stat().st_size > 0
    chat_template = tokenizer_config.get("chat_template") or ""

    return {
        "architecture": (config.get("architectures") or [""])[0],
        "model_type": config.get("model_type", ""),
        "quantization_method": config.get("quantization_config", {}).get("quant_method", ""),
        "quantization_format": config.get("quantization_config", {}).get("fmt", ""),
        "torch_dtype": config.get("torch_dtype", ""),
        "hidden_size": config.get("hidden_size", 0),
        "num_hidden_layers": config.get("num_hidden_layers", 0),
        "num_attention_heads": config.get("num_attention_heads", 0),
        "num_key_value_heads": config.get("num_key_value_heads", 0),
        "max_position_embeddings": config.get("max_position_embeddings", 0),
        "shards": shards,
        "index_tensor_count": len(weight_map),
        "header_tensor_count": header_tensor_count,
        "dtype_mix": dict(sorted(dtype_mix.items())),
        "index_total_size": total_size,
        "estimated_bytes_from_headers": estimated_from_headers,
        "tokenizer_json_present": tokenizer_json_present,
        "tokenizer_class": tokenizer_config.get("tokenizer_class", ""),
        "chat_template_present": bool(chat_template.strip()),
        "model_max_length": tokenizer_config.get("model_max_length", 0),
        "generation_do_sample": generation.get("do_sample", False),
        "generation_temperature": generation.get("temperature", 0),
        "generation_top_p": generation.get("top_p", 0),
        "memory_note": (
            "bounded metadata floor only: model storage plus KV/cache/runtime "
            "overhead; no full model load"
        ),
    }


def expect(name: str, actual: dict[str, Any], expected: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    for key, value in expected.items():
        if actual.get(key) != value:
            failures.append(f"{name}: {key}={actual.get(key)!r}, expected {value!r}")
    return failures


def main() -> int:
    root = workspace_root()
    fixture_source = root / "examples/ai-workbench/harness/fixtures/generate-metadata"
    local_model = pathlib.Path("/Users/ianzepp/ai/models/Qwen3-4B-FP8")
    failures: list[str] = []

    with tempfile.TemporaryDirectory(prefix="faber-ai-generate-metadata-") as temp:
        fixture_model = pathlib.Path(temp) / "model"
        prepare_fixture_model(fixture_source, fixture_model)
        fixture = inspect_model(fixture_model)
        failures.extend(
            expect(
                "tiny-fixture",
                fixture,
                {
                    "architecture": "TinyForCausalLM",
                    "model_type": "tiny-qwen",
                    "quantization_method": "fp8",
                    "quantization_format": "e4m3",
                    "torch_dtype": "bfloat16",
                    "index_tensor_count": 3,
                    "header_tensor_count": 3,
                    "dtype_mix": {"BF16": 1, "F8_E4M3": 2},
                    "tokenizer_json_present": True,
                    "tokenizer_class": "TinyTokenizer",
                    "chat_template_present": True,
                },
            )
        )

    if not local_model.exists():
        failures.append(f"local-qwen3-fp8: missing local model directory {local_model}")
    else:
        local = inspect_model(local_model)
        failures.extend(
            expect(
                "local-qwen3-fp8",
                local,
                {
                    "architecture": "Qwen3ForCausalLM",
                    "model_type": "qwen3",
                    "quantization_method": "fp8",
                    "quantization_format": "e4m3",
                    "torch_dtype": "bfloat16",
                    "hidden_size": 2560,
                    "num_hidden_layers": 36,
                    "num_attention_heads": 32,
                    "num_key_value_heads": 8,
                    "index_tensor_count": 651,
                    "header_tensor_count": 651,
                    "dtype_mix": {"BF16": 399, "F8_E4M3": 252},
                    "index_total_size": 5191286912,
                    "estimated_bytes_from_headers": 5189976192,
                    "tokenizer_json_present": True,
                    "tokenizer_class": "Qwen2Tokenizer",
                    "chat_template_present": True,
                    "model_max_length": 131072,
                },
            )
        )

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: generate metadata fixture + local qwen3-fp8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

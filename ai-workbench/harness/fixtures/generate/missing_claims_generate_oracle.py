#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import pathlib


def main() -> int:
    parser = argparse.ArgumentParser(description="Hermetic generate oracle without claims")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--model-alias", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--oracle-label", required=True)
    parser.add_argument("--max-new-tokens", required=True)
    parser.add_argument("--temperature", required=True)
    parser.add_argument("--seed", required=True)
    args = parser.parse_args()

    prompt = pathlib.Path(args.prompt).read_text().strip()
    output = pathlib.Path(args.out)
    events = [
        {
            "event": "metadata",
            "model": args.model_alias,
            "source": args.source,
            "status": "oracle-backed",
            "runtime": args.oracle_label,
            "prompt": prompt,
            "max_new_tokens": int(args.max_new_tokens),
            "temperature": args.temperature,
            "seed": int(args.seed),
        },
        {"event": "token", "text": "Local"},
        {"event": "final", "text": "Local inventory."},
    ]
    output.write_text("\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

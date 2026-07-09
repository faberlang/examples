#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import pathlib


def main() -> int:
    parser = argparse.ArgumentParser(description="Hermetic fake Stage 7 chat router")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--model-alias", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--router-model-id", required=True)
    parser.add_argument("--local-path", required=True)
    parser.add_argument("--router-label", required=True)
    parser.add_argument("--router-url", required=True)
    args = parser.parse_args()

    prompt = pathlib.Path(args.prompt).read_text().strip()
    output = pathlib.Path(args.out)
    events = [
        {
            "event": "metadata",
            "model": args.model_alias,
            "source": args.source,
            "status": "router-backed",
            "runtime": args.router_label,
            "router_model_id": args.router_model_id,
            "router_url": args.router_url,
            "local_path": args.local_path,
        },
        {"event": "prompt", "text": prompt},
        {"event": "message", "role": "assistant", "text": "The local router is an external runtime adapter."},
        {"event": "final", "finish_reason": "stop"},
    ]
    output.write_text("\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

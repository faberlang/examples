#!/usr/bin/env python3
import sys

print("simulated oracle dependency failure", file=sys.stderr)
raise SystemExit(2)

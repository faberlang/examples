import { applyOp, sqrt, type Op } from "./math.js";

function parseOp(s: string): Op {
  if (s === "+" || s === "-" || s === "*" || s === "/" || s === "%" || s === "^") {
    return s;
  }
  throw new Error(`unknown op: ${s}`);
}

function main(): void {
  try {
    if (process.argv[2] === "sqrt") {
      const n = Number(process.argv[3]);
      if (Number.isNaN(n)) {
        throw new Error("usage: calc sqrt <n>");
      }
      console.log(String(sqrt(n)));
      return;
    }
    const a = Number(process.argv[2]);
    const op = parseOp(process.argv[3] ?? "");
    const b = Number(process.argv[4]);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new Error("usage: calc <a> <op> <b> | calc sqrt <n>");
    }
    console.log(String(applyOp(op, a, b)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    console.error(msg);
    process.exit(1);
  }
}

main();

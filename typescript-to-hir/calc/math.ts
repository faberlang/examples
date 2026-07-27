export type Op = "+" | "-" | "*" | "/" | "%" | "^";

export function applyOp(op: Op, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) {
        throw new Error("division by zero");
      }
      return a / b;
    case "%":
      if (b === 0) {
        throw new Error("modulo by zero");
      }
      return a % b;
    case "^":
      return Math.pow(a, b);
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

export function sqrt(n: number): number {
  if (n < 0) {
    throw new Error("sqrt of negative");
  }
  return Math.sqrt(n);
}

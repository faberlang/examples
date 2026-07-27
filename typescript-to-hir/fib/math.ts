/** Pure Fibonacci helpers — spike construct surface. */

export function fibIter(n: number): number {
  if (n <= 0) {
    return 0;
  }
  if (n === 1) {
    return 1;
  }
  let a = 0;
  let b = 1;
  let i = 2;
  while (i <= n) {
    const next = a + b;
    a = b;
    b = next;
    i = i + 1;
  }
  return b;
}

export function fibRec(n: number): number {
  if (n <= 0) {
    return 0;
  }
  if (n === 1) {
    return 1;
  }
  return fibRec(n - 1) + fibRec(n - 2);
}

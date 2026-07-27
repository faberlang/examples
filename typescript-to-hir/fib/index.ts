import { fibIter } from "./math.js";

function main(): void {
  const raw = process.argv[2];
  if (raw === undefined) {
    console.error("usage: fib <n>");
    process.exit(1);
  }
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) {
    console.error("n must be a non-negative number");
    process.exit(1);
  }
  console.log(String(fibIter(Math.floor(n))));
}

main();

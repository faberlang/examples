import { countText } from "./count.js";

function main(): void {
  const text = process.argv[2] ?? "";
  const c = countText(text);
  console.log(`${c.lines}\t${c.words}\t${c.chars}`);
}

main();

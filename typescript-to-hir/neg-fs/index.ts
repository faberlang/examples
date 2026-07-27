import { readText } from "./reader.js";

function main(): void {
  const path = process.argv[2];
  if (path === undefined) {
    console.error("usage: neg-fs <path>");
    process.exit(1);
  }
  console.log(readText(path));
}

main();

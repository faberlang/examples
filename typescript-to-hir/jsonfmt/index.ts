import { prettyJson } from "./format.js";

function main(): void {
  const arg = process.argv[2];
  if (arg === undefined) {
    console.error("usage: jsonfmt '<json-text>'");
    process.exit(1);
  }
  try {
    console.log(prettyJson(arg));
  } catch (_err) {
    console.error("invalid JSON");
    process.exit(1);
  }
}

main();

import { decode, encode } from "./codec.js";

function main(): void {
  const cmd = process.argv[2];
  const input = process.argv[3] ?? "";
  try {
    if (cmd === "encode") {
      console.log(encode(input));
      return;
    }
    if (cmd === "decode") {
      console.log(decode(input));
      return;
    }
    console.error("usage: base64 encode|decode <text>");
    process.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    console.error(msg);
    process.exit(1);
  }
}

main();

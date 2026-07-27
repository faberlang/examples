// Negative corpus: Node fs + CJS require — must fence under check.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs") as { readFileSync: (p: string, enc: string) => string };

export function readText(path: string): string {
  return fs.readFileSync(path, "utf8");
}

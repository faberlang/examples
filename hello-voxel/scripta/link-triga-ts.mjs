#!/usr/bin/env node
// Link pure Triga Faber sources into the hello-voxel browser TypeScript product.
//
// Faber browser packaging only ambient-declares web:*; pure library packages
// (triga) emit as external imports with no module. This script:
//   1. Runs `faber emit -t ts` on triga geometry + triga modules
//   2. Wraps free functions/classes as `export const geometry|triga = { ... }`
//   3. Rewrites main.ts imports to relative paths
//   4. Completes tsc + controllers.json
//
// Matrices remain Triga-authored (emitted from triga/src/*.fab), not hand-rolled JS.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const WORKSPACE = resolve(APP_DIR, "../..");
const FABER_BIN = process.env.FABER || join(WORKSPACE, "faber/target/debug/faber");
const TRIGA_SRC = join(WORKSPACE, "triga/src");
const TS_ROOT = join(APP_DIR, "dist/faber-ts");
const ESM_ROOT = join(APP_DIR, "dist/faber-esm");
const TSCONFIG = join(APP_DIR, "dist/tsconfig.faber-browser.json");

function die(msg) {
  console.error(`link-triga-ts: ${msg}`);
  process.exit(1);
}

function emitTs(fabPath) {
  const result = spawnSync(FABER_BIN, ["emit", "-t", "ts", fabPath], {
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    die(`emit failed for ${fabPath}:\n${result.stderr || result.stdout}`);
  }
  // Warnings go to stderr; code is stdout.
  return result.stdout;
}

function collectExports(code) {
  const names = new Set();
  for (const m of code.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/^(?:export\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:=]/gm)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/^type\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) {
    // types are erased; skip
    void m;
  }
  return [...names].sort();
}

function patchEmitDefects(code) {
  let body = code;
  // Radix TS emit lowers indexed writes to an IIFE read used as assignment LHS.
  // Rewrite: ((__o,__i)=>{...return __v})(arr, idx) = value
  // into: arr[idx] = value
  body = body.replace(
    /\(\(__o, __i\) => \{ const __v = __o\[__i\]; if \(__v === undefined\) throw new Error\("index trap"\); return __v; \}\)\(([^,]+),\s*([^)]+)\)\s*=/g,
    "($1)[$2] =",
  );
  // Standalone emit leaves some union types as unresolved_def.
  body = body.replace(/\bunresolved_def\b/g, "any");
  return body;
}

function wrapNamespace(code, nsName, relativeImports = {}) {
  let body = patchEmitDefects(code);
  // Rewrite virtual library imports to relative files.
  for (const [spec, rel] of Object.entries(relativeImports)) {
    body = body.replaceAll(`from "${spec}"`, `from "${rel}"`);
    body = body.replaceAll(`from '${spec}'`, `from '${rel}'`);
  }
  const names = collectExports(body);
  if (names.length === 0) {
    die(`no exportable symbols found for namespace ${nsName}`);
  }
  const exportBlock = `\nexport const ${nsName} = {\n${names
    .map((n) => `  ${n},`)
    .join("\n")}\n};\n`;
  // Linked pure-library emit is not always strict-clean under standalone tsc;
  // matrices remain Triga-authored Faber source lowered by radix.
  return `// @ts-nocheck\n${body.trimEnd()}\n${exportBlock}`;
}

function rewriteMainImports(mainPath) {
  let code = readFileSync(mainPath, "utf-8");
  code = code.replace(
    /import\s*\{\s*triga\s*\}\s*from\s*["']triga:triga["']\s*;?/,
    'import { triga } from "./triga-triga.js";',
  );
  code = code.replace(
    /import\s*\{\s*geometry\s*\}\s*from\s*["']triga:geometry["']\s*;?/,
    'import { geometry } from "./triga-geometry.js";',
  );
  writeFileSync(mainPath, code);
}

function writeControllersJson() {
  const controllers = [
    {
      name: "hello_voxel_controller",
      selector: "#hello-voxel-root",
      module: "./main.js",
      export: "hello_voxel_controller",
    },
  ];
  writeFileSync(
    join(APP_DIR, "dist/controllers.json"),
    `${JSON.stringify(controllers, null, 2)}\n`,
  );
}

function runTsc() {
  if (!existsSync(TSCONFIG)) {
    die(`missing ${TSCONFIG}`);
  }
  const result = spawnSync("npx", ["--yes", "tsc", "-p", TSCONFIG], {
    encoding: "utf-8",
    cwd: APP_DIR,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    die(`tsc failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function main() {
  if (!existsSync(join(TS_ROOT, "main.ts"))) {
    die("dist/faber-ts/main.ts missing — run faber build first (even if tsc fails)");
  }
  mkdirSync(TS_ROOT, { recursive: true });
  mkdirSync(ESM_ROOT, { recursive: true });

  const geometryRaw = emitTs(join(TRIGA_SRC, "geometry.fab"));
  const trigaRaw = emitTs(join(TRIGA_SRC, "triga.fab"));

  writeFileSync(
    join(TS_ROOT, "triga-geometry.ts"),
    wrapNamespace(geometryRaw, "geometry"),
  );
  writeFileSync(
    join(TS_ROOT, "triga-triga.ts"),
    wrapNamespace(trigaRaw, "triga", {
      "triga:geometry": "./triga-geometry.js",
    }),
  );

  rewriteMainImports(join(TS_ROOT, "main.ts"));
  runTsc();
  writeControllersJson();

  const esmEntry = join(ESM_ROOT, "faber-browser.js");
  if (!existsSync(esmEntry)) {
    die(`expected ${esmEntry} after tsc`);
  }
  console.log(
    `link-triga-ts: ok — linked ${readdirSync(TS_ROOT).filter((f) => f.startsWith("triga-")).join(", ")}`,
  );
}

main();

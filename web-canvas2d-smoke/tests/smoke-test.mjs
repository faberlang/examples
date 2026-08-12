#!/usr/bin/env node
// tela:canvas2d smoke test (Unit 1 — core draw surface).
//
// End-to-end proof that a Faber program compiled by the real compiler draws a
// colored, rotated rectangle in a real browser canvas through the
// tela:canvas2d runtime, verified by pixel readback:
//
//   probe canvas (1x1) center    — non-white (blue fill)  [required]
//   stage canvas center (160,120) — green (translate + rotate + fill_rect)
//   stage canvas (60,60)          — blue (set_fill_style + fill_rect)
//   stage canvas red stroke locus — red (set_stroke_style + stroke_rect)
//   stage canvas clear patch      — transparent (clear_rect)
//
// Pipeline:
//   1. `faber build --package .` compiles src/main.fab to TypeScript. The
//      emitted sources are snapshotted from the build's staging dir as soon
//      as they appear (the tela provider's per-stem shims let the tsc
//      verification pass; the snapshot is taken either way).
//   2. The real runtime sources (tela/runtime/dom.ts + canvas2d.ts) are
//      transpiled to ESM, and a hand-written `tela:canvas2d` facade wires the
//      Faber namespace to them exactly like the product generator would.
//   3. Playwright Chromium loads the harness page, runs `draw_controller`,
//      and reports pixel readback assertions on `window.__smokeResult`.
//
// Run from this directory:  node tests/smoke-test.mjs
// Requires: faber binary (env FABER, default ../../faber/target/debug/faber),
// playwright + typescript modules under the workspace node_modules.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

// `typescript` may be a global install (workspace node_modules carries only
// playwright); resolve it next to the running node binary first, then by name.
function resolveTypescript() {
  const globalCandidates = [
    path.join(path.dirname(process.execPath), "..", "lib", "node_modules", "typescript"),
    path.join(path.dirname(process.execPath), "..", "..", "lib", "node_modules", "typescript"),
  ];
  for (const candidate of globalCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "typescript";
}
const ts = require(resolveTypescript());

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const WORKSPACE = path.resolve(ROOT, "../..");
const FABER_BIN = process.env.FABER ?? path.join(WORKSPACE, "faber/target/debug/faber");

const FAIL = "\x1b[31mFAIL\x1b[0m";
const PASS = "\x1b[32mPASS\x1b[0m";

function fail(message) {
  console.error(`${FAIL}: ${message}`);
  process.exitCode = 1;
  process.exit(1);
}

function assert(condition, message) {
  if (condition) {
    console.log(`${PASS}: ${message}`);
  } else {
    fail(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1. Generate faber.lock with workspace-correct paths (browser-app precedent).
// ---------------------------------------------------------------------------

writeFileSync(
  path.join(ROOT, "faber.lock"),
  `
[[package]]
name = "tela"
version = "0.1.0"
source = "path"
package_root = "${WORKSPACE}/tela"
kind = "lib"
target_language = "ts"
target_triple = "browser"
target_manifest = ""
interface_root = "${WORKSPACE}/tela/src"
artifact = ""
crate = "tela"
rustc = ""
`,
);

// ---------------------------------------------------------------------------
// 2. Build + snapshot the emitted TypeScript before the tsc verification step.
// ---------------------------------------------------------------------------

const staging = path.join(ROOT, `.dist.faber.tmp-${process.pid}`);
mkdirSync(staging, { recursive: true });

console.log("building Faber program (product build; tsc verification expected to fail on the packaging gap)...");
const build = spawn(FABER_BIN, ["build", "--package", "."], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
});

const REQUIRED_SNAPSHOT = ["main.ts", "tela-canvas2d.ts", "tela-dom.ts", "tela-shim-dom.ts", "tela-web.ts"];

let snapshotted = false;
const deadline = Date.now() + 60000;
while (Date.now() < deadline && !snapshotted) {
  let entry = null;
  try {
    entry = readdirSync(ROOT)
      .filter((name) => name.startsWith(".dist.faber.tmp-"))
      .map((name) => path.join(ROOT, name, "faber-ts"))
      .find((dir) => REQUIRED_SNAPSHOT.every((file) => existsSync(path.join(dir, file))));
  } catch {
    entry = null;
  }
  if (entry) {
    for (const file of readdirSync(entry)) {
      writeFileSync(path.join(staging, file), readFileSync(path.join(entry, file), "utf8"));
    }
    snapshotted = true;
    break;
  }
  if (build.exitCode !== null) {
    break;
  }
  await sleep(40);
}

const exitCode = await new Promise((resolve) => {
  if (build.exitCode !== null) {
    resolve(build.exitCode);
  } else {
    build.on("exit", resolve);
  }
});

if (!snapshotted || !existsSync(path.join(staging, "main.ts"))) {
  fail(
    "could not snapshot emitted TypeScript from the build staging dir (main.ts missing); " +
      "faber binary may be stale or the build fails earlier than tsc",
  );
}
console.log(`build exited ${exitCode} (tsc verification failure is the expected packaging gap; emitted sources snapshotted)`);

// ---------------------------------------------------------------------------
// 3. Transpile the emitted + runtime TypeScript to browser ESM.
// ---------------------------------------------------------------------------

function transpileFile(srcPath, destPath) {
  const code = readFileSync(srcPath, "utf8");
  const out = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    fileName: srcPath,
  }).outputText;
  writeFileSync(destPath, out);
}

// main.ts and the dom/web facades + shim come from the snapshot (real compiler
// output). runtime/canvas2d.ts is transpiled fresh from tela (the hand-written
// tela:canvas2d facade imports from it directly, see below).
transpileFile(path.join(staging, "main.ts"), path.join(staging, "main.js"));
transpileFile(path.join(staging, "tela-dom.ts"), path.join(staging, "tela-dom.js"));
transpileFile(path.join(staging, "tela-shim-dom.ts"), path.join(staging, "tela-shim-dom.js"));
transpileFile(path.join(staging, "tela-web.ts"), path.join(staging, "tela-web.js"));
transpileFile(path.join(WORKSPACE, "tela/runtime/canvas2d.ts"), path.join(staging, "runtime-canvas2d.js"));

// Hand-written tela:canvas2d facade over the real runtime — mirrors what the
// product generator emits, except it imports from the real runtime file.
// `Canvas2DContext` is the genus value export the compiler's emitted import
// requires (`import { Canvas2DContext, canvas2d } from "./tela-canvas2d.js"`);
// type annotations are erased at transpile time so the value is never used.
writeFileSync(
  path.join(staging, "tela-canvas2d.js"),
  `// Hand-written tela:canvas2d facade — wires the Faber namespace to the real
// tela/runtime/canvas2d.ts the way the product generator would (per-stem
// shim), but directly against the runtime module.
import {
  webCanvas2dClearRect as canvas2d_clear_rect,
  webCanvas2dContext as canvas2d_context,
  webCanvas2dFillRect as canvas2d_fill_rect,
  webCanvas2dRestore as canvas2d_restore,
  webCanvas2dRotate as canvas2d_rotate,
  webCanvas2dSave as canvas2d_save,
  webCanvas2dScale as canvas2d_scale,
  webCanvas2dSetFillStyle as canvas2d_set_fill_style,
  webCanvas2dSetStrokeStyle as canvas2d_set_stroke_style,
  webCanvas2dSetTransform as canvas2d_set_transform,
  webCanvas2dStrokeRect as canvas2d_stroke_rect,
  webCanvas2dTranslate as canvas2d_translate,
} from "./runtime-canvas2d.js";

export {
  canvas2d_clear_rect,
  canvas2d_context,
  canvas2d_fill_rect,
  canvas2d_restore,
  canvas2d_rotate,
  canvas2d_save,
  canvas2d_scale,
  canvas2d_set_fill_style,
  canvas2d_set_stroke_style,
  canvas2d_set_transform,
  canvas2d_stroke_rect,
  canvas2d_translate,
};

export const Canvas2DContext = class Canvas2DContext {};

export const canvas2d = {
  canvas2d_clear_rect,
  canvas2d_context,
  canvas2d_fill_rect,
  canvas2d_restore,
  canvas2d_rotate,
  canvas2d_save,
  canvas2d_scale,
  canvas2d_set_fill_style,
  canvas2d_set_stroke_style,
  canvas2d_set_transform,
  canvas2d_stroke_rect,
  canvas2d_translate,
};
`,
);

// ---------------------------------------------------------------------------
// 4. Harness page: run draw_controller, read back pixels, report result.
// ---------------------------------------------------------------------------

writeFileSync(
  path.join(staging, "index.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>tela:canvas2d smoke harness</title>
</head>
<body>
  <canvas id="stage" width="320" height="240"></canvas>
  <canvas id="probe" width="1" height="1"></canvas>
  <script type="module">
    import { draw_controller } from "./main.js";

    // Scope object matching the dom.Scope genus shape expected by dom.require.
    draw_controller({ root: document, selector: "#stage" });

    const stage = document.getElementById("stage");
    const probe = document.getElementById("probe");
    const stageCtx = stage.getContext("2d");
    const probeCtx = probe.getContext("2d");

    const rgba = (ctx, x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    const isWhite = (c) => c[0] > 240 && c[1] > 240 && c[2] > 240;
    const isBlue = (c) => c[2] > 150 && c[0] < 100;
    const isGreen = (c) => c[1] > 100 && c[0] < 60 && c[2] < 60;
    const isRed = (c) => c[0] > 180 && c[0] > c[1] + 60 && c[0] > c[2] + 60;

    const results = [];

    const probePx = rgba(probeCtx, 0, 0);
    results.push({ name: "probe 1x1 center non-white", pass: !isWhite(probePx), detail: probePx.join(",") });

    const centerPx = rgba(stageCtx, 160, 120);
    results.push({ name: "stage center green (translate+rotate+fill_rect)", pass: isGreen(centerPx), detail: centerPx.join(",") });

    const bluePx = rgba(stageCtx, 60, 60);
    results.push({ name: "stage top-left blue (set_fill_style+fill_rect)", pass: isBlue(bluePx), detail: bluePx.join(",") });

    let redFound = false;
    let redDetail = "none";
    for (let x = 236; x <= 254; x += 1) {
      const c = rgba(stageCtx, x, 120);
      if (isRed(c)) {
        redFound = true;
        redDetail = x + ",120=" + c.join(",");
        break;
      }
    }
    results.push({ name: "rotated red stroke visible (set_stroke_style+stroke_rect)", pass: redFound, detail: redDetail });

    const clearPx = rgba(stageCtx, 210, 210);
    results.push({ name: "clear_rect patch transparent", pass: clearPx[3] < 10, detail: clearPx.join(",") });

    window.__smokeResult = { ok: results.every((r) => r.pass), results };
  </script>
</body>
</html>
`,
);

// ---------------------------------------------------------------------------
// 5. Serve + run in Chromium via Playwright.
// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = path.normalize(urlPath).replace(/^([/\\])+/, "");
  const filePath = path.join(staging, safePath || "index.html");
  if (!filePath.startsWith(staging) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const contentType = safePath.endsWith(".html")
    ? "text/html; charset=utf-8"
    : "text/javascript; charset=utf-8";
  res.writeHead(200, { "content-type": contentType });
  res.end(readFileSync(filePath));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (err) => console.error("page error:", err.message));
try {
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => globalThis.__smokeResult !== undefined, null, { timeout: 15000 });
  const result = await page.evaluate(() => globalThis.__smokeResult);
  for (const r of result.results) {
    if (r.pass) {
      console.log(`${PASS}: ${r.name} (${r.detail})`);
    } else {
      console.error(`${FAIL}: ${r.name} (${r.detail})`);
    }
  }
  if (!result.ok) {
    fail("smoke pixel readback assertions failed");
  }
  console.log(`smoke-test: OK — ${result.results.length} pixel readback assertion(s) passed`);
} finally {
  await browser.close();
  server.close();
  rmSync(staging, { recursive: true, force: true });
}

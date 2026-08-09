#!/usr/bin/env node
// web:canvas2d interactive fixture test (Unit 2 — paths, Path2D, text,
// interactivity).
//
// End-to-end proof that the Faber interactive program (src/main.fab) runs in
// a real browser and that pan / zoom / drag / frame-redraw all work through
// the web:canvas2d + web:dom bindings:
//
//   • initial render — pixel probes confirm every Unit 2 draw surface landed:
//     tomato rect, gold Path2D star (from_svg + fill + stroke), steelblue
//     ellipse, green arc, blue clip region, white elsewhere
//   • drag — pointer drag on the rectangle moves it (userland point_in_rect
//     hit-test); pixel probes + data-rect-* attrs confirm the new position
//   • pan — pointer drag on empty space moves the camera; probes + data-cam-*
//     attrs confirm the offset
//   • zoom — one wheel event multiplies zoom by the fixed 1.2 factor; a pixel
//     probe that is outside the rect at zoom 1 lands inside at zoom 1.2
//   • redraw — the on_frame loop keeps re-rendering (data-frame-count climbs)
//
// Pipeline (mirrors examples/web-canvas2d-smoke, Unit 1):
//   1. `faber build --package .` compiles src/main.fab to TypeScript. The
//      browser product build's tsc verification cannot pass while the running
//      faber binary predates hand-5's b7cc2e9 per-stem shim fix ([shims.canvas2d]
//      is declared in faber-web/bindings/ts.toml; a rebuilt faber consumes it,
//      the current binary ignores it and emits the old single-shim facade).
//      The emitted sources are snapshotted from the build's staging dir
//      before the tsc step fails.
//   2. The real runtime sources (faber-web/runtime/dom.ts + canvas2d.ts) are
//      transpiled to ESM, and a hand-written `web:canvas2d` facade wires the
//      Faber namespace to the real runtime exactly like the product generator
//      does — including the Canvas2dContext/Path2D genus-value exports the
//      emitted main.ts imports.
//   3. Playwright Chromium loads the harness page, runs the controller, and
//      the test drives real pointer + wheel events and probes pixels.
//
// Run from this directory:  node tests/interactive-test.mjs
// Requires: faber binary (env FABER, default ../../faber/target/debug/faber),
// playwright + typescript modules under the workspace node_modules.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

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
  process.exit(1);
}

function assert(condition, message, detail = "") {
  if (condition) {
    console.log(`${PASS}: ${message}${detail ? ` (${detail})` : ""}`);
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
name = "web"
version = "0.1.0"
source = "path"
package_root = "${WORKSPACE}/faber-web"
kind = "lib"
target_language = "ts"
target_triple = "browser"
target_manifest = ""
interface_root = "${WORKSPACE}/faber-web/src"
artifact = ""
crate = "web"
rustc = ""
`,
);

// ---------------------------------------------------------------------------
// 2. Build + snapshot the emitted TypeScript before the tsc verification step.
// ---------------------------------------------------------------------------

const staging = path.join(tmpdir(), `canvas2d-interactive-${process.pid}`);
mkdirSync(staging, { recursive: true });

console.log("building Faber program (product build; tsc verification expected to fail on the stale-binary packaging gap)...");
const build = spawn(FABER_BIN, ["build", "--package", "."], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
});

const REQUIRED_SNAPSHOT = ["main.ts", "web-canvas2d.ts", "web-dom.ts", "web-shim-dom.ts", "web-web.ts"];

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
console.log(`build exited ${exitCode} (tsc verification failure is the expected stale-binary packaging gap; emitted sources snapshotted)`);

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

transpileFile(path.join(staging, "main.ts"), path.join(staging, "main.js"));
transpileFile(path.join(staging, "web-dom.ts"), path.join(staging, "web-dom.js"));
transpileFile(path.join(staging, "web-shim-dom.ts"), path.join(staging, "web-shim-dom.js"));
transpileFile(path.join(staging, "web-web.ts"), path.join(staging, "web-web.js"));
transpileFile(path.join(WORKSPACE, "faber-web/runtime/canvas2d.ts"), path.join(staging, "runtime-canvas2d.js"));
copyFileSync(path.join(ROOT, "pages/index.html"), path.join(staging, "index.html"));

// Hand-written web:canvas2d facade over the real runtime — mirrors what the
// product generator emits, except it imports from the real runtime file
// (the stale-binary generated facade imports webCanvas2d* from the dom shim,
// which is the packaging gap; see header note). `Canvas2dContext` and
// `Path2D` are the genus-value exports the emitted main.ts imports; type
// annotations are erased at transpile time so the values are never used.
writeFileSync(
  path.join(staging, "web-canvas2d.js"),
  `// Hand-written web:canvas2d facade — see interactive-test.mjs header note.
import {
  webCanvas2dArc as canvas2d_arc,
  webCanvas2dBeginPath as canvas2d_begin_path,
  webCanvas2dClearRect as canvas2d_clear_rect,
  webCanvas2dClip as canvas2d_clip,
  webCanvas2dClosePath as canvas2d_close_path,
  webCanvas2dContext as canvas2d_context,
  webCanvas2dEllipse as canvas2d_ellipse,
  webCanvas2dFill as canvas2d_fill,
  webCanvas2dFillRect as canvas2d_fill_rect,
  webCanvas2dFillText as canvas2d_fill_text,
  webCanvas2dLineTo as canvas2d_line_to,
  webCanvas2dMoveTo as canvas2d_move_to,
  webCanvas2dPath2DFill as canvas2d_path2d_fill,
  webCanvas2dPath2DNew as canvas2d_path2d_new,
  webCanvas2dPath2DNewFromSvg as canvas2d_path2d_new_from_svg,
  webCanvas2dPath2DStroke as canvas2d_path2d_stroke,
  webCanvas2dRestore as canvas2d_restore,
  webCanvas2dRotate as canvas2d_rotate,
  webCanvas2dSave as canvas2d_save,
  webCanvas2dScale as canvas2d_scale,
  webCanvas2dSetFillStyle as canvas2d_set_fill_style,
  webCanvas2dSetFont as canvas2d_set_font,
  webCanvas2dSetStrokeStyle as canvas2d_set_stroke_style,
  webCanvas2dSetTextAlign as canvas2d_set_text_align,
  webCanvas2dSetTextBaseline as canvas2d_set_text_baseline,
  webCanvas2dSetTransform as canvas2d_set_transform,
  webCanvas2dStroke as canvas2d_stroke,
  webCanvas2dStrokeRect as canvas2d_stroke_rect,
  webCanvas2dTranslate as canvas2d_translate,
} from "./runtime-canvas2d.js";

export {
  canvas2d_arc,
  canvas2d_begin_path,
  canvas2d_clear_rect,
  canvas2d_clip,
  canvas2d_close_path,
  canvas2d_context,
  canvas2d_ellipse,
  canvas2d_fill,
  canvas2d_fill_rect,
  canvas2d_fill_text,
  canvas2d_line_to,
  canvas2d_move_to,
  canvas2d_path2d_fill,
  canvas2d_path2d_new,
  canvas2d_path2d_new_from_svg,
  canvas2d_path2d_stroke,
  canvas2d_restore,
  canvas2d_rotate,
  canvas2d_save,
  canvas2d_scale,
  canvas2d_set_fill_style,
  canvas2d_set_font,
  canvas2d_set_stroke_style,
  canvas2d_set_text_align,
  canvas2d_set_text_baseline,
  canvas2d_set_transform,
  canvas2d_stroke,
  canvas2d_stroke_rect,
  canvas2d_translate,
};

export const Canvas2dContext = class Canvas2dContext {};
export const Path2D = class Path2D {};

export const canvas2d = {
  canvas2d_arc,
  canvas2d_begin_path,
  canvas2d_clear_rect,
  canvas2d_clip,
  canvas2d_close_path,
  canvas2d_context,
  canvas2d_ellipse,
  canvas2d_fill,
  canvas2d_fill_rect,
  canvas2d_fill_text,
  canvas2d_line_to,
  canvas2d_move_to,
  canvas2d_path2d_fill,
  canvas2d_path2d_new,
  canvas2d_path2d_new_from_svg,
  canvas2d_path2d_stroke,
  canvas2d_restore,
  canvas2d_rotate,
  canvas2d_save,
  canvas2d_scale,
  canvas2d_set_fill_style,
  canvas2d_set_font,
  canvas2d_set_stroke_style,
  canvas2d_set_text_align,
  canvas2d_set_text_baseline,
  canvas2d_set_transform,
  canvas2d_stroke,
  canvas2d_stroke_rect,
  canvas2d_translate,
};
`,
);

// ---------------------------------------------------------------------------
// 4. Serve + run in Chromium via Playwright.
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
page.on("console", (msg) => {
  if (msg.type() === "error") {
    console.error("console error:", msg.text());
  }
});

const rgb = (c) => c.join(",");

try {
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => Number(document.getElementById("stage").getAttribute("data-frame-count") ?? 0) >= 3, null, { timeout: 15000 });

  const probe = (x, y) => page.evaluate(([px, py]) => window.__probe(px, py), [x, y]);
  const attr = (name) => page.evaluate((n) => document.getElementById("stage").getAttribute(n) ?? "", name);
  const waitFrames = async (n) => {
    const before = Number(await attr("data-frame-count"));
    await page.waitForFunction(
      ([n, before]) => Number(document.getElementById("stage").getAttribute("data-frame-count") ?? 0) >= before + n,
      [n, before],
      { timeout: 5000 },
    );
  };

  const isTomato = (c) => c[0] > 200 && c[1] < 150 && c[2] < 120 && c[1] > 40;
  const isGold = (c) => c[0] > 200 && c[1] > 180 && c[2] < 120;
  const isSteelblue = (c) => c[2] > 150 && c[0] < 110 && c[1] > 90;
  const isGreen = (c) => c[1] > 100 && c[0] < 60 && c[2] < 60;
  const isBlue = (c) => c[2] > 200 && c[0] < 80 && c[1] < 80;
  const isWhite = (c) => c[0] > 240 && c[1] > 240 && c[2] > 240;
  const approx = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

  // ---- Initial render: every Unit 2 draw surface landed. ----
  let c = await probe(335, 255);
  assert(isTomato(c), "initial: rect interior tomato (fill_rect)", rgb(c));
  c = await probe(470, 140);
  assert(isGold(c), "initial: Path2D star gold (from_svg + path2d_fill)", rgb(c));
  c = await probe(320, 90);
  assert(isSteelblue(c), "initial: ellipse steelblue (ellipse + fill)", rgb(c));
  c = await probe(320, 390);
  assert(isGreen(c), "initial: arc circle green (arc + fill)", rgb(c));
  c = await probe(160, 80);
  assert(isBlue(c), "initial: clip region blue (clip + fill_rect)", rgb(c));
  c = await probe(100, 20);
  assert(isWhite(c), "initial: outside clip region white", rgb(c));
  c = await probe(575, 445);
  assert(isWhite(c), "initial: background white", rgb(c));

  // ---- Drag: pointerdown on the rect, move, pointerup. ----
  await page.mouse.move(360, 270);
  await page.mouse.down();
  await page.mouse.move(420, 330, { steps: 4 });
  await page.mouse.up();
  await waitFrames(2);

  c = await probe(395, 315);
  assert(isTomato(c), "drag: rect interior at new position tomato", rgb(c));
  c = await probe(335, 255);
  assert(!isTomato(c), "drag: old rect position no longer tomato", rgb(c));
  const rectX = Number(await attr("data-rect-x"));
  const rectY = Number(await attr("data-rect-y"));
  assert(approx(rectX, 60) && approx(rectY, 60), `drag: rect state moved to (60,60) (got ${rectX},${rectY})`, `${rectX},${rectY}`);

  // ---- Pan: pointerdown on empty space, move, pointerup. ----
  c = await probe(495, 325);
  assert(!isTomato(c), "pre-pan: probe point outside rect at zoom 1", rgb(c));
  await page.mouse.move(150, 420);
  await page.mouse.down();
  await page.mouse.move(170, 430, { steps: 4 });
  await page.mouse.up();
  await waitFrames(2);

  c = await probe(415, 325);
  assert(isTomato(c), "pan: rect interior at camera-shifted position tomato", rgb(c));
  const camX = Number(await attr("data-cam-x"));
  const camY = Number(await attr("data-cam-y"));
  assert(approx(camX, 340) && approx(camY, 250), `pan: camera moved to (340,250) (got ${camX},${camY})`, `${camX},${camY}`);

  // ---- Zoom: one wheel event -> fixed 1.2x factor. ----
  await page.mouse.move(400, 300);
  await page.mouse.wheel(0, -100);
  await waitFrames(2);

  const zoom = Number(await attr("data-zoom"));
  assert(approx(zoom, 1.2, 0.001), `zoom: one wheel event set zoom to 1.2 (got ${zoom})`, String(zoom));
  c = await probe(430, 340);
  assert(isTomato(c), "zoom: rect interior at zoomed position tomato", rgb(c));
  c = await probe(495, 325);
  assert(isTomato(c), "zoom: probe outside rect at zoom 1 is inside rect at zoom 1.2", rgb(c));

  // ---- The whole scene redraws under the new transform (Path2D + text + all). ----
  c = await probe(520, 130);
  assert(isGold(c), "zoom: Path2D star gold at zoomed position", rgb(c));
  c = await probe(470, 140);
  assert(!isGold(c), "zoom: old star position no longer gold", rgb(c));
  c = await probe(340, 70);
  assert(isSteelblue(c), "zoom: ellipse steelblue at zoomed position", rgb(c));
  c = await probe(340, 430);
  assert(isGreen(c), "zoom: arc green at zoomed position", rgb(c));
  c = await probe(148, 58);
  assert(isBlue(c), "zoom: clip region blue at zoomed position", rgb(c));

  // ---- Redraw loop: on_frame keeps re-rendering. ----
  const framesBefore = Number(await attr("data-frame-count"));
  await waitFrames(3);
  const framesAfter = Number(await attr("data-frame-count"));
  assert(framesAfter >= framesBefore + 3, "redraw: frame counter advances (on_frame loop)", `${framesBefore} -> ${framesAfter}`);

  console.log("interactive-test: OK — all assertions passed (initial render, drag, pan, zoom, scene redraw, frame loop)");
} finally {
  await browser.close();
  server.close();
}

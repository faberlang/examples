#!/usr/bin/env node
// Emit package-owned cube geometry + transform binaries from live Faber attrs.
// Does not invent host-side cube corners: mounts the generated controller and
// serializes data-hv-positions/colors/indices/transform to dist/generated/.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FakeElement, FakeEventTarget } from "../../browser-app/tests/fake-dom.mjs";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(APP_DIR, "dist", "generated");
const PROOF_DIR = path.join(APP_DIR, "dist", "proof");

function parseCsv(attr) {
  if (attr === null || attr === undefined || attr === "") return [];
  return attr.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseFloatCsv(attr) {
  return parseCsv(attr).map(Number);
}

function writeF32(filePath, values) {
  const buf = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) buf.writeFloatLE(values[i], i * 4);
  writeFileSync(filePath, buf);
}

function writeU32(filePath, values) {
  const buf = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) buf.writeUInt32LE(values[i] >>> 0, i * 4);
  writeFileSync(filePath, buf);
}

// rAF capture for two deterministic frames.
const frameCallbacks = [];
globalThis.requestAnimationFrame = (cb) => {
  frameCallbacks.push(cb);
  return frameCallbacks.length - 1;
};
globalThis.cancelAnimationFrame = (id) => {
  frameCallbacks[id] = null;
};

const root = new FakeElement("html");
const body = new FakeElement("body");
root.appendChild(body);
const main = new FakeElement("main");
main.id = "hello-voxel-root";
body.appendChild(main);
const header = new FakeElement("header");
header.classList.add("hv-header");
main.appendChild(header);
const title = new FakeElement("h1");
title.textContent = "Hello Voxel";
header.appendChild(title);
const status = new FakeElement("p");
status.classList.add("hv-status");
status.textContent = "package-pending";
header.appendChild(status);
const canvas = new FakeElement("canvas");
canvas.classList.add("hv-canvas");
canvas.width = 960;
canvas.height = 540;
main.appendChild(canvas);

globalThis.document = root;
globalThis.window = new FakeEventTarget();
globalThis.window.innerWidth = 960;
globalThis.window.innerHeight = 540;
globalThis.window.devicePixelRatio = 1;

const esmUrl = pathToFileUrl(path.join(APP_DIR, "dist/faber-esm/faber-browser.js"));
const { mountControllers } = await import(esmUrl);
const runtime = mountControllers(globalThis.document);
if (runtime.failures.length !== 0) {
  console.error("emit-package-geometry: mount failed", runtime.failures);
  process.exit(1);
}

const positions = parseFloatCsv(canvas.getAttribute("data-hv-positions"));
const colors = parseFloatCsv(canvas.getAttribute("data-hv-colors"));
const indices = parseCsv(canvas.getAttribute("data-hv-indices")).map(Number);
const transform0 = parseFloatCsv(canvas.getAttribute("data-hv-transform"));

if (positions.length !== 24 || colors.length !== 24 || indices.length !== 36) {
  console.error(
    `emit-package-geometry: bad geometry lengths positions=${positions.length} colors=${colors.length} indices=${indices.length}`,
  );
  process.exit(1);
}
if (transform0.length !== 32) {
  console.error(`emit-package-geometry: transform length ${transform0.length}, expected 32`);
  process.exit(1);
}

// Advance two frames; capture model matrices for artifact identity.
if (frameCallbacks.length < 1 || typeof frameCallbacks[0] !== "function") {
  console.error("emit-package-geometry: no frame subscription");
  process.exit(1);
}
frameCallbacks[0](16);
const model1 = canvas.getAttribute("data-hv-model-matrix");
const transform1 = parseFloatCsv(canvas.getAttribute("data-hv-transform"));
const next = frameCallbacks.find((cb) => typeof cb === "function") ?? frameCallbacks[0];
next(33);
const model2 = canvas.getAttribute("data-hv-model-matrix");
const transform2 = parseFloatCsv(canvas.getAttribute("data-hv-transform"));
if (!model1 || !model2 || model1 === model2) {
  console.error("emit-package-geometry: model matrix did not change across frames");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PROOF_DIR, { recursive: true });

writeF32(path.join(OUT_DIR, "vertex-positions.bin"), positions);
writeF32(path.join(OUT_DIR, "vertex-colors.bin"), colors);
writeU32(path.join(OUT_DIR, "indices.bin"), indices);
// Host storage buffer is 256 bytes (64 f32); package contract is 32 f32.
const transformPadded = transform1.length >= 64
  ? transform1.slice(0, 64)
  : transform1.concat(Array(64 - transform1.length).fill(0));
writeF32(path.join(OUT_DIR, "transform.bin"), transformPadded);
writeF32(
  path.join(OUT_DIR, "transform-frame2.bin"),
  (transform2.length >= 64 ? transform2.slice(0, 64) : transform2.concat(Array(64 - transform2.length).fill(0))),
);

// Package draw policy (source mirror already in public/draw.json).
const drawPath = path.join(APP_DIR, "public/draw.json");
const draw = JSON.parse(readFileSync(drawPath, "utf-8"));
writeFileSync(path.join(OUT_DIR, "draw.json"), `${JSON.stringify(draw)}\n`);

const lockPath = path.join(APP_DIR, "faber.lock");
const mainTsPath = path.join(APP_DIR, "dist/faber-ts/main.ts");
const mainFabPath = path.join(APP_DIR, "src/main.fab");
const identityParts = [
  existsSync(lockPath) ? readFileSync(lockPath) : Buffer.alloc(0),
  existsSync(mainTsPath) ? readFileSync(mainTsPath) : Buffer.alloc(0),
  existsSync(mainFabPath) ? readFileSync(mainFabPath) : Buffer.alloc(0),
  Buffer.from(JSON.stringify({ positions, colors, indices, model1, model2 })),
];
const artifactId = createHash("sha256")
  .update(Buffer.concat(identityParts))
  .digest("hex")
  .slice(0, 16);

const manifest = {
  kind: "hello-voxel-package-geometry",
  artifact_id: artifactId,
  vertex_count: 8,
  index_count: 36,
  position_floats: positions.length,
  color_floats: colors.length,
  transform_floats_package: 32,
  transform_bytes_host: 256,
  model_matrix_frame1: model1,
  model_matrix_frame2: model2,
  model_matrix_changed: model1 !== model2,
  source: "faber-package-attrs",
  files: [
    "vertex-positions.bin",
    "vertex-colors.bin",
    "indices.bin",
    "transform.bin",
    "transform-frame2.bin",
    "draw.json",
  ],
};
writeFileSync(path.join(OUT_DIR, "package-geometry.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(path.join(PROOF_DIR, "artifact-id.json"), `${JSON.stringify({ artifact_id: artifactId }, null, 2)}\n`);

runtime.dispose();
console.log(`emit-package-geometry: wrote ${OUT_DIR} artifact_id=${artifactId}`);
console.log(`  positions=${positions.length} colors=${colors.length} indices=${indices.length}`);
console.log(`  model matrix changed: ${model1 !== model2}`);

function pathToFileUrl(p) {
  const resolved = path.resolve(p);
  return `file://${resolved}`;
}

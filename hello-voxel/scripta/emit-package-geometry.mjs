#!/usr/bin/env node
// Emit package-owned four-chunk geometry + transform binaries from live Faber attrs.
// Does not invent host-side voxel geometry: mounts the generated controller and
// serializes data-hv-* attrs to dist/generated/. Fail-closed on missing counts.

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

function die(msg) {
  console.error(`emit-package-geometry: ${msg}`);
  process.exit(1);
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
  die(`mount failed: ${JSON.stringify(runtime.failures.map((f) => f.error?.message ?? String(f.error)))}`);
}
if (status.textContent !== "package-ready") {
  die(`status not package-ready: ${status.textContent}`);
}

const payloadKind = canvas.getAttribute("data-hv-payload-kind");
if (payloadKind !== "four-chunk-world") {
  die(`expected four-chunk-world payload, got ${payloadKind}`);
}

const chunkCount = Number(canvas.getAttribute("data-hv-chunk-count"));
const nonEmpty = Number(canvas.getAttribute("data-hv-non-empty-chunk-count"));
const resourcePairs = Number(canvas.getAttribute("data-hv-resource-pair-count"));
const drawCount = Number(canvas.getAttribute("data-hv-draw-count"));
const totalFaces = Number(canvas.getAttribute("data-hv-total-face-count"));
const vertexCount = Number(canvas.getAttribute("data-hv-vertex-count"));
const indexCount = Number(canvas.getAttribute("data-hv-index-count"));

if (chunkCount !== 4) die(`chunk-count 4, got ${chunkCount}`);
if (nonEmpty !== 4) die(`non-empty 4, got ${nonEmpty}`);
if (resourcePairs !== nonEmpty) die(`resource pairs must equal non-empty (${resourcePairs} vs ${nonEmpty})`);
if (drawCount !== nonEmpty) die(`draw count must equal non-empty (${drawCount} vs ${nonEmpty})`);
if (!(totalFaces > 0) || !(vertexCount > 0) || !(indexCount > 0)) {
  die(`empty mesh totals faces=${totalFaces} verts=${vertexCount} idx=${indexCount}`);
}
if (vertexCount !== totalFaces * 4 || indexCount !== totalFaces * 6) {
  die(`face/vertex/index scale mismatch faces=${totalFaces} v=${vertexCount} i=${indexCount}`);
}

const positions = parseFloatCsv(canvas.getAttribute("data-hv-positions"));
const colors = parseFloatCsv(canvas.getAttribute("data-hv-colors"));
const indices = parseCsv(canvas.getAttribute("data-hv-indices")).map(Number);
const transform0 = parseFloatCsv(canvas.getAttribute("data-hv-transform"));

if (positions.length !== vertexCount * 3) {
  die(`positions length ${positions.length}, expected ${vertexCount * 3}`);
}
if (colors.length !== vertexCount * 3) {
  die(`colors length ${colors.length}, expected ${vertexCount * 3}`);
}
if (indices.length !== indexCount) {
  die(`indices length ${indices.length}, expected ${indexCount}`);
}
if (transform0.length !== 32) {
  die(`transform length ${transform0.length}, expected 32`);
}

// Per-chunk resource pairs (canonical multi-draw units).
const chunks = [];
for (let i = 0; i < chunkCount; i++) {
  const prefix = `data-hv-c${i}`;
  const cx = Number(canvas.getAttribute(`${prefix}-cx`));
  const cz = Number(canvas.getAttribute(`${prefix}-cz`));
  const faceCount = Number(canvas.getAttribute(`${prefix}-face-count`));
  const cPositions = parseFloatCsv(canvas.getAttribute(`${prefix}-positions`));
  const cColors = parseFloatCsv(canvas.getAttribute(`${prefix}-colors`));
  const cIndices = parseCsv(canvas.getAttribute(`${prefix}-indices`)).map(Number);
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) die(`chunk ${i} missing cx/cz`);
  if (!Number.isFinite(faceCount) || faceCount < 0) die(`chunk ${i} bad face-count`);
  if (faceCount > 0) {
    if (cPositions.length !== faceCount * 12) die(`chunk ${i} positions length`);
    if (cColors.length !== faceCount * 12) die(`chunk ${i} colors length`);
    if (cIndices.length !== faceCount * 6) die(`chunk ${i} indices length`);
  } else if (cPositions.length !== 0 || cColors.length !== 0 || cIndices.length !== 0) {
    die(`chunk ${i} empty face_count but non-empty buffers`);
  }
  chunks.push({
    slot: i,
    cx,
    cz,
    face_count: faceCount,
    vertex_count: faceCount * 4,
    index_count: faceCount * 6,
    positions: cPositions,
    colors: cColors,
    indices: cIndices,
  });
}

const nonEmptyChunks = chunks.filter((c) => c.face_count > 0);
if (nonEmptyChunks.length !== nonEmpty) {
  die(`per-chunk non-empty ${nonEmptyChunks.length} vs attr ${nonEmpty}`);
}

// Advance two frames; capture model matrices for artifact identity.
if (frameCallbacks.length < 1 || typeof frameCallbacks[0] !== "function") {
  die("no frame subscription");
}
frameCallbacks[0](16);
const model1 = canvas.getAttribute("data-hv-model-matrix");
const transform1 = parseFloatCsv(canvas.getAttribute("data-hv-transform"));
const next = frameCallbacks.find((cb) => typeof cb === "function") ?? frameCallbacks[0];
next(33);
const model2 = canvas.getAttribute("data-hv-model-matrix");
const transform2 = parseFloatCsv(canvas.getAttribute("data-hv-transform"));
if (!model1 || !model2 || model1 === model2) {
  die("model matrix did not change across frames");
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PROOF_DIR, { recursive: true });
mkdirSync(path.join(OUT_DIR, "chunks"), { recursive: true });

// Concatenated residual (single HV-04 buffer path for visible world proof).
writeF32(path.join(OUT_DIR, "vertex-positions.bin"), positions);
writeF32(path.join(OUT_DIR, "vertex-colors.bin"), colors);
writeU32(path.join(OUT_DIR, "indices.bin"), indices);

// Per non-empty chunk resource pair bins.
const chunkManifest = [];
for (const chunk of nonEmptyChunks) {
  const dir = path.join(OUT_DIR, "chunks", String(chunk.slot));
  mkdirSync(dir, { recursive: true });
  writeF32(path.join(dir, "vertex-positions.bin"), chunk.positions);
  writeF32(path.join(dir, "vertex-colors.bin"), chunk.colors);
  writeU32(path.join(dir, "indices.bin"), chunk.indices);
  const draw = {
    index_format: "uint32",
    instance_count: 1,
    base_vertex: 0,
    first_index: 0,
    index_count: chunk.index_count,
  };
  writeFileSync(path.join(dir, "draw.json"), `${JSON.stringify(draw)}\n`);
  chunkManifest.push({
    slot: chunk.slot,
    cx: chunk.cx,
    cz: chunk.cz,
    face_count: chunk.face_count,
    vertex_count: chunk.vertex_count,
    index_count: chunk.index_count,
    files: [
      `chunks/${chunk.slot}/vertex-positions.bin`,
      `chunks/${chunk.slot}/vertex-colors.bin`,
      `chunks/${chunk.slot}/indices.bin`,
      `chunks/${chunk.slot}/draw.json`,
    ],
  });
}

// Host storage buffer is 256 bytes (64 f32); package contract is 32 f32.
const pad64 = (values) =>
  values.length >= 64 ? values.slice(0, 64) : values.concat(Array(64 - values.length).fill(0));
writeF32(path.join(OUT_DIR, "transform.bin"), pad64(transform1));
writeF32(path.join(OUT_DIR, "transform-frame2.bin"), pad64(transform2));

// Package draw policy: residual single draw over concatenated indices.
// Resource/draw ownership remains one pair per non-empty chunk (chunks/*).
const draw = {
  index_format: "uint32",
  instance_count: 1,
  base_vertex: 0,
  first_index: 0,
  index_count: indexCount,
  resource_pair_count: resourcePairs,
  draw_count: drawCount,
  chunk_count: chunkCount,
  non_empty_chunk_count: nonEmpty,
  payload_kind: "four-chunk-world",
};
writeFileSync(path.join(OUT_DIR, "draw.json"), `${JSON.stringify(draw)}\n`);
writeFileSync(path.join(APP_DIR, "public/draw.json"), `${JSON.stringify(draw, null, 2)}\n`);
writeFileSync(path.join(OUT_DIR, "chunks.json"), `${JSON.stringify({ chunks: chunkManifest }, null, 2)}\n`);

const lockPath = path.join(APP_DIR, "faber.lock");
const mainTsPath = path.join(APP_DIR, "dist/faber-ts/main.ts");
const mainFabPath = path.join(APP_DIR, "src/main.fab");
const identityParts = [
  existsSync(lockPath) ? readFileSync(lockPath) : Buffer.alloc(0),
  existsSync(mainTsPath) ? readFileSync(mainTsPath) : Buffer.alloc(0),
  existsSync(mainFabPath) ? readFileSync(mainFabPath) : Buffer.alloc(0),
  Buffer.from(JSON.stringify({
    positions: positions.length,
    colors: colors.length,
    indices: indices.length,
    nonEmpty,
    totalFaces,
    model1,
    model2,
  })),
];
const artifactId = createHash("sha256")
  .update(Buffer.concat(identityParts))
  .digest("hex")
  .slice(0, 16);

const manifest = {
  kind: "hello-voxel-package-geometry",
  payload_kind: "four-chunk-world",
  artifact_id: artifactId,
  chunk_count: chunkCount,
  non_empty_chunk_count: nonEmpty,
  resource_pair_count: resourcePairs,
  draw_count: drawCount,
  total_face_count: totalFaces,
  vertex_count: vertexCount,
  index_count: indexCount,
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
    "chunks.json",
    ...chunkManifest.flatMap((c) => c.files),
  ],
};
writeFileSync(path.join(OUT_DIR, "package-geometry.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(path.join(PROOF_DIR, "artifact-id.json"), `${JSON.stringify({ artifact_id: artifactId }, null, 2)}\n`);

runtime.dispose();
console.log(`emit-package-geometry: wrote ${OUT_DIR} artifact_id=${artifactId}`);
console.log(`  chunks=${chunkCount} non_empty=${nonEmpty} faces=${totalFaces} indices=${indexCount}`);
console.log(`  resource_pairs=${resourcePairs} draws=${drawCount}`);
console.log(`  model matrix changed: ${model1 !== model2}`);

function pathToFileUrl(p) {
  const resolved = path.resolve(p);
  return `file://${resolved}`;
}

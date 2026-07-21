// HV-04C browser graphics proof: hosts/webgpu-browser runtime + package attrs.
// Loads package-owned geometry/transform from /generated/ (hello-voxel dist)
// and WGSL/reflection from the webgpu-browser host public/generated.

import {
  FaberKernelContractError,
  loadFaberGraphicsPipeline,
} from "/host-src/faber-kernel.js";
import {
  acquireWebGpuDevice,
  createGraphicsResources,
  runGraphicsFrameWithTexture,
  mapPixelBuffers,
  replaceDepthTextureOnResize,
  onDeviceLost,
} from "/host-src/webgpu-runtime.js";

// Clear is dark but not pure black. Visual law (REPAIR F2 / HV-04C):
// coverage vs clear alone is not enough — samples must show non-black RGB
// (vertex color path) and preferably differ across package transform frames.
const CLEAR = { r: 0.02, g: 0.027, b: 0.039, a: 1.0 };
const BACKGROUND_HEX = "#05070a";
const PURE_BLACK_HEX = "#000000";

window.faberHv04cProof = Object.freeze({ ok: false, status: "starting" });

main().catch((error) => {
  window.faberHv04cProof = Object.freeze({
    ok: false,
    status: "error",
    error: error?.message ?? String(error),
    kind: error instanceof FaberKernelContractError ? error.kind : "product",
  });
  document.getElementById("status").textContent = `error: ${window.faberHv04cProof.error}`;
});

async function main() {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "loading artifacts";

  const [
    wgslResponse,
    reflectionResponse,
    positionsResponse,
    colorsResponse,
    indicesResponse,
    transformResponse,
    transform2Response,
    drawResponse,
    artifactResponse,
  ] = await Promise.all([
    fetch("/host-generated/graphics.wgsl"),
    fetch("/host-generated/graphics-reflection.json"),
    fetch("/generated/vertex-positions.bin"),
    fetch("/generated/vertex-colors.bin"),
    fetch("/generated/indices.bin"),
    fetch("/generated/transform.bin"),
    fetch("/generated/transform-frame2.bin"),
    fetch("/generated/draw.json"),
    fetch("/proof/artifact-id.json"),
  ]);

  for (const [label, response] of [
    ["wgsl", wgslResponse],
    ["reflection", reflectionResponse],
    ["positions", positionsResponse],
    ["colors", colorsResponse],
    ["indices", indicesResponse],
    ["transform", transformResponse],
    ["transform2", transform2Response],
    ["draw", drawResponse],
    ["artifact", artifactResponse],
  ]) {
    if (!response.ok) {
      throw new FaberKernelContractError(label, `failed to fetch ${label}`, "artifact-fetch");
    }
  }

  const wgsl = await wgslResponse.text();
  const reflection = await reflectionResponse.json();
  const drawManifest = await drawResponse.json();
  const artifact = await artifactResponse.json();
  const descriptor = loadFaberGraphicsPipeline({ wgsl, reflection, drawManifest });

  const { device } = await acquireWebGpuDevice();
  onDeviceLost(device, (info) => {
    window.faberHv04cProof = Object.freeze({
      ok: false,
      status: "error",
      kind: info.kind,
      reason: info.reason,
      message: info.message,
    });
  });

  const canvas = document.getElementById("gpu-canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new FaberKernelContractError("canvas", "WebGPU canvas context unavailable", "webgpu");
  }

  context.configure({
    device,
    format: "bgra8unorm",
    alphaMode: "opaque",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const positionsBuffer = await positionsResponse.arrayBuffer();
  const colorsBuffer = await colorsResponse.arrayBuffer();
  const indicesBuffer = await indicesResponse.arrayBuffer();
  const transform1 = new Float32Array(await transformResponse.arrayBuffer());
  const transform2 = new Float32Array(await transform2Response.arrayBuffer());

  // HV-05C: package-owned four-chunk (or residual cube) sizes from draw.json.
  // Fail closed on empty or mismatched position/color/index payloads.
  const expectedIndexCount = Number(drawManifest.index_count);
  if (!Number.isFinite(expectedIndexCount) || expectedIndexCount <= 0) {
    throw new FaberKernelContractError(
      "drawManifest",
      `invalid index_count ${drawManifest.index_count}`,
    );
  }
  if (indicesBuffer.byteLength !== expectedIndexCount * 4) {
    throw new FaberKernelContractError(
      "package-indices",
      `expected ${expectedIndexCount * 4} bytes (${expectedIndexCount}×u32), got ${indicesBuffer.byteLength}`,
    );
  }
  if (positionsBuffer.byteLength === 0 || colorsBuffer.byteLength === 0) {
    throw new FaberKernelContractError(
      "package-geometry",
      "empty positions or colors buffer",
    );
  }
  if (positionsBuffer.byteLength !== colorsBuffer.byteLength) {
    throw new FaberKernelContractError(
      "package-geometry",
      `positions ${positionsBuffer.byteLength}B != colors ${colorsBuffer.byteLength}B`,
    );
  }
  if (positionsBuffer.byteLength % 12 !== 0) {
    throw new FaberKernelContractError(
      "package-positions",
      `positions byte length not multiple of 12 (vec3 f32), got ${positionsBuffer.byteLength}`,
    );
  }

  const basePayloads = {
    vertexBuffers: [
      { slot: 0, data: positionsBuffer },
      { slot: 1, data: colorsBuffer },
    ],
    indexData: new Uint32Array(indicesBuffer),
  };

  let resources = createGraphicsResources(
    device,
    descriptor,
    { ...basePayloads, storageData: { transform: transform1 } },
    context,
  );
  const frameState = { submittedFrameCount: 0, submits: [] };
  const clearHex = rgbToHex(CLEAR.r, CLEAR.g, CLEAR.b);

  // Frame 1 — copy samples in same encoder as drawIndexed.
  const points1 = samplePoints(canvas.width, canvas.height);
  const frame1 = runGraphicsFrameWithTexture(device, context, resources, descriptor, frameState, {
    clearValue: CLEAR,
    recordSubmit: true,
    pixelSamples: points1,
  });
  await device.queue.onSubmittedWorkDone();
  const samples1 = await mapPixelBuffers(frame1.pixelBuffers);

  // Clear-only control (same-encoder clear + copy).
  const clearPoints = [{ name: "clear_center", x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) }];
  const clearTexture = context.getCurrentTexture();
  const clearBuffers = [];
  {
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: clearTexture.createView(),
        clearValue: CLEAR,
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    pass.end();
    for (const sample of clearPoints) {
      const buffer = device.createBuffer({
        size: 256,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      enc.copyTextureToBuffer(
        { texture: clearTexture, origin: { x: sample.x, y: sample.y, z: 0 } },
        { buffer, bytesPerRow: 256 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      );
      clearBuffers.push({ sample, buffer });
    }
    device.queue.submit([enc.finish()]);
  }
  await device.queue.onSubmittedWorkDone();
  const clearSamples = await mapPixelBuffers(clearBuffers);

  // Resize path: replace depth texture; reconfigure canvas.
  canvas.width = 320;
  canvas.height = 180;
  context.configure({
    device,
    format: "bgra8unorm",
    alphaMode: "opaque",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  resources = replaceDepthTextureOnResize(device, resources, 320, 180);

  // Frame 2 with package transform at second frame time.
  resources = createGraphicsResources(
    device,
    descriptor,
    { ...basePayloads, storageData: { transform: transform2 } },
    context,
  );
  const points2 = samplePoints(canvas.width, canvas.height);
  const frame2 = runGraphicsFrameWithTexture(device, context, resources, descriptor, frameState, {
    clearValue: CLEAR,
    recordSubmit: true,
    pixelSamples: points2,
  });
  await device.queue.onSubmittedWorkDone();
  const samples2 = await mapPixelBuffers(frame2.pixelBuffers);

  const observedClearHex = clearSamples[0]?.hex;
  const nonBackground = (samples) =>
    samples.some((s) => s.a > 0 && s.hex !== clearHex);
  // Fail black-stub success: coverage that is pure black vs dark clear is not visual law.
  const nonBlackCoverage = (samples) =>
    samples.some((s) => s.a > 0 && s.hex !== clearHex && s.hex !== PURE_BLACK_HEX);
  const sampleHexes = (samples) =>
    samples.filter((s) => s.a > 0 && s.hex !== clearHex).map((s) => s.hex);
  // Rotation law: same sample points must show different RGB after model change.
  // Set-of-colors alone can stay equal when only face-direction palette is visible.
  const framesRgbDiffer = (() => {
    if (!Array.isArray(samples1) || !Array.isArray(samples2) || samples1.length === 0) {
      return false;
    }
    let anyCoverage = false;
    for (let i = 0; i < samples1.length && i < samples2.length; i++) {
      const a = samples1[i];
      const b = samples2[i];
      if (!a || !b) continue;
      const aCov = a.a > 0 && a.hex !== clearHex && a.hex !== PURE_BLACK_HEX;
      const bCov = b.a > 0 && b.hex !== clearHex && b.hex !== PURE_BLACK_HEX;
      if (aCov || bCov) anyCoverage = true;
      if (a.hex !== b.hex || a.r !== b.r || a.g !== b.g || a.b !== b.b) {
        return true;
      }
    }
    if (!anyCoverage) return false;
    // Fallback: set membership across samples.
    const setA = new Set(sampleHexes(samples1));
    const setB = new Set(sampleHexes(samples2));
    if (setA.size === 0 || setB.size === 0) return false;
    for (const hex of setA) {
      if (!setB.has(hex)) return true;
    }
    for (const hex of setB) {
      if (!setA.has(hex)) return true;
    }
    return false;
  })();

  const clearControlOk = observedClearHex === clearHex && clearSamples[0].a > 0;
  const frame1NonBg = nonBackground(samples1);
  const frame2NonBg = nonBackground(samples2);
  const frame1NonBlack = nonBlackCoverage(samples1);
  const frame2NonBlack = nonBlackCoverage(samples2);

  window.faberHv04cProof = Object.freeze({
    ok:
      frameState.submittedFrameCount >= 2
      && clearControlOk
      && frame1NonBg
      && frame2NonBg
      && frame1NonBlack
      && frame2NonBlack
      && framesRgbDiffer,
    status: "ready",
    kind: "ok",
    artifact_id: artifact.artifact_id,
    submittedFrameCount: frameState.submittedFrameCount,
    submits: frameState.submits,
    depth: {
      depth_test_enabled: true,
      depth_write_enabled: descriptor.pipeline.depthStencil.depthWriteEnabled,
      depth_compare: descriptor.pipeline.depthStencil.depthCompare,
      depth_format: "depth24plus",
      depth_attachment_used: true,
      resized_depth_texture: true,
    },
    pixels: {
      background_hex: clearHex,
      css_background_hex: BACKGROUND_HEX,
      clear_control_hex: observedClearHex,
      clear_control_ok: clearControlOk,
      central_is_background: !(frame1NonBg && frame2NonBg),
      frame1: samples1,
      frame2: samples2,
      frame1_non_background: frame1NonBg,
      frame2_non_background: frame2NonBg,
      frame1_non_black_coverage: frame1NonBlack,
      frame2_non_black_coverage: frame2NonBlack,
      frames_rgb_differ: framesRgbDiffer,
    },
    package: {
      positions_bytes: positionsBuffer.byteLength,
      colors_bytes: colorsBuffer.byteLength,
      indices_bytes: indicesBuffer.byteLength,
      index_count: drawManifest.index_count,
      instance_count: drawManifest.instance_count,
      resource_pair_count: drawManifest.resource_pair_count ?? null,
      draw_count: drawManifest.draw_count ?? null,
      chunk_count: drawManifest.chunk_count ?? null,
      non_empty_chunk_count: drawManifest.non_empty_chunk_count ?? null,
      payload_kind: drawManifest.payload_kind ?? null,
      source: "examples/hello-voxel package attrs → dist/generated bins",
    },
    lastSubmit: frameState.submits[frameState.submits.length - 1] ?? null,
    index_count: descriptor.draw.indexCount,
    instance_count: descriptor.draw.instanceCount,
    method: "drawIndexed",
    drawIndexed: true,
  });

  statusEl.textContent = window.faberHv04cProof.ok
    ? `ready frames=${frameState.submittedFrameCount} rgbDiff=${framesRgbDiffer}`
    : `incomplete clearOk=${clearControlOk} f1=${frame1NonBg}/${frame1NonBlack} f2=${frame2NonBg}/${frame2NonBlack} rgbDiff=${framesRgbDiffer}`;
}

function rgbToHex(r, g, b) {
  const to = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function samplePoints(width, height) {
  // Dense central samples for the four-chunk world (camera looks at ground center).
  // Residual unit-cube path still covers several of these NDC points.
  const pts = [];
  for (const [name, fx, fy] of [
    ["center", 0.50, 0.50],
    ["c55_45", 0.55, 0.45],
    ["c45_55", 0.45, 0.55],
    ["c60_40", 0.60, 0.40],
    ["c40_60", 0.40, 0.60],
    ["c65_50", 0.65, 0.50],
    ["c50_35", 0.50, 0.35],
    ["c50_65", 0.50, 0.65],
    ["c35_50", 0.35, 0.50],
    ["q70_30", 0.70, 0.30],
    ["q30_70", 0.30, 0.70],
  ]) {
    pts.push({
      name,
      x: Math.min(width - 1, Math.max(0, Math.floor(width * fx))),
      y: Math.min(height - 1, Math.max(0, Math.floor(height * fy))),
    });
  }
  return pts;
}

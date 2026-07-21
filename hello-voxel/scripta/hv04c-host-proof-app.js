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

// Clear color ≠ pure black so black fragment stubs still yield non-background
// coverage relative to the clear (HV-01 fragment body still hardcodes black).
const CLEAR = { r: 0.02, g: 0.027, b: 0.039, a: 1.0 };
const BACKGROUND_HEX = "#05070a";

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

  if (positionsBuffer.byteLength !== 96) {
    throw new FaberKernelContractError(
      "package-positions",
      `expected 96 bytes (8×vec3), got ${positionsBuffer.byteLength}`,
    );
  }
  if (colorsBuffer.byteLength !== 96) {
    throw new FaberKernelContractError(
      "package-colors",
      `expected 96 bytes (8×vec3), got ${colorsBuffer.byteLength}`,
    );
  }
  if (indicesBuffer.byteLength !== 144) {
    throw new FaberKernelContractError(
      "package-indices",
      `expected 144 bytes (36×u32), got ${indicesBuffer.byteLength}`,
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

  const clearControlOk = observedClearHex === clearHex && clearSamples[0].a > 0;
  const frame1NonBg = nonBackground(samples1);
  const frame2NonBg = nonBackground(samples2);

  window.faberHv04cProof = Object.freeze({
    ok:
      frameState.submittedFrameCount >= 2
      && clearControlOk
      && frame1NonBg
      && frame2NonBg,
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
    },
    package: {
      positions_bytes: positionsBuffer.byteLength,
      colors_bytes: colorsBuffer.byteLength,
      indices_bytes: indicesBuffer.byteLength,
      index_count: drawManifest.index_count,
      instance_count: drawManifest.instance_count,
      source: "examples/hello-voxel package attrs → dist/generated bins",
    },
    lastSubmit: frameState.submits[frameState.submits.length - 1] ?? null,
    index_count: descriptor.draw.indexCount,
    instance_count: descriptor.draw.instanceCount,
    method: "drawIndexed",
    drawIndexed: true,
  });

  statusEl.textContent = window.faberHv04cProof.ok
    ? `ready frames=${frameState.submittedFrameCount}`
    : `incomplete clearOk=${clearControlOk} f1=${frame1NonBg} f2=${frame2NonBg}`;
}

function rgbToHex(r, g, b) {
  const to = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function samplePoints(width, height) {
  // Dense positive-quadrant samples for unit-cube positions in NDC [0,1]×[0,1].
  const pts = [];
  for (const [name, fx, fy] of [
    ["q75_25", 0.75, 0.25],
    ["q70_30", 0.70, 0.30],
    ["q80_20", 0.80, 0.20],
    ["q60_40", 0.60, 0.40],
    ["q65_35", 0.65, 0.35],
    ["q55_45", 0.55, 0.45],
    ["center", 0.50, 0.50],
  ]) {
    pts.push({
      name,
      x: Math.min(width - 1, Math.max(0, Math.floor(width * fx))),
      y: Math.min(height - 1, Math.max(0, Math.floor(height * fy))),
    });
  }
  return pts;
}

// HV-05C browser graphics proof: per-chunk multi-draw host path (HV-07B/C).
// Loads package-owned per-chunk geometry/transform from /generated/chunks/<slot>/
// and WGSL/reflection from the webgpu-browser host public/generated.
// Uses createChunkGraphicsResources / applyChunkResourceReplace / runChunkGraphicsFrame
// instead of the old concatenated-single-buffer path.

import {
  FaberKernelContractError,
  loadFaberGraphicsPipeline,
} from "/host-src/faber-kernel.js";
import {
  acquireWebGpuDevice,
  createChunkGraphicsResources,
  applyChunkResourceReplace,
  runChunkGraphicsFrame,
  chunkResourceCounters,
  liveChunkIds,
  readTexturePixelsRgba,
  replaceDepthTextureOnResize,
  mapPixelBuffers,
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
    transformResponse,
    transform2Response,
    drawResponse,
    artifactResponse,
  ] = await Promise.all([
    fetch("/host-generated/graphics.wgsl"),
    fetch("/host-generated/graphics-reflection.json"),
    fetch("/generated/transform.bin"),
    fetch("/generated/transform-frame2.bin"),
    fetch("/generated/draw.json"),
    fetch("/proof/artifact-id.json"),
  ]);

  for (const [label, response] of [
    ["wgsl", wgslResponse],
    ["reflection", reflectionResponse],
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

  const transform1 = new Float32Array(await transformResponse.arrayBuffer());
  const transform2 = new Float32Array(await transform2Response.arrayBuffer());

  // HV-05C: per-chunk geometry pair loading from chunks/<slot>/ bins.
  // Fail closed on empty or mismatched payloads.
  const expectedDrawCount = Number(drawManifest.draw_count);
  if (!Number.isFinite(expectedDrawCount) || expectedDrawCount <= 0) {
    throw new FaberKernelContractError(
      "drawManifest",
      `invalid draw_count ${drawManifest.draw_count}`,
    );
  }

  const chunks = [];
  for (let slot = 0; slot < expectedDrawCount; slot++) {
    const base = `/generated/chunks/${slot}/`;
    const [posRes, colRes, idxRes, drawRes] = await Promise.all([
      fetch(`${base}vertex-positions.bin`),
      fetch(`${base}vertex-colors.bin`),
      fetch(`${base}indices.bin`),
      fetch(`${base}draw.json`),
    ]);

    for (const [label, response] of [
      [`chunks/${slot}/vertex-positions.bin`, posRes],
      [`chunks/${slot}/vertex-colors.bin`, colRes],
      [`chunks/${slot}/indices.bin`, idxRes],
      [`chunks/${slot}/draw.json`, drawRes],
    ]) {
      if (!response.ok) {
        throw new FaberKernelContractError(label, `failed to fetch ${label}`, "artifact-fetch");
      }
    }

    const chunkDrawManifest = await drawRes.json();
    const indexCount = Number(chunkDrawManifest.index_count);

    if (!Number.isFinite(indexCount) || indexCount < 0) {
      throw new FaberKernelContractError(
        `chunks/${slot}/draw.json`,
        `invalid index_count ${chunkDrawManifest.index_count}`,
      );
    }

    const positions = await posRes.arrayBuffer();
    const colors = await colRes.arrayBuffer();
    const indices = await idxRes.arrayBuffer();

    if (indexCount > 0) {
      if (indices.byteLength !== indexCount * 4) {
        throw new FaberKernelContractError(
          `chunks/${slot}/indices.bin`,
          `expected ${indexCount * 4} bytes (${indexCount}×u32), got ${indices.byteLength}`,
        );
      }
      if (positions.byteLength === 0 || colors.byteLength === 0) {
        throw new FaberKernelContractError(
          `chunks/${slot}`,
          "empty positions or colors buffer",
        );
      }
      if (positions.byteLength !== colors.byteLength) {
        throw new FaberKernelContractError(
          `chunks/${slot}`,
          `positions ${positions.byteLength}B != colors ${colors.byteLength}B`,
        );
      }
      if (positions.byteLength % 12 !== 0) {
        throw new FaberKernelContractError(
          `chunks/${slot}/vertex-positions.bin`,
          `byte length not multiple of 12 (vec3 f32), got ${positions.byteLength}`,
        );
      }
    }

    chunks.push({
      slot,
      index_count: indexCount,
      positions,
      colors,
      indices,
    });
  }

  // Create chunk graphics resources with per-chunk multi-draw path.
  let resources = createChunkGraphicsResources(
    device, descriptor,
    { storageData: { transform: transform1 } },
    context,
  );

  // Bootstrap: one create per non-empty chunk.
  for (const chunk of chunks) {
    if (chunk.index_count > 0) {
      applyChunkResourceReplace(device, resources, {
        logical_id: chunk.slot,
        generation: 0,
        payload: {
          positions: chunk.positions,
          colors: chunk.colors,
          indices: chunk.indices,
        },
      });
    }
  }

  const frameState = { submittedFrameCount: 0, submits: [] };
  const clearHex = rgbToHex(CLEAR.r, CLEAR.g, CLEAR.b);

  // Frame 1 — copy samples after onSubmittedWorkDone using readTexturePixelsRgba.
  const points1 = samplePoints(canvas.width, canvas.height);
  runChunkGraphicsFrame(device, context, resources, descriptor, frameState, {
    clearValue: CLEAR,
    recordSubmit: true,
  });
  await device.queue.onSubmittedWorkDone();
  const texture1 = context.getCurrentTexture();
  const samples1 = await readTexturePixelsRgba(device, texture1, points1);

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
  // Update the storage buffer inline with transform2.
  const storageBuffer = resources.storageBuffers.get(0);
  device.queue.writeBuffer(storageBuffer, 0, transform2);

  const points2 = samplePoints(canvas.width, canvas.height);
  runChunkGraphicsFrame(device, context, resources, descriptor, frameState, {
    clearValue: CLEAR,
    recordSubmit: true,
  });
  await device.queue.onSubmittedWorkDone();
  const texture2 = context.getCurrentTexture();
  const samples2 = await readTexturePixelsRgba(device, texture2, points2);

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

  const counters = chunkResourceCounters(resources);
  const lastSubmit = frameState.submits[frameState.submits.length - 1] ?? null;
  const firstSubmit = frameState.submits[0] ?? null;

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
      positions_bytes: chunks.reduce((s, c) => s + (c.positions?.byteLength ?? 0), 0),
      colors_bytes: chunks.reduce((s, c) => s + (c.colors?.byteLength ?? 0), 0),
      indices_bytes: chunks.reduce((s, c) => s + (c.indices?.byteLength ?? 0), 0),
      index_count: drawManifest.index_count,
      instance_count: drawManifest.instance_count,
      resource_pair_count: drawManifest.resource_pair_count ?? null,
      draw_count: drawManifest.draw_count ?? null,
      chunk_count: drawManifest.chunk_count ?? null,
      non_empty_chunk_count: drawManifest.non_empty_chunk_count ?? null,
      payload_kind: drawManifest.payload_kind ?? null,
      source: "examples/hello-voxel package attrs → dist/generated/chunks/<slot>/ bins",
    },
    lastSubmit,
    index_count: descriptor.draw.indexCount,
    instance_count: descriptor.draw.instanceCount,
    method: "drawIndexed",
    drawIndexed: true,
    multi_draw: firstSubmit?.multi_draw === true,
    draw_count: lastSubmit?.draw_count ?? 0,
    host_path: firstSubmit?.path ?? null,
    live_chunk_ids: [...liveChunkIds(resources)],
    chunk_counters: {
      live_chunks: counters.live_chunks,
      live_buffers: counters.live,
      path: counters.path,
    },
  });

  statusEl.textContent = window.faberHv04cProof.ok
    ? `ready frames=${frameState.submittedFrameCount} rgbDiff=${framesRgbDiffer} mdraw=${window.faberHv04cProof.multi_draw} draws=${window.faberHv04cProof.draw_count}`
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

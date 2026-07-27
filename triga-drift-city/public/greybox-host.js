/**
 * U2 greybox-host.js — host graphics integration for Stage 2 first render.
 *
 * Loads U1's compiled WGSL + reflection, constructs the graphics pipeline
 * descriptor, creates resources with test geometry (one colored triangle),
 * renders one frame, and provides pixel readback proof.
 *
 * Exports:
 *   loadGreyboxPipeline(device)   — fetch WGSL + reflection, return descriptor
 *   initGreyboxRenderer(device, descriptor, canvasContext) — create GPU resources
 *   renderGreyboxFrame(renderState, options) — execute one render pass
 *   updateGreyboxTransform(renderState, modelData, viewProjData) — write transform
 */

import {
  createGraphicsResources,
  runGraphicsFrame,
  runGraphicsFrameWithTexture,
  mapPixelBuffers,
  updateGraphicsStorage,
  replaceDepthTextureOnResize,
} from "./webgpu-runtime.js";

import { FaberKernelContractError } from "./faber-kernel.js";

// ── Test geometry: one colored triangle ────────────────────────────────────
//
// Interleaved position (float32x3) + color (float32x3), stride 24 per vertex.
// Reflection from U1 confirms: position@loc0 offset 0, color@loc1 offset 12.

const TRIANGLE_VERTICES = new Float32Array([
  // position (x,y,z)      // color (r,g,b)
  -0.5, -0.5, 0.0,         1.0, 0.0, 0.0,   // bottom-left  → red
   0.5, -0.5, 0.0,         0.0, 1.0, 0.0,   // bottom-right → green
   0.0,  0.5, 0.0,         0.0, 0.0, 1.0,   // top-center   → blue
]);

const TRIANGLE_INDICES = new Uint32Array([0, 1, 2]);

// Default identity transform: model (16 floats) + view-projection (16 floats)
const IDENTITY_TRANSFORM = new Float32Array([
  1, 0, 0, 0,   0, 1, 0, 0,   0, 0, 1, 0,   0, 0, 0, 1,  // model = identity
  1, 0, 0, 0,   0, 1, 0, 0,   0, 0, 1, 0,   0, 0, 0, 1,  // view-proj = identity
]);

// ── Descriptor builder ─────────────────────────────────────────────────────

/**
 * Build an admitted graphics descriptor from U1 WGSL + reflection that is
 * compatible with createGraphicsResources().
 *
 * The U1 reflection format (flat kernel + pipeline blocks) differs from the
 * loadFaberGraphicsPipeline expectation (launch.webgpu_adapter blocks). This
 * function extracts the same material directly from the U1 flat format.
 *
 * @param {string} wgsl - WGSL source text
 * @param {object} reflection - parsed reflection JSON (U1 flat format)
 * @returns {object} frozen descriptor ready for createGraphicsResources
 */
function buildDescriptorFromReflection(wgsl, reflection) {
  if (!reflection || !Array.isArray(reflection.kernels)) {
    throw new FaberKernelContractError(
      "reflection.kernels",
      "reflection must contain arrays of kernels",
      "reflection",
    );
  }

  const vertexKernel = reflection.kernels.find((k) => k.shader_stage === "vertex");
  const fragmentKernel = reflection.kernels.find((k) => k.shader_stage === "fragment");

  if (!vertexKernel) {
    throw new FaberKernelContractError("reflection.kernels", "missing vertex kernel", "reflection");
  }
  if (!fragmentKernel) {
    throw new FaberKernelContractError("reflection.kernels", "missing fragment kernel", "reflection");
  }

  const pipeline = reflection.pipeline;
  if (!pipeline || !Array.isArray(pipeline.color_target_formats)) {
    throw new FaberKernelContractError("reflection.pipeline", "pipeline block missing or incomplete", "reflection");
  }

  // Build vertex buffer layouts from vertex_inputs
  // The U1 reflection provides per-attribute descriptors; group them by stride.
  // For interleaved position+color with stride 24, both attributes share stride.
  // We emit one buffer with both attributes.
  const vertexInputs = Array.isArray(vertexKernel.vertex_inputs) ? vertexKernel.vertex_inputs : [];
  if (vertexInputs.length === 0) {
    throw new FaberKernelContractError("reflection.kernels[0].vertex_inputs", "vertex kernel requires vertex inputs", "reflection");
  }

  // Use the stride from the first input (they should all agree for interleaved)
  const strideBytes = vertexInputs[0].stride_bytes;
  for (let i = 1; i < vertexInputs.length; i++) {
    if (vertexInputs[i].stride_bytes !== strideBytes) {
      throw new FaberKernelContractError(
        "reflection.kernels[0].vertex_inputs",
        `vertex input ${i} stride ${vertexInputs[i].stride_bytes} differs from input 0 stride ${strideBytes}`,
        "reflection",
      );
    }
  }

  const vertexBufferLayouts = Object.freeze([
    Object.freeze({
      bufferIndex: 0,
      arrayStride: strideBytes,
      stepMode: "vertex",
      attributes: Object.freeze(
        vertexInputs.map((vi) =>
          Object.freeze({
            shaderLocation: vi.location,
            format: vi.format,
            offset: vi.offset_bytes,
          }),
        ),
      ),
    }),
  ]);

  // Build bind group layout from vertex kernel resources
  const resources = Array.isArray(vertexKernel.resources) ? vertexKernel.resources : [];
  const bindGroupLayouts = Object.freeze([
    Object.freeze({
      bindGroupIndex: 0,
      entries: Object.freeze(
        resources.map((r) =>
          Object.freeze({
            binding: r.binding,
            visibility: "vertex",
            bufferType: "read-only-storage",
            minBindingSize: r.buffer_byte_len,
            sourceName: r.source_name,
          }),
        ),
      ),
    }),
  ]);

  // Build bind group entries from vertex kernel resources
  const bindGroups = Object.freeze([
    Object.freeze({
      bindGroupIndex: 0,
      entries: Object.freeze(
        resources.map((r) =>
          Object.freeze({
            binding: r.binding,
            resourceIndex: 0,
            role: "input",
            access: "read",
            kind: "storage-buffer",
            bufferType: "read-only-storage",
            elementLayout: "f32",
            elementByteWidth: 4,
            elementCount: r.element_count,
            bufferByteLen: r.buffer_byte_len,
            bufferByteOffset: 0,
            bindingByteLen: r.buffer_byte_len,
            minBindingSize: r.buffer_byte_len,
            sourceName: r.source_name,
          }),
        ),
      ),
    }),
  ]);

  // Pipeline layout
  const pipelineLayout = Object.freeze({
    bindGroupLayoutIndexes: [0],
  });

  // Draw manifest: test triangle uses 3 indices
  const draw = Object.freeze({
    indexFormat: "uint32",
    instanceCount: 1,
    baseVertex: 0,
    firstIndex: 0,
    indexCount: 3,
  });

  return Object.freeze({
    wgsl,
    schemaVersion: reflection.schema_version,
    target: reflection.target,
    kernels: Object.freeze([
      Object.freeze({
        entryName: vertexKernel.entry_name,
        shaderStage: "vertex",
        vertexInputs: Object.freeze(
          vertexInputs.map((vi) =>
            Object.freeze({
              sourceName: vi.source_name,
              location: vi.location,
              format: vi.format,
              stepMode: vi.step_mode,
              offsetBytes: vi.offset_bytes,
              strideBytes: vi.stride_bytes,
            }),
          ),
        ),
        vertexBufferLayouts,
      }),
      Object.freeze({
        entryName: fragmentKernel.entry_name,
        shaderStage: "fragment",
      }),
    ]),
    pipeline: Object.freeze({
      colorTargetFormats: Object.freeze([...pipeline.color_target_formats]),
      primitiveTopology: pipeline.primitive_topology,
      vertexCount: pipeline.vertex_count,
      depthStencil: Object.freeze({
        depthWriteEnabled: pipeline.depth_stencil.depth_write_enabled,
        depthCompare: pipeline.depth_stencil.depth_compare,
      }),
    }),
    pipelineLayout,
    bindGroupLayouts,
    bindGroups,
    draw,
    inputBindings: Object.freeze([]),
    outputBindings: Object.freeze([]),
  });
}

// ── Exports ────────────────────────────────────────────────────────────────

/**
 * Fetch U1 compiled WGSL and reflection, build an admitted graphics descriptor.
 * @param {GPUDevice} device
 * @returns {Promise<{ descriptor: object }>}
 */
export async function loadGreyboxPipeline(device) {
  const [wgslResp, reflectionResp] = await Promise.all([
    fetch("./kernel.wgsl"),
    fetch("./reflection.json"),
  ]);

  if (!wgslResp.ok) {
    throw new FaberKernelContractError("fetch", `failed to fetch kernel.wgsl: ${wgslResp.status}`, "artifact-fetch");
  }
  if (!reflectionResp.ok) {
    throw new FaberKernelContractError("fetch", `failed to fetch reflection.json: ${reflectionResp.status}`, "artifact-fetch");
  }

  const wgsl = await wgslResp.text();
  const reflection = await reflectionResp.json();
  const descriptor = buildDescriptorFromReflection(wgsl, reflection);

  return Object.freeze({ descriptor });
}

/**
 * Create GPU resources for the greybox pipeline with a test triangle.
 *
 * @param {GPUDevice} device
 * @param {object} descriptor - admitted graphics descriptor from loadGreyboxPipeline
 * @param {GPUCanvasContext} canvasContext
 * @returns {object} frozen renderState
 */
export function initGreyboxRenderer(device, descriptor, canvasContext) {
  const payloads = {
    vertexBuffers: [
      { slot: 0, data: TRIANGLE_VERTICES },
    ],
    indexData: TRIANGLE_INDICES,
    storageData: {
      transform: IDENTITY_TRANSFORM,
    },
  };

  const resources = createGraphicsResources(device, descriptor, payloads, canvasContext);

  const frameState = Object.freeze({
    submittedFrameCount: 0,
  });

  const renderState = Object.freeze({
    device,
    context: canvasContext,
    descriptor,
    resources,
    frameState,
  });

  return renderState;
}

/**
 * Render one greybox frame.
 * @param {object} renderState - from initGreyboxRenderer
 * @param {{ clearValue?: GPUColor, recordSubmit?: boolean }} [options]
 */
export function renderGreyboxFrame(renderState, options = {}) {
  const { device, context, descriptor, resources, frameState } = renderState;
  runGraphicsFrame(device, context, resources, descriptor, frameState, {
    clearValue: options.clearValue ?? { r: 0.02, g: 0.06, b: 0.07, a: 1.0 },
    recordSubmit: options.recordSubmit ?? false,
  });
}

/**
 * Render one frame AND capture pixel samples in the same command encoder.
 * Returns { texture, pixelBuffers } for later mapPixelBuffers readback.
 *
 * @param {object} renderState
 * @param {Array<{ name: string, x: number, y: number }>} pixelSamples
 * @param {{ clearValue?: GPUColor }} [options]
 * @returns {{ texture: GPUTexture, pixelBuffers: Array<{ sample, buffer }> }}
 */
export function renderGreyboxFrameWithSamples(renderState, pixelSamples, options = {}) {
  const { device, context, descriptor, resources, frameState } = renderState;
  return runGraphicsFrameWithTexture(device, context, resources, descriptor, frameState, {
    clearValue: options.clearValue ?? { r: 0.02, g: 0.06, b: 0.07, a: 1.0 },
    pixelSamples,
  });
}

/**
 * Write model and view-projection data to the transform storage buffer.
 *
 * @param {object} renderState
 * @param {Float32Array} [modelData] - 16 floats for model matrix
 * @param {Float32Array} [viewProjData] - 16 floats for view-projection matrix
 */
export function updateGreyboxTransform(renderState, modelData, viewProjData) {
  const { device, descriptor, resources } = renderState;
  const combined = new Float32Array(32);

  if (modelData) {
    combined.set(modelData, 0);
  } else {
    // Default identity model
    combined.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 0);
  }

  if (viewProjData) {
    combined.set(viewProjData, 16);
  } else {
    // Default identity view-projection
    combined.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 16);
  }

  updateGraphicsStorage(device, resources, descriptor, {
    resourceIndex: 0,
    data: combined,
    sourceName: "transform",
  });
}

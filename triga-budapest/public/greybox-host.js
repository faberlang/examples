/**
 * greybox-host.js — shared greybox WebGPU graphics helper for Triga Budapest.
 *
 * U2: load WGSL + reflection, create pipeline, test triangle, pixel readback.
 * U4: multi-mesh scene upload (10 objects, one draw each), per-object model
 *     transform, continuous frame render with depth.
 *
 * JS owns transport + WebGPU lifecycle only. Simulation stays in Faber.
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

// ── Test geometry: one colored triangle (U2) ───────────────────────────────

const TRIANGLE_VERTICES = new Float32Array([
  // position (x,y,z)      // normal (nx,ny,nz)    // color (r,g,b)
  -0.5, -0.5, 0.0,          0.0, 0.0, 1.0,         1.0, 0.0, 0.0,
   0.5, -0.5, 0.0,          0.0, 0.0, 1.0,         0.0, 1.0, 0.0,
   0.0,  0.5, 0.0,          0.0, 0.0, 1.0,         0.0, 0.0, 1.0,
]);

const TRIANGLE_INDICES = new Uint32Array([0, 1, 2]);

const IDENTITY_TRANSFORM = new Float32Array([
  1, 0, 0, 0,   0, 1, 0, 0,   0, 0, 1, 0,   0, 0, 0, 1,
  1, 0, 0, 0,   0, 1, 0, 0,   0, 0, 1, 0,   0, 0, 0, 1,
]);

const IDENTITY_MODEL = new Float32Array([
  1, 0, 0, 0,   0, 1, 0, 0,   0, 0, 1, 0,   0, 0, 0, 1,
]);

// ── Descriptor builder ─────────────────────────────────────────────────────

function buildDescriptorFromReflection(wgsl, reflection, indexCount = 3) {
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

  const vertexInputs = Array.isArray(vertexKernel.vertex_inputs) ? vertexKernel.vertex_inputs : [];
  if (vertexInputs.length === 0) {
    throw new FaberKernelContractError("reflection.kernels[0].vertex_inputs", "vertex kernel requires vertex inputs", "reflection");
  }

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

  const resources = Array.isArray(vertexKernel.resources) ? vertexKernel.resources : [];
  const bindGroupLayouts = Object.freeze([
    Object.freeze({
      bindGroupIndex: 0,
      entries: Object.freeze(
        resources.map((r) =>
          Object.freeze({
            binding: r.binding,
            visibility: r.kind === "UniformBuffer" ? "vertex" : "vertex",
            bufferType: r.kind === "UniformBuffer" ? "uniform" : "read-only-storage",
            minBindingSize: r.buffer_byte_len,
            sourceName: r.source_name,
          }),
        ),
      ),
    }),
  ]);

  const bindGroups = Object.freeze([
    Object.freeze({
      bindGroupIndex: 0,
      entries: Object.freeze(
        resources.map((r, i) =>
          Object.freeze({
            binding: r.binding,
            resourceIndex: i,
            role: r.kind === "UniformBuffer" ? "uniform" : "input",
            access: "read",
            kind: r.kind === "UniformBuffer" ? "uniform-buffer" : "storage-buffer",
            bufferType: r.kind === "UniformBuffer" ? "uniform" : "read-only-storage",
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

  const pipelineLayout = Object.freeze({
    bindGroupLayoutIndexes: [0],
  });

  const draw = Object.freeze({
    indexFormat: "uint32",
    instanceCount: 1,
    baseVertex: 0,
    firstIndex: 0,
    indexCount,
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

// ── Mesh buffer helpers ────────────────────────────────────────────────────

function createMappedGpuBuffer(device, data, usage) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(
    data instanceof Uint8Array
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  );
  buffer.unmap();
  return buffer;
}

/**
 * Build GPU mesh resources for one object (interleaved pos+color VB + IB).
 * @param {GPUDevice} device
 * @param {{ name: string, role: string, vertices: Float32Array, indices: Uint32Array }} mesh
 */
function createMeshGpuEntry(device, mesh) {
  const vertexBuffer = createMappedGpuBuffer(
    device,
    mesh.vertices,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  );
  const indexBuffer = createMappedGpuBuffer(
    device,
    mesh.indices,
    GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  );
  return {
    name: mesh.name,
    role: mesh.role || "static",
    vertexBuffer,
    indexBuffer,
    indexCount: mesh.indices.length,
  };
}

// ── Scene geometry parse (controller mount blob) ───────────────────────────

/**
 * Parse `data-scene-geometry` published once by the Faber controller.
 *
 * Format (pipe-separated objects):
 *   name;role;vertexCount;indexCount;v0 v1 ...;i0 i1 ...|name2;...
 *
 * role is "static" or "car".
 *
 * @param {string} blob
 * @returns {Array<{ name: string, role: string, vertices: Float32Array, indices: Uint32Array }>}
 */
export function parseSceneGeometryBlob(blob) {
  if (!blob || typeof blob !== "string") {
    throw new Error("greybox-host: empty scene geometry blob");
  }
  const objects = [];
  const parts = blob.split("|").filter((p) => p.length > 0);
  for (const part of parts) {
    const fields = part.split(";");
    if (fields.length !== 6) {
      throw new Error(`greybox-host: bad geometry object fields (${fields.length}): ${part.slice(0, 40)}`);
    }
    const name = fields[0];
    const role = fields[1];
    const vertexCount = Number(fields[2]);
    const indexCount = Number(fields[3]);
    const verts = fields[4].trim().split(/\s+/).map(Number);
    const idxs = fields[5].trim().split(/\s+/).map(Number);
    if (verts.length !== vertexCount * 9) {
      throw new Error(
        `greybox-host: ${name} vertex float count ${verts.length} != ${vertexCount * 9} (expected 9 floats per vertex: pos3+normal3+color3)`,
      );
    }
    if (idxs.length !== indexCount) {
      throw new Error(
        `greybox-host: ${name} index count ${idxs.length} != ${indexCount}`,
      );
    }
    objects.push({
      name,
      role,
      vertices: new Float32Array(verts),
      indices: new Uint32Array(idxs),
    });
  }
  if (objects.length === 0) {
    throw new Error("greybox-host: no scene objects in geometry blob");
  }
  return objects;
}

// ── Exports ────────────────────────────────────────────────────────────────

/**
 * Fetch U1 compiled WGSL and reflection, build an admitted graphics descriptor.
 * @param {GPUDevice} device
 * @returns {Promise<{ descriptor: object, wgsl: string, reflection: object }>}
 */
export async function loadGreyboxPipeline(device) {
  // Resolve against this module URL, not the document URL. The page lives at
  // /pages/index.html; `fetch("./kernel.wgsl")` would hit /pages/kernel.wgsl (404).
  // Artifacts are co-located with this module under /public/.
  const wgslUrl = new URL("./kernel.wgsl", import.meta.url);
  const reflectionUrl = new URL("./reflection.json", import.meta.url);
  const [wgslResp, reflectionResp] = await Promise.all([
    fetch(wgslUrl),
    fetch(reflectionUrl),
  ]);

  if (!wgslResp.ok) {
    throw new FaberKernelContractError(
      "fetch",
      `failed to fetch kernel.wgsl (${wgslUrl.href}): ${wgslResp.status}`,
      "artifact-fetch",
    );
  }
  if (!reflectionResp.ok) {
    throw new FaberKernelContractError(
      "fetch",
      `failed to fetch reflection.json (${reflectionUrl.href}): ${reflectionResp.status}`,
      "artifact-fetch",
    );
  }

  const wgsl = await wgslResp.text();
  const reflection = await reflectionResp.json();
  const descriptor = buildDescriptorFromReflection(wgsl, reflection, 3);

  return Object.freeze({ descriptor, wgsl, reflection });
}

/**
 * Create GPU resources for the greybox pipeline with a test triangle (U2).
 *
 * @param {GPUDevice} device
 * @param {object} descriptor
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
      lighting: new Float32Array([
        -0.45, 0.75, 0.35, 0.0,
        1.0, 0.92, 0.78, 0.0,
        0.25, 0.28, 0.35, 0.0,
      ]),
    },
  };

  const resources = createGraphicsResources(device, descriptor, payloads, canvasContext);

  const frameState = {
    submittedFrameCount: 0,
  };

  return Object.freeze({
    device,
    context: canvasContext,
    descriptor,
    resources,
    frameState,
    mode: "triangle",
  });
}

/**
 * Create multi-mesh scene renderer (U4): one draw call per object.
 *
 * Meshes arrive in the space the draw uses: static objects in world space and
 * the car in model space. No spawn or pose correction happens here — that is
 * Faber's to publish.
 *
 * @param {GPUDevice} device
 * @param {object} pipelinePack - from loadGreyboxPipeline ({ descriptor, wgsl, reflection })
 * @param {GPUCanvasContext} canvasContext
 * @param {Array<{ name: string, role: string, vertices: Float32Array, indices: Uint32Array }>} meshes
 * @returns {object} renderState (mutable resources holder for resize)
 */
export function initGreyboxSceneRenderer(device, pipelinePack, canvasContext, meshes, lightingData) {
  if (!Array.isArray(meshes) || meshes.length === 0) {
    throw new Error("initGreyboxSceneRenderer: meshes required");
  }

  // Descriptor indexCount must match first mesh for createGraphicsResources bounds check.
  const first = meshes[0];
  const descriptor = buildDescriptorFromReflection(
    pipelinePack.wgsl,
    pipelinePack.reflection,
    first.indices.length,
  );

  const payloads = {
    vertexBuffers: [{ slot: 0, data: first.vertices }],
    indexData: first.indices,
    storageData: {
      transform: IDENTITY_TRANSFORM,
      lighting: lightingData || new Float32Array(12),
    },
  };

  let resources = createGraphicsResources(device, descriptor, payloads, canvasContext);

  const meshEntries = meshes.map((m, i) => {
    if (i === 0) {
      // Reuse buffers from createGraphicsResources for mesh 0.
      return {
        name: m.name,
        role: m.role || "static",
        vertexBuffer: resources.vertexBuffers[0].buffer,
        indexBuffer: resources.indexBuffer,
        indexCount: m.indices.length,
      };
    }
    return createMeshGpuEntry(device, m);
  });

  const carIndex = meshEntries.findIndex((m) => m.role === "car");

  return {
    device,
    context: canvasContext,
    descriptor,
    get resources() {
      return resources;
    },
    set resources(next) {
      resources = next;
    },
    frameState: { submittedFrameCount: 0 },
    meshes: meshEntries,
    carIndex,
    mode: "scene",
    objectCount: meshEntries.length,
  };
}

/**
 * Render one greybox frame (triangle path).
 */
export function renderGreyboxFrame(renderState, options = {}) {
  const { device, context, descriptor, resources, frameState } = renderState;
  runGraphicsFrame(device, context, resources, descriptor, frameState, {
    clearValue: options.clearValue ?? { r: 0.02, g: 0.06, b: 0.07, a: 1.0 },
    recordSubmit: options.recordSubmit ?? false,
  });
}

/**
 * Render multi-mesh scene: one drawIndexed per object.
 * Static meshes use identity model + view-proj; car uses full 32-float payload.
 *
 * Mind default C: per-object model via multi-pass (storage buffer rewritten
 * between passes; first pass clears, later passes load).
 *
 * @param {object} renderState - from initGreyboxSceneRenderer
 * @param {Float32Array} transform32 - model(16) + view-proj(16) for the car
 * @param {{ clearValue?: GPUColor }} [options]
 */
export function renderGreyboxSceneFrame(renderState, transform32, options = {}) {
  const { device, context, descriptor, meshes, carIndex } = renderState;
  const resources = renderState.resources;
  const clearValue = options.clearValue ?? { r: 0.45, g: 0.62, b: 0.80, a: 1.0 };

  if (!(transform32 instanceof Float32Array) || transform32.length < 32) {
    throw new Error("renderGreyboxSceneFrame: transform32 must be Float32Array(32)");
  }

  const viewProj = transform32.subarray(16, 32);
  const carModel = transform32.subarray(0, 16);

  const identityCombined = new Float32Array(32);
  identityCombined.set(IDENTITY_MODEL, 0);
  identityCombined.set(viewProj, 16);

  const carCombined = new Float32Array(32);
  carCombined.set(carModel, 0);
  carCombined.set(viewProj, 16);

  // One canvas texture, one MSAA color view, and one depth view for the whole
  // frame; the passes differ only in load op and which mesh they draw. Each
  // pass resolves the multisampled target into the canvas texture.
  const textureView = context.getCurrentTexture().createView();
  const depthView = resources.depthTexture.createView();
  const colorView = resources.msaaTexture ? resources.msaaTexture.createView() : textureView;
  const resolveTarget = resources.msaaTexture ? textureView : undefined;

  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const isCar = i === carIndex || mesh.role === "car";
    const payload = isCar ? carCombined : identityCombined;

    updateGraphicsStorage(device, resources, descriptor, {
      resourceIndex: 0,
      data: payload,
      sourceName: "transform",
    });

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorView,
          resolveTarget,
          clearValue,
          loadOp: i === 0 ? "clear" : "load",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: i === 0 ? "clear" : "load",
        depthStoreOp: "store",
      },
    });

    renderPass.setPipeline(resources.pipeline);
    for (const group of resources.bindGroups) {
      renderPass.setBindGroup(group.bindGroupIndex, group.bindGroup);
    }
    renderPass.setVertexBuffer(0, mesh.vertexBuffer);
    renderPass.setIndexBuffer(mesh.indexBuffer, "uint32", 0);
    renderPass.drawIndexed(mesh.indexCount, 1, 0, 0, 0);
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  renderState.frameState.submittedFrameCount =
    (renderState.frameState.submittedFrameCount ?? 0) + 1;

  return Object.freeze({
    draw_count: meshes.length,
    frame_index: renderState.frameState.submittedFrameCount,
  });
}

/**
 * Render one frame AND capture pixel samples (U2 triangle path).
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
 */
export function updateGreyboxTransform(renderState, modelData, viewProjData) {
  const { device, descriptor } = renderState;
  const resources = renderState.resources;
  const combined = new Float32Array(32);

  if (modelData) {
    combined.set(modelData, 0);
  } else {
    combined.set(IDENTITY_MODEL, 0);
  }

  if (viewProjData) {
    combined.set(viewProjData, 16);
  } else {
    combined.set(IDENTITY_MODEL, 16);
  }

  updateGraphicsStorage(device, resources, descriptor, {
    resourceIndex: 0,
    data: combined,
    sourceName: "transform",
  });
}

/**
 * Resize depth texture for scene or triangle render state.
 */
export function resizeGreyboxRenderer(renderState, width, height) {
  const { device } = renderState;
  const next = replaceDepthTextureOnResize(device, renderState.resources, width, height);
  if (renderState.mode === "scene") {
    renderState.resources = next;
  } else {
    // triangle path: frozen state — return new state
    return Object.freeze({
      ...renderState,
      resources: next,
    });
  }
  return renderState;
}

export { mapPixelBuffers, replaceDepthTextureOnResize };

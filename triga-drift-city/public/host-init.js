/**
 * host-init.js — WebGPU host session for Drift City.
 *
 * U2 integration: loads U1's WGSL + reflection, creates the greybox graphics
 * pipeline with a test triangle, renders one frame, and proves non-clear
 * output via pixel readback.
 *
 * Extends the Stage 1 bootstrap with greybox-host rendering and a continuous
 * frame loop for U4 compatibility.
 */

import { acquireWebGpuDevice, updateGraphicsStorage } from "./webgpu-runtime.js";
import {
  loadGreyboxPipeline,
  initGreyboxRenderer,
  renderGreyboxFrame,
  renderGreyboxFrameWithSamples,
  mapPixelBuffers,
} from "./greybox-host.js";

const TRANSFORM_BYTE_LEN = 128; // 32 f32 × 4 bytes
const CANVAS_SELECTOR = ".drift-canvas";
const FACTS_SELECTOR = ".drift-facts";

/**
 * Initialize the WebGPU host session with greybox renderer.
 * @returns {Promise<{ device: GPUDevice, updateGraphicsStorage: Function, submitFrame: Function, resize: Function, destroy: Function, renderState: object|null }>}
 */
export async function initHost() {
  const { device } = await acquireWebGpuDevice();

  const canvas = document.querySelector(CANVAS_SELECTOR);
  if (!canvas) {
    throw new Error(`host-init: canvas not found (${CANVAS_SELECTOR})`);
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("host-init: WebGPU canvas context unavailable");
  }

  // Canvas initial dimensions
  const initialWidth = canvas.clientWidth || canvas.width || 960;
  const initialHeight = canvas.clientHeight || canvas.height || 540;
  canvas.width = initialWidth;
  canvas.height = initialHeight;

  context.configure({
    device,
    format: "bgra8unorm",
    alphaMode: "opaque",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  // ── U2: Load greybox pipeline and create renderer ──────────────────────

  let greyboxRenderState = null;
  let pipelineLoaded = false;

  try {
    const { descriptor } = await loadGreyboxPipeline(device);
    greyboxRenderState = initGreyboxRenderer(device, descriptor, context);
    pipelineLoaded = true;

    // Update facts element to show pipeline loaded
    const facts = document.querySelector(FACTS_SELECTOR);
    if (facts) {
      facts.setAttribute("data-pipeline-status", "loaded");
    }
  } catch (err) {
    console.warn("host-init: greybox pipeline load failed", err);
    const facts = document.querySelector(FACTS_SELECTOR);
    if (facts) {
      facts.setAttribute("data-pipeline-status", "failed");
      facts.setAttribute("data-pipeline-error", err.message);
    }
  }

  // ── U2: Render first frame and prove non-clear output via pixel readback ──

  let readbackSamples = null;
  let renderStatus = "none";

  if (pipelineLoaded && greyboxRenderState) {
    try {
      // Render one frame and capture center pixel
      const pixelSamples = [
        { name: "center", x: Math.floor(initialWidth / 2), y: Math.floor(initialHeight / 2) },
        { name: "corner", x: 10, y: 10 },
      ];

      const { texture, pixelBuffers } = renderGreyboxFrameWithSamples(
        greyboxRenderState,
        pixelSamples,
      );

      // Await pixel readback
      readbackSamples = await mapPixelBuffers(pixelBuffers);

      // Verify center pixel is non-clear (not the clear color 0x120a08)
      const center = readbackSamples.find((s) => s.name === "center");
      if (center) {
        const isNonClear = center.r > 10 || center.g > 10 || center.b > 10;
        renderStatus = isNonClear ? "verified" : "clear-only";

        const facts = document.querySelector(FACTS_SELECTOR);
        if (facts) {
          facts.setAttribute("data-pixel-readback", renderStatus);
          facts.setAttribute("data-pixel-center-hex", center.hex);
          facts.setAttribute("data-pixel-center-rgba",
            `${center.r},${center.g},${center.b},${center.a}`);
        }
      }
    } catch (err) {
      console.warn("host-init: first render / readback failed", err);
      renderStatus = "failed";
      const facts = document.querySelector(FACTS_SELECTOR);
      if (facts) {
        facts.setAttribute("data-pixel-readback", "failed");
        facts.setAttribute("data-pixel-readback-error", err.message);
      }
    }
  }

  // ── Storage buffer for transform (U4 compatibility) ────────────────────

  const transformBuffer = device.createBuffer({
    size: TRANSFORM_BYTE_LEN,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.MAP_READ,
  });

  const resources = Object.freeze({
    storageBuffers: new Map([
      [0, { buffer: transformBuffer, generation: 0 }],
    ]),
  });

  const descriptor = Object.freeze({
    bindGroups: [
      {
        entries: [
          {
            resourceIndex: 0,
            sourceName: "transform",
            role: "input",
            bufferByteLen: TRANSFORM_BYTE_LEN,
          },
        ],
      },
    ],
  });

  // ── Frame loop and lifecycle ───────────────────────────────────────────

  let frameId = null;
  let running = true;
  let frameCount = 0;
  let readbackSnapshot = null;
  let readbackPhase = 0; // 0=waiting, 1=snapshot captured, 2=verified, -1=failed
  let resizeObserver = null;
  let resizeListenerBound = false;

  function destroyBuffers() {
    try {
      transformBuffer.destroy();
    } catch (_) {
      // Already destroyed.
    }
  }

  function stopLoop() {
    running = false;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  // Readback proof for transform storage buffer
  async function doReadback() {
    if (!running || readbackPhase < 0 || readbackPhase >= 2) return;
    try {
      await device.queue.onSubmittedWorkDone();
      await transformBuffer.mapAsync(GPUMapMode.READ);
      const mapped = new Float32Array(transformBuffer.getMappedRange());
      const copy = new Float32Array(mapped);
      transformBuffer.unmap();

      if (readbackPhase === 0) {
        readbackSnapshot = copy;
        readbackPhase = 1;
      } else if (readbackPhase === 1) {
        let changed = false;
        for (let i = 0; i < 32; i++) {
          if (copy[i] !== readbackSnapshot[i]) {
            changed = true;
            break;
          }
        }
        readbackPhase = changed ? 2 : 1;
        const facts = document.querySelector(FACTS_SELECTOR);
        if (facts) {
          facts.setAttribute("data-readback-proof", changed ? "verified" : "unchanged");
        }
      }
    } catch (err) {
      readbackPhase = -1;
      const facts = document.querySelector(FACTS_SELECTOR);
      if (facts) {
        facts.setAttribute("data-readback-proof", "failed");
      }
    }
  }

  // Device loss
  device.lost.then((info) => {
    const facts = document.querySelector(FACTS_SELECTOR);
    if (facts) {
      facts.setAttribute("data-device-status", "lost");
    }
    stopLoop();
    destroyBuffers();
    return { reason: info.reason, message: info.message };
  });

  device.addEventListener("uncapturederror", (event) => {
    console.error("host-init: uncaptured WebGPU error", event.error);
  });

  function frameLoop() {
    if (!running) return;

    try {
      // U2: render greybox frame each tick (triangle is visible)
      if (greyboxRenderState) {
        renderGreyboxFrame(greyboxRenderState, {
          clearValue: { r: 0.02, g: 0.06, b: 0.07, a: 1.0 },
        });
      }

      // U4: transform storage update from DOM
      const facts = document.querySelector(FACTS_SELECTOR);
      if (facts) {
        const payloadAttr = facts.getAttribute("data-transform-payload");
        if (payloadAttr) {
          const parts = payloadAttr.trim().split(/\s+/);
          if (parts.length === 32) {
            const floats = new Float32Array(32);
            for (let i = 0; i < 32; i++) {
              floats[i] = Number(parts[i]);
            }
            updateGraphicsStorage(device, resources, descriptor, {
              resourceIndex: 0,
              data: floats,
            });
            frameCount++;
            if (frameCount >= 2 && readbackPhase < 2) {
              doReadback();
            }
          }
        }
      }
    } catch (err) {
      console.warn("host-init: frame loop error", err);
    }

    frameId = requestAnimationFrame(frameLoop);
  }

  // Start the frame loop
  frameId = requestAnimationFrame(frameLoop);

  function submitFrame() {
    // No-op pulse for API compatibility
  }

  function resize() {
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    if (w > 0 && h > 0) {
      canvas.width = w;
      canvas.height = h;
      context.configure({
        device,
        format: "bgra8unorm",
        alphaMode: "opaque",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
    }
  }

  function destroy() {
    stopLoop();
    destroyBuffers();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (resizeListenerBound) {
      window.removeEventListener("resize", resize);
      resizeListenerBound = false;
    }
  }

  // Wire resize observer
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
    resizeListenerBound = true;
  }

  return Object.freeze({
    device,
    greyboxRenderState,
    pipelineLoaded,
    renderStatus,
    readbackSamples,
    updateGraphicsStorage: (res, desc, opts) =>
      updateGraphicsStorage(device, res, desc, opts),
    submitFrame,
    resize,
    destroy,
  });
}

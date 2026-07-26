// U4 host-init.js — full WebGPU host session with frame loop, resize,
// device loss handling, and transform bridge to updateGraphicsStorage.
//   - Imports the real updateGraphicsStorage from webgpu-runtime.js
//     (replacing the U1 stub that threw "not wired").
//   - Creates a storage buffer (STORAGE | COPY_DST | MAP_READ) for the
//     transform payload (128 bytes = 32 f32, resourceIndex 0).
//   - rAF loop reads data-transform-payload from the Faber controller DOM
//     and calls updateGraphicsStorage each frame.
//   - Resize reconfigures the GPUCanvasContext.
//   - Device loss sets data-device-status="lost", stops the loop, and
//     destroys buffers.

import { acquireWebGpuDevice, updateGraphicsStorage } from "./webgpu-runtime.js";

const TRANSFORM_BYTE_LEN = 128; // 32 f32 × 4 bytes
const CANVAS_SELECTOR = ".drift-canvas";
const FACTS_SELECTOR = ".drift-facts";

/**
 * Initialize the WebGPU host session.
 * @returns {Promise<{ device: GPUDevice, updateGraphicsStorage: Function, submitFrame: Function, resize: Function, destroy: Function }>}
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

  // Canvas initial dimensions: match the HTML attribute defaults.
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

  // Storage buffer for transform payload.
  // MAP_READ enables the readback proof required by done_when (6).
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

  // Readback proof (F1): after 2+ frames, map the transform storage buffer
  // directly via GPUMapMode.READ to verify the transform reached GPU storage
  // and changed across frames. Runs as a fire-and-forget async path gated by
  // readbackPhase — only maps twice (snapshot + compare), then stops.
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

  // Device loss: set status, stop loop, destroy buffers.
  device.lost.then((info) => {
    const facts = document.querySelector(FACTS_SELECTOR);
    if (facts) {
      facts.setAttribute("data-device-status", "lost");
    }
    stopLoop();
    destroyBuffers();
    // Prevent unhandled rejection noise.
    return { reason: info.reason, message: info.message };
  });

  // Uncaptured error: log but do not crash.
  device.addEventListener("uncapturederror", (event) => {
    console.error("host-init: uncaptured WebGPU error", event.error);
  });

  function frameLoop() {
    if (!running) return;

    try {
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
      // Contract errors from updateGraphicsStorage are bounded.
      // Log and continue — the loop must not die on a single bad frame.
      console.warn("host-init: frame storage update failed", err);
    }

    frameId = requestAnimationFrame(frameLoop);
  }

  // Start the frame loop.
  frameId = requestAnimationFrame(frameLoop);

  function submitFrame() {
    // The frame loop already calls updateGraphicsStorage each rAF tick.
    // This is a no-op pulse for API compatibility.
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

  // Wire resize observer. ResizeObserver is more reliable than the
  // window resize event for canvas-driven layout changes.
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
    resizeListenerBound = true;
  }

  return Object.freeze({
    device,
    updateGraphicsStorage: (res, desc, opts) =>
      updateGraphicsStorage(device, res, desc, opts),
    submitFrame,
    resize,
    destroy,
  });
}

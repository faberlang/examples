/**
 * host-init.js — WebGPU host session for Triga Budapest.
 *
 * Transport + WebGPU lifecycle only. Scene facts and camera stay
 * in Faber. Each frame:
 *   1. Read 32-float transform payload from controller (data-transform-payload)
 *   2. updateGraphicsStorage / per-object model via renderGreyboxSceneFrame
 *   3. Multi-draw static Chain Bridge scene
 *
 * Mount path: wait for data-scene-geometry (one-shot from Faber controller),
 * upload meshes, then enter the continuous render loop.
 */

import {
  acquireWebGpuDevice,
  updateGraphicsStorage,
  onDeviceLost,
} from "./webgpu-runtime.js";
import {
  loadGreyboxPipeline,
  initGreyboxRenderer,
  initGreyboxSceneRenderer,
  renderGreyboxFrame,
  renderGreyboxFrameWithSamples,
  renderGreyboxSceneFrame,
  parseSceneGeometryBlob,
  mapPixelBuffers,
  resizeGreyboxRenderer,
} from "./greybox-host.js";

const TRANSFORM_BYTE_LEN = 128; // 32 f32 × 4 bytes
const CANVAS_SELECTOR = ".budapest-canvas";
const FACTS_SELECTOR = ".budapest-facts";
const GEOMETRY_ATTR = "data-scene-geometry";
const TRANSFORM_ATTR = "data-transform-payload";
const GEOMETRY_WAIT_MS = 8000;
const GEOMETRY_POLL_MS = 50;

function factsEl() {
  return document.querySelector(FACTS_SELECTOR);
}

function setFact(name, value) {
  const el = factsEl();
  if (el) el.setAttribute(name, value);
}

/**
 * Wait until the Faber controller publishes the one-shot scene geometry blob.
 * @returns {Promise<string>}
 */
function waitForSceneGeometry() {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    function tick() {
      const el = factsEl();
      const blob = el?.getAttribute(GEOMETRY_ATTR);
      if (blob && blob.length > 0) {
        resolve(blob);
        return;
      }
      if (performance.now() - start > GEOMETRY_WAIT_MS) {
        reject(new Error(`host-init: timed out waiting for ${GEOMETRY_ATTR}`));
        return;
      }
      setTimeout(tick, GEOMETRY_POLL_MS);
    }
    tick();
  });
}

/**
 * Backing-store size for a canvas laid out by CSS, in device pixels.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ width: number, height: number }}
 */
function backingSize(canvas) {
  const ratio = globalThis.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.width || 960;
  const cssHeight = canvas.clientHeight || canvas.height || 540;
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}

/**
 * Parse transform payload text ("f0 f1 ... f31") into Float32Array(32).
 * @param {string|null} text
 * @returns {Float32Array|null}
 */
function parseTransformPayload(text) {
  if (!text) return null;
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 32) return null;
  const floats = new Float32Array(32);
  for (let i = 0; i < 32; i++) {
    floats[i] = Number(parts[i]);
    if (!Number.isFinite(floats[i])) return null;
  }
  return floats;
}

/**
 * Initialize the WebGPU host session with greybox scene renderer.
 * @returns {Promise<object>}
 */
export async function initHost() {
  const { device } = await acquireWebGpuDevice();
  setFact("data-device-status", "active");

  const canvas = document.querySelector(CANVAS_SELECTOR);
  if (!canvas) {
    throw new Error(`host-init: canvas not found (${CANVAS_SELECTOR})`);
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("host-init: WebGPU canvas context unavailable");
  }

  const { width: initialWidth, height: initialHeight } = backingSize(canvas);
  canvas.width = initialWidth;
  canvas.height = initialHeight;

  context.configure({
    device,
    format: "bgra8unorm",
    alphaMode: "opaque",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  // ── Load greybox pipeline (U1 artifacts from public/) ───────────────────

  let pipelinePack = null;
  let pipelineLoaded = false;

  try {
    pipelinePack = await loadGreyboxPipeline(device);
    pipelineLoaded = true;
    setFact("data-pipeline-status", "loaded");
  } catch (err) {
    console.warn("host-init: Budapest pipeline load failed", err);
    setFact("data-pipeline-status", "failed");
    setFact("data-pipeline-error", err.message);
    setFact("data-render-status", "pipeline-load-failed");
    setFact("data-render-gate", "blocked-pipeline");
  }

  // ── U2 fallback: triangle path while waiting for scene geometry ─────────

  let triangleState = null;
  let readbackSamples = null;
  let renderStatus = "none";

  if (pipelineLoaded && pipelinePack) {
    try {
      triangleState = initGreyboxRenderer(device, pipelinePack.descriptor, context);
      const pixelSamples = [
        { name: "center", x: Math.floor(initialWidth / 2), y: Math.floor(initialHeight / 2) },
        { name: "corner", x: 10, y: 10 },
      ];
      const { pixelBuffers } = renderGreyboxFrameWithSamples(triangleState, pixelSamples);
      readbackSamples = await mapPixelBuffers(pixelBuffers);
      const center = readbackSamples.find((s) => s.name === "center");
      if (center) {
        const isNonClear = center.r > 10 || center.g > 10 || center.b > 10;
        renderStatus = isNonClear ? "verified" : "clear-only";
        setFact("data-pixel-readback", renderStatus);
        setFact("data-pixel-center-hex", center.hex);
        setFact(
          "data-pixel-center-rgba",
          `${center.r},${center.g},${center.b},${center.a}`,
        );
      }
    } catch (err) {
      console.warn("host-init: first triangle render / readback failed", err);
      renderStatus = "failed";
      setFact("data-pixel-readback", "failed");
      setFact("data-pixel-readback-error", err.message);
    }
  }

  // ── U4: wait for controller geometry, mount multi-mesh scene ────────────

  let sceneState = null;
  let sceneMounted = false;

  if (pipelineLoaded && pipelinePack) {
    try {
      const blob = await waitForSceneGeometry();
      const meshes = parseSceneGeometryBlob(blob);
      sceneState = initGreyboxSceneRenderer(device, pipelinePack, context, meshes);
      sceneMounted = true;
      setFact("data-scene-upload", "ok");
      setFact("data-scene-object-count", String(meshes.length));
      setFact("data-render-status", "scene-mounted");
      setFact("data-render-gate", "pending-first-frame");
      // Drop geometry blob from DOM after upload (one-shot mount evidence kept via counts).
      const el = factsEl();
      if (el) el.removeAttribute(GEOMETRY_ATTR);
    } catch (err) {
      console.warn("host-init: Budapest scene geometry mount failed", err);
      setFact("data-scene-upload", "failed");
      setFact("data-scene-upload-error", err.message);
      setFact("data-render-status", "scene-upload-failed");
      setFact("data-render-gate", "blocked-geometry");
    }
  }

  // ── Transform storage (U4 bridge / readback proof) ──────────────────────
  // WebGPU: MapRead may only combine with CopyDst (not Storage).
  // updateGraphicsStorage uses queue.writeBuffer → COPY_DST is enough.
  const transformBuffer = device.createBuffer({
    size: TRANSFORM_BYTE_LEN,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const storageResources = Object.freeze({
    storageBuffers: new Map([
      [0, { buffer: transformBuffer, generation: 0 }],
    ]),
  });

  const storageDescriptor = Object.freeze({
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
  let readbackPhase = 0; // 0=waiting, 1=snapshot, 2=verified, -1=failed
  let readbackBusy = false;
  let sceneRendered = false;
  let lastTransform = null;
  let resizeObserver = null;
  let resizeListenerBound = false;

  function destroyBuffers() {
    try {
      transformBuffer.destroy();
    } catch (_) {
      // already destroyed
    }
  }

  function stopLoop() {
    running = false;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  async function doReadback() {
    if (!running || readbackBusy || readbackPhase < 0 || readbackPhase >= 2) return;
    // While this buffer is map-pending or mapped, queue.writeBuffer against it
    // is a validation error, so the frame loop must skip its mirror write.
    readbackBusy = true;
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
        setFact("data-readback-proof", changed ? "verified" : "unchanged");
      }
    } catch (_) {
      readbackPhase = -1;
      setFact("data-readback-proof", "failed");
    } finally {
      readbackBusy = false;
    }
  }

  // Device loss — bounded, no uncaught errors
  onDeviceLost(device, (info) => {
    setFact("data-device-status", "lost");
    setFact("data-device-loss-reason", info.reason || "unknown");
    stopLoop();
    destroyBuffers();
  });

  device.lost.then((info) => {
    setFact("data-device-status", "lost");
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
      const el = factsEl();
      const floats = parseTransformPayload(el?.getAttribute(TRANSFORM_ATTR) ?? null);
      if (floats) lastTransform = floats;

      if (sceneState) {
        // U4 path: multi-draw scene with car model + view-proj. A payload that
        // fails to parse must not drop the scene back to the U2 triangle, so
        // hold the last good transform until a new one arrives.
        const transform = floats ?? lastTransform;
        if (transform) {
          renderGreyboxSceneFrame(sceneState, transform);
          if (!sceneRendered) {
            sceneRendered = true;
            setFact("data-render-status", "live-direct-webgpu");
            setFact("data-render-gate", "open");
          }
          if (!readbackBusy) {
            // Mirror transform into MAP_READ buffer for readback proof
            updateGraphicsStorage(device, storageResources, storageDescriptor, {
              resourceIndex: 0,
              data: transform,
            });
            frameCount++;
            if (frameCount >= 2 && readbackPhase < 2) {
              doReadback();
            }
          }
        }
      } else if (triangleState) {
        // U2 path while the scene geometry has not mounted yet
        renderGreyboxFrame(triangleState, {
          clearValue: { r: 0.02, g: 0.06, b: 0.07, a: 1.0 },
        });
        if (floats && !readbackBusy) {
          updateGraphicsStorage(device, storageResources, storageDescriptor, {
            resourceIndex: 0,
            data: floats,
          });
        }
      }
    } catch (err) {
      console.warn("host-init: frame loop error", err);
    }

    frameId = requestAnimationFrame(frameLoop);
  }

  frameId = requestAnimationFrame(frameLoop);

  function submitFrame() {
    // no-op pulse for API compatibility
  }

  function resize() {
    const { width: w, height: h } = backingSize(canvas);
    if (w === canvas.width && h === canvas.height) return;

    canvas.width = w;
    canvas.height = h;
    context.configure({
      device,
      format: "bgra8unorm",
      alphaMode: "opaque",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    if (sceneState) {
      resizeGreyboxRenderer(sceneState, w, h);
    } else if (triangleState) {
      triangleState = resizeGreyboxRenderer(triangleState, w, h);
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

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
    resizeListenerBound = true;
  }

  return Object.freeze({
    device,
    pipelineLoaded,
    sceneMounted,
    renderStatus,
    readbackSamples,
    greyboxRenderState: sceneState || triangleState,
    updateGraphicsStorage: (res, desc, opts) =>
      updateGraphicsStorage(device, res, desc, opts),
    submitFrame,
    resize,
    destroy,
  });
}

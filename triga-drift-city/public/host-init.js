// U1 host-init.js — bootstraps the WebGPU device and exposes the host API.
//   - updateGraphicsStorage is a stub that throws "not wired" until U4
//     wires the real import from webgpu-runtime.js.
//   - submitFrame, resize, and destroy are placeholders for the frame
//     lifecycle wired in U4.

import { acquireWebGpuDevice } from "./webgpu-runtime.js";

/**
 * Initialize the WebGPU host session.
 * @returns {Promise<{ device: GPUDevice, updateGraphicsStorage: Function, submitFrame: Function, resize: Function, destroy: Function }>}
 */
export async function initHost() {
  const { device } = await acquireWebGpuDevice();

  function updateGraphicsStorageStub() {
    throw new Error("not wired");
  }

  function submitFrame() {
    // No-op until U4 wires the frame loop.
  }

  function resize() {
    // No-op until U4 wires canvas reconfiguration.
  }

  function destroy() {
    // No-op until U4 wires cleanup.
  }

  return {
    device,
    updateGraphicsStorage: updateGraphicsStorageStub,
    submitFrame,
    resize,
    destroy,
  };
}

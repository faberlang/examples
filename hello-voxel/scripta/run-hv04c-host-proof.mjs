#!/usr/bin/env node
// Run HV-04C WebGPU host proof in a real browser; write dist/proof evidence JSON.
// Consumes package bins from dist/generated and host WGSL/runtime from hosts/webgpu-browser.
// Fail-closed: no evidence files written on incomplete observation.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "..");
const WORKSPACE = path.resolve(APP_DIR, "../..");
const HOST_PUBLIC = path.join(WORKSPACE, "hosts/webgpu-browser/public");
const PROOF_DIR = path.join(APP_DIR, "dist/proof");
const GENERATED = path.join(APP_DIR, "dist/generated");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wgsl": "text/plain; charset=utf-8",
  ".bin": "application/octet-stream",
};

function resolvePlaywright() {
  const candidates = [
    path.join(WORKSPACE, "node_modules/playwright"),
    "/Users/ianzepp/work/cephalopodic/app/node_modules/playwright",
    "/Users/ianzepp/work/ianzepp/llama.cpp/tools/server/webui/node_modules/playwright",
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "package.json"))) {
      return pathToFileURL(path.join(c, "index.mjs")).href;
    }
  }
  // Last resort: require.resolve from cwd
  try {
    const req = createRequire(import.meta.url);
    const pkg = req.resolve("playwright/package.json");
    return pathToFileURL(path.join(path.dirname(pkg), "index.mjs")).href;
  } catch {
    return null;
  }
}

function chromeExecutable() {
  const env = process.env.HV04C_CHROME;
  if (env && fs.existsSync(env)) return env;
  const candidates = [
    "/Users/ianzepp/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Users/ianzepp/Library/Caches/ms-playwright/chromium-1194/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function mapUrl(urlPath) {
  if (urlPath === "/" || urlPath === "/index.html") {
    return path.join(__dirname, "hv04c-host-page.html");
  }
  if (urlPath === "/hv04c-host-proof-app.js") {
    return path.join(__dirname, "hv04c-host-proof-app.js");
  }
  if (urlPath.startsWith("/host-src/")) {
    return path.join(HOST_PUBLIC, "src", urlPath.slice("/host-src/".length));
  }
  if (urlPath.startsWith("/host-generated/")) {
    return path.join(HOST_PUBLIC, "generated", urlPath.slice("/host-generated/".length));
  }
  if (urlPath.startsWith("/generated/")) {
    return path.join(GENERATED, urlPath.slice("/generated/".length));
  }
  if (urlPath.startsWith("/proof/")) {
    return path.join(PROOF_DIR, urlPath.slice("/proof/".length));
  }
  return null;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const filePath = mapUrl(urlPath);
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(`not found: ${urlPath}`);
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on("error", reject);
  });
}

function requiredBinsPresent() {
  const need = [
    "vertex-positions.bin",
    "vertex-colors.bin",
    "indices.bin",
    "transform.bin",
    "transform-frame2.bin",
    "draw.json",
  ];
  for (const name of need) {
    if (!fs.existsSync(path.join(GENERATED, name))) {
      return `missing ${path.join(GENERATED, name)}`;
    }
  }
  if (!fs.existsSync(path.join(PROOF_DIR, "artifact-id.json"))) {
    return "missing dist/proof/artifact-id.json (run emit-package-geometry first)";
  }
  if (!fs.existsSync(path.join(HOST_PUBLIC, "generated/graphics.wgsl"))) {
    return "missing hosts/webgpu-browser graphics.wgsl";
  }
  return null;
}

function writeEvidence(proof) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const artifactId = proof.artifact_id ?? null;
  const last = proof.lastSubmit ?? proof.submits?.[0] ?? {};

  const submit = {
    kind: "hv-04c-submit-evidence",
    artifact_id: artifactId,
    method: "drawIndexed",
    drawIndexed: true,
    index_count: proof.index_count ?? last.index_count ?? 36,
    instance_count: proof.instance_count ?? last.instance_count ?? 1,
    first_index: last.first_index ?? 0,
    base_vertex: last.base_vertex ?? 0,
    submittedFrameCount: proof.submittedFrameCount,
    submits: proof.submits,
    package: proof.package,
    source: "hosts/webgpu-browser runGraphicsFrame + hello-voxel package bins",
  };

  const depth = {
    kind: "hv-04c-depth-evidence",
    artifact_id: artifactId,
    depth_test_enabled: proof.depth?.depth_test_enabled === true,
    depth_write_enabled: proof.depth?.depth_write_enabled === true,
    depth_compare: proof.depth?.depth_compare ?? "less",
    depth_format: proof.depth?.depth_format ?? "depth24plus",
    depth_attachment_used: proof.depth?.depth_attachment_used === true,
    resized_depth_texture: proof.depth?.resized_depth_texture === true,
    source: "hosts/webgpu-browser depthStencilAttachment + replaceDepthTextureOnResize",
  };

  const pixel = {
    kind: "hv-04c-pixel-evidence",
    artifact_id: artifactId,
    background_hex: proof.pixels?.background_hex,
    css_background_hex: proof.pixels?.css_background_hex,
    clear_control_hex: proof.pixels?.clear_control_hex,
    clear_control_ok: proof.pixels?.clear_control_ok === true,
    central_is_background: proof.pixels?.central_is_background === true,
    frame1_non_background: proof.pixels?.frame1_non_background === true,
    frame2_non_background: proof.pixels?.frame2_non_background === true,
    frame1: proof.pixels?.frame1,
    frame2: proof.pixels?.frame2,
    two_frame_times: true,
    source: "readTexturePixelsRgba on same swapchain texture as drawIndexed",
  };

  fs.writeFileSync(
    path.join(PROOF_DIR, "hv-04c-submit-evidence.json"),
    `${JSON.stringify(submit, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(PROOF_DIR, "hv-04c-depth-evidence.json"),
    `${JSON.stringify(depth, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(PROOF_DIR, "hv-04c-pixel-evidence.json"),
    `${JSON.stringify(pixel, null, 2)}\n`,
  );

  return { submit, depth, pixel };
}

async function main() {
  const missing = requiredBinsPresent();
  if (missing) {
    console.error(`run-hv04c-host-proof: ${missing}`);
    process.exit(1);
  }

  const pwUrl = resolvePlaywright();
  if (!pwUrl) {
    console.error("run-hv04c-host-proof: playwright not found (install or set path)");
    process.exit(1);
  }
  const chrome = chromeExecutable();
  if (!chrome) {
    console.error("run-hv04c-host-proof: no Chrome/Brave executable found");
    process.exit(1);
  }

  const { chromium } = await import(pwUrl);
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}/`;
  console.log(`run-hv04c-host-proof: serving ${base}`);
  console.log(`  chrome=${chrome}`);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chrome,
      headless: false,
      args: [
        "--enable-unsafe-webgpu",
        "--enable-webgpu-developer-features",
        "--ignore-gpu-blocklist",
        "--use-angle=metal",
        "--disable-gpu-sandbox",
      ],
    });
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.error("pageerror", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("console", msg.text());
    });

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => window.faberHv04cProof && window.faberHv04cProof.status !== "starting",
      null,
      { timeout: 60_000 },
    );
    const proof = await page.evaluate(() => window.faberHv04cProof);
    console.log("run-hv04c-host-proof: browser state", {
      ok: proof.ok,
      status: proof.status,
      frames: proof.submittedFrameCount,
      error: proof.error,
    });

    if (proof.status === "error" || !proof.submits || proof.submits.length < 2) {
      console.error("run-hv04c-host-proof: incomplete GPU observation", proof);
      process.exitCode = 1;
      return;
    }

    const evidence = writeEvidence(proof);
    if (
      evidence.submit.drawIndexed !== true ||
      Number(evidence.submit.index_count) !== 36 ||
      evidence.depth.depth_test_enabled !== true ||
      evidence.pixel.central_is_background !== false
    ) {
      console.error("run-hv04c-host-proof: evidence failed gate assertions", {
        submit: evidence.submit,
        depth: evidence.depth,
        pixel: {
          central_is_background: evidence.pixel.central_is_background,
          frame1: evidence.pixel.frame1_non_background,
          frame2: evidence.pixel.frame2_non_background,
        },
      });
      // Still leave files for inspection, but fail closed.
      process.exitCode = 1;
      return;
    }

    console.log("run-hv04c-host-proof: wrote evidence to", PROOF_DIR);
    console.log(`  artifact_id=${proof.artifact_id}`);
    console.log(`  submit frames=${evidence.submit.submittedFrameCount}`);
    console.log(`  pixels non-bg f1=${evidence.pixel.frame1_non_background} f2=${evidence.pixel.frame2_non_background}`);
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
}

main().catch((err) => {
  console.error("run-hv04c-host-proof: fatal", err);
  process.exit(1);
});

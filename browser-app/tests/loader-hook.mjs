// Node.js ESM resolve hook:
//   - maps "tela:dom" and "tela:web" to the runtime bridge
//   - maps "triga:triga", "triga:geometry", "triga:scene" to the triga bridge
//   - appends .js to extensionless relative specifiers (Faber ESM convention)
const bridgeUrl = new URL("./runtime-bridge.mjs", import.meta.url).href;
const trigaUrl = new URL("./triga-bridge.mjs", import.meta.url).href;

// Regex: relative path (./ or ../) without a file extension.
const EXTENSIONLESS_RELATIVE = /^\.\.?\/(.*[^/])$/;

export async function resolve(specifier, context, nextResolve) {
  console.error("loader-hook resolve:", JSON.stringify(specifier), "parent:", context.parentURL?.split("/").slice(-3).join("/"));
  // Bare specifier: used directly in Faber source.
  if (specifier === "tela:dom" || specifier === "tela:web") {
    console.error("loader-hook: intercept bare tela:dom/tela:web → bridge");
    return { url: bridgeUrl, shortCircuit: true };
  }
  // Compiled relative path: Faber/radix compiler rewrites bare specifiers
  // (e.g. "tela:dom") to relative paths (e.g. "./tela-dom.js"). Catch those
  // too so the runtime bridge is used instead of the generated stubs.
  if (specifier.endsWith("/tela-dom.js") || specifier.endsWith("/tela-web.js")) {
    console.error("loader-hook: intercept compiled ./tela-dom.js → bridge");
    return { url: bridgeUrl, shortCircuit: true };
  }
  if (specifier === "triga:triga" || specifier === "triga:geometry" || specifier === "triga:scene") {
    return { url: trigaUrl, shortCircuit: true };
  }
  // Try extensionless relative as .js (Faber-generated ESM convention).
  if (EXTENSIONLESS_RELATIVE.test(specifier)) {
    try {
      return await nextResolve(specifier + ".js", context);
    } catch {
      // Fall through to default resolve below.
    }
  }
  return nextResolve(specifier, context);
}

// Node.js ESM resolve hook:
//   - maps "web:dom" and "web:web" to the runtime bridge
//   - maps "triga:triga", "triga:geometry", "triga:scene" to the triga bridge
//   - appends .js to extensionless relative specifiers (Faber ESM convention)
const bridgeUrl = new URL("./runtime-bridge.mjs", import.meta.url).href;
const trigaUrl = new URL("./triga-bridge.mjs", import.meta.url).href;

// Regex: relative path (./ or ../) without a file extension.
const EXTENSIONLESS_RELATIVE = /^\.\.?\/(.*[^/])$/;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "web:dom" || specifier === "web:web") {
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

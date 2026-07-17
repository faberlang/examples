// Node.js ESM resolve hook — maps "web:dom" and "web:web" to the bridge.
const bridgeUrl = new URL("./runtime-bridge.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "web:dom" || specifier === "web:web") {
    return { url: bridgeUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

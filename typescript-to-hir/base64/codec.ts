const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encode(text: string): string {
  // Minimal byte loop over char codes (profile-friendly; not Buffer).
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i = i + 1) {
    bytes.push(text.charCodeAt(i) & 0xff);
  }
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    const rem = bytes.length - i;
    out = out + ALPHABET[(n >> 18) & 63];
    out = out + ALPHABET[(n >> 12) & 63];
    out = out + (rem > 1 ? ALPHABET[(n >> 6) & 63] : "=");
    out = out + (rem > 2 ? ALPHABET[n & 63] : "=");
    i = i + 3;
  }
  return out;
}

export function decode(text: string): string {
  const clean = text.replace(/=+$/, "");
  const bytes: number[] = [];
  let i = 0;
  while (i < clean.length) {
    const c0 = ALPHABET.indexOf(clean[i] ?? "");
    const c1 = ALPHABET.indexOf(clean[i + 1] ?? "");
    const c2 = i + 2 < clean.length ? ALPHABET.indexOf(clean[i + 2] ?? "") : 0;
    const c3 = i + 3 < clean.length ? ALPHABET.indexOf(clean[i + 3] ?? "") : 0;
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) {
      throw new Error("invalid base64");
    }
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes.push((n >> 16) & 0xff);
    if (i + 2 < clean.length) {
      bytes.push((n >> 8) & 0xff);
    }
    if (i + 3 < clean.length) {
      bytes.push(n & 0xff);
    }
    i = i + 4;
  }
  let out = "";
  for (let j = 0; j < bytes.length; j = j + 1) {
    out = out + String.fromCharCode(bytes[j] ?? 0);
  }
  return out;
}

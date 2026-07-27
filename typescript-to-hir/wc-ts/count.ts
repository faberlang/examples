export type Counts = {
  lines: number;
  words: number;
  chars: number;
};

export function countText(text: string): Counts {
  let lines = 0;
  let words = 0;
  let chars = text.length;
  let inWord = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      lines = lines + 1;
      inWord = false;
    } else if (ch === " " || ch === "\t" || ch === "\r") {
      inWord = false;
    } else {
      if (!inWord) {
        words = words + 1;
        inWord = true;
      }
    }
    i = i + 1;
  }
  if (text.length > 0 && !text.endsWith("\n")) {
    lines = lines + 1;
  }
  if (text.length === 0) {
    lines = 0;
  }
  return { lines, words, chars };
}

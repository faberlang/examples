export function prettyJson(text: string): string {
  const value: unknown = JSON.parse(text);
  return JSON.stringify(value, null, 2);
}

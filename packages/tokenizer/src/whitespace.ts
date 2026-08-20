export function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

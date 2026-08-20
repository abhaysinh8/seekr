export function splitTokens(text: string): string[] {
  return text.split(/\s/gu);
}

export function removeEmptyTokens(tokens: readonly string[]): string[] {
  return tokens.filter((token) => token.length > 0);
}

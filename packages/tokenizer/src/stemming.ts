import type { Stemmer } from './types.js';

export function applyStemmer(tokens: readonly string[], stemmer: Stemmer): string[] {
  return tokens.map((token) => stemmer.stem(token)).filter((token) => token.length > 0);
}

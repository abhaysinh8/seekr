import type { DetailedToken, NGramOptions } from './types.js';

function validateNGramOptions(options: NGramOptions): void {
  if (!Number.isInteger(options.minN) || options.minN < 1) {
    throw new RangeError('minN must be a positive integer');
  }
  if (!Number.isInteger(options.maxN) || options.maxN < options.minN) {
    throw new RangeError('maxN must be an integer greater than or equal to minN');
  }
}

export function generateNGrams(tokens: readonly string[], options: NGramOptions): string[] {
  validateNGramOptions(options);
  const separator = options.separator ?? ' ';
  const nGrams: string[] = [];

  for (let size = options.minN; size <= options.maxN; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      nGrams.push(tokens.slice(start, start + size).join(separator));
    }
  }

  return nGrams;
}

export function generateDetailedNGrams(
  tokens: readonly DetailedToken[],
  options: NGramOptions,
): DetailedToken[] {
  validateNGramOptions(options);
  const separator = options.separator ?? ' ';
  const nGrams: DetailedToken[] = [];

  for (let size = options.minN; size <= options.maxN; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      const window = tokens.slice(start, start + size);
      const first = window[0];
      const last = window.at(-1);

      if (first !== undefined && last !== undefined) {
        nGrams.push({
          token: window.map(({ token }) => token).join(separator),
          position: first.position,
          startOffset: first.startOffset,
          endOffset: last.endOffset,
        });
      }
    }
  }

  return nGrams;
}

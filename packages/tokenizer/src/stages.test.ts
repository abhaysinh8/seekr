import { describe, expect, it } from 'vitest';

import {
  applyStemmer,
  convertToLowercase,
  handlePunctuation,
  normalizeToken,
  normalizeUnicode,
  normalizeWhitespace,
  removeEmptyTokens,
  removeStopWords,
  splitTokens,
} from './index.js';

describe('text processing stages', () => {
  it('normalizes compatible Unicode representations', () => {
    expect(normalizeUnicode('Ｃａｆｅ\u0301')).toBe('Café');
  });

  it('converts text to lowercase independently', () => {
    expect(convertToLowercase('SEEKR Search')).toBe('seekr search');
  });

  it('supports replacing, removing, and preserving punctuation', () => {
    expect(handlePunctuation('index-ready!')).toBe('index ready ');
    expect(handlePunctuation('index-ready!', 'remove')).toBe('indexready');
    expect(handlePunctuation('index-ready!', 'preserve')).toBe('index-ready!');
  });

  it('collapses and trims whitespace', () => {
    expect(normalizeWhitespace('\t search   and\n retrieve  ')).toBe('search and retrieve');
  });

  it('splits tokens and removes empty values as separate stages', () => {
    expect(removeEmptyTokens(splitTokens(' search  engine '))).toEqual(['search', 'engine']);
    expect(removeEmptyTokens(splitTokens(''))).toEqual([]);
  });

  it('normalizes a single token with the shared defaults', () => {
    expect(normalizeToken('ＡMAZING!')).toBe('amazing');
  });

  it('removes stop words independently', () => {
    expect(removeStopWords(['search', 'the', 'index'])).toEqual(['search', 'index']);
  });

  it('accepts an external stemming strategy without bundling a stemmer', () => {
    const singularStemmer = {
      stem: (token: string) => (token.endsWith('s') ? token.slice(0, -1) : token),
    };

    expect(applyStemmer(['models', 'search'], singularStemmer)).toEqual(['model', 'search']);
  });
});

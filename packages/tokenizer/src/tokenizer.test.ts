import { describe, expect, it } from 'vitest';

import { createTokenizer, generateNGrams, tokenize, tokenizeDetailed } from './index.js';

describe('tokenize', () => {
  it('processes a normal sentence through every default stage', () => {
    expect(tokenize('Machine Learning models are AMAZING!')).toEqual([
      'machine',
      'learning',
      'models',
      'amazing',
    ]);
  });

  it('normalizes uppercase strings', () => {
    expect(tokenize('SEEKR BUILDS SEARCH')).toEqual(['seekr', 'builds', 'search']);
  });

  it('uses punctuation as token boundaries', () => {
    expect(tokenize('fast,local;search-ready!', { stopWordRemoval: false })).toEqual([
      'fast',
      'local',
      'search',
      'ready',
    ]);
  });

  it('normalizes repeated mixed whitespace', () => {
    expect(tokenize('  index\t\tquery\n retrieval  ')).toEqual(['index', 'query', 'retrieval']);
  });

  it('returns no tokens for empty or whitespace-only input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(' \t\n ')).toEqual([]);
  });

  it('normalizes Unicode while preserving the original source span', () => {
    const input = 'Cafe\u0301 ＡＩ';

    expect(tokenizeDetailed(input)).toEqual([
      { token: 'café', position: 0, startOffset: 0, endOffset: 5 },
      { token: 'ai', position: 1, startOffset: 6, endOffset: 8 },
    ]);
  });

  it('retains numbers and splits punctuation between them', () => {
    expect(tokenize('Version 2.0 costs $50')).toEqual(['version', '2', '0', 'costs', '50']);
  });

  it('uses the default English stop-word list and can disable it', () => {
    expect(tokenize('the model is in the index')).toEqual(['model', 'index']);
    expect(tokenize('the model is in the index', { stopWordRemoval: false })).toEqual([
      'the',
      'model',
      'is',
      'in',
      'the',
      'index',
    ]);
  });

  it('supports a custom stop-word set', () => {
    expect(
      tokenize('machine models produce amazing results', {
        stopWords: new Set(['machine', 'models', 'results']),
      }),
    ).toEqual(['produce', 'amazing']);
  });

  it('preserves duplicated words and their positions', () => {
    expect(tokenizeDetailed('search search search')).toEqual([
      { token: 'search', position: 0, startOffset: 0, endOffset: 6 },
      { token: 'search', position: 1, startOffset: 7, endOffset: 13 },
      { token: 'search', position: 2, startOffset: 14, endOffset: 20 },
    ]);
  });

  it('does not enable n-grams by default', () => {
    expect(tokenize('machine learning')).toEqual(['machine', 'learning']);
  });

  it('generates configured n-gram ranges', () => {
    expect(generateNGrams(['machine', 'learning'], { minN: 2, maxN: 2 })).toEqual([
      'machine learning',
    ]);
    expect(
      tokenize('machine learning models', {
        nGrams: { minN: 1, maxN: 2 },
        stopWordRemoval: false,
      }),
    ).toEqual(['machine', 'learning', 'models', 'machine learning', 'learning models']);
  });

  it('rejects invalid n-gram ranges', () => {
    expect(() => generateNGrams(['search'], { minN: 0, maxN: 1 })).toThrow(RangeError);
    expect(() => generateNGrams(['search'], { minN: 3, maxN: 2 })).toThrow(RangeError);
  });

  it('tracks token positions and end-exclusive offsets', () => {
    expect(tokenizeDetailed('Hi,  world!', { stopWordRemoval: false })).toEqual([
      { token: 'hi', position: 0, startOffset: 0, endOffset: 2 },
      { token: 'world', position: 1, startOffset: 5, endOffset: 10 },
    ]);
  });

  it('preserves positional gaps after stop-word removal', () => {
    expect(tokenizeDetailed('machine and learning')).toEqual([
      { token: 'machine', position: 0, startOffset: 0, endOffset: 7 },
      { token: 'learning', position: 2, startOffset: 12, endOffset: 20 },
    ]);
  });

  it('assigns n-grams the full source span and first token position', () => {
    expect(
      tokenizeDetailed('machine learning', {
        nGrams: { minN: 2, maxN: 2 },
      }),
    ).toEqual([{ token: 'machine learning', position: 0, startOffset: 0, endOffset: 16 }]);
  });

  it('applies an optional stemmer after stop-word removal', () => {
    expect(
      tokenize('models indexes', {
        stemmer: {
          stem: (token) => (token.endsWith('s') ? token.slice(0, -1) : token),
        },
      }),
    ).toEqual(['model', 'indexe']);
  });

  it('creates a reusable tokenizer with overridable defaults', () => {
    const caseSensitiveTokenizer = createTokenizer({
      lowercase: false,
      stopWordRemoval: false,
    });

    expect(caseSensitiveTokenizer.tokenize('Seekr AND Search')).toEqual(['Seekr', 'AND', 'Search']);
    expect(caseSensitiveTokenizer.tokenize('Seekr AND Search', { lowercase: true })).toEqual([
      'seekr',
      'and',
      'search',
    ]);
  });
});

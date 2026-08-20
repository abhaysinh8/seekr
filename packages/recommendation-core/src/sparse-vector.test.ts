import { describe, expect, it } from 'vitest';
import { cosineSimilarity, normalizeSparseVector, sparseDotProduct } from './sparse-vector.js';

describe('sparse vector math', () => {
  it('computes dot products and cosine similarity without dense arrays', () => {
    const left = new Map([
      ['x', 1],
      ['y', 2],
    ]);
    const right = new Map([
      ['y', 2],
      ['z', 5],
    ]);
    expect(sparseDotProduct(left, right)).toBe(4);
    expect(cosineSimilarity(new Map([['x', 1]]), new Map([['x', 2]]))).toBe(1);
    expect(cosineSimilarity(new Map([['x', 1]]), new Map([['y', 1]]))).toBe(0);
  });
  it('normalizes vectors to unit magnitude', () => {
    expect([
      ...normalizeSparseVector(
        new Map([
          ['x', 3],
          ['y', 4],
        ]),
      ).values(),
    ]).toEqual([0.6, 0.8]);
  });
});

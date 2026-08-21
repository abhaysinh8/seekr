import { describe, expect, it } from 'vitest';
import { MinHeap } from './heap.js';
import { InMemoryInvertedIndex } from './inverted-index.js';

function random(seed = 0x5eed): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe('deterministic randomized invariants', () => {
  it('always pops heap values in sorted order', () => {
    const next = random();
    for (let run = 0; run < 50; run += 1) {
      const values = Array.from({ length: 5 + Math.floor(next() * 200) }, () =>
        Math.floor(next() * 10_000),
      );
      const heap = new MinHeap<number>((left, right) => left - right);
      for (const value of values) heap.push(value);
      const popped: number[] = [];
      while (heap.size > 0) popped.push(heap.pop() as number);
      expect(popped).toEqual([...values].sort((left, right) => left - right));
    }
  });

  it('keeps postings and collection statistics consistent through updates and deletes', () => {
    const next = random(42);
    const index = new InMemoryInvertedIndex();
    const expected = new Map<string, string[]>();
    const vocabulary = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    for (let operation = 0; operation < 250; operation += 1) {
      const id = `doc-${Math.floor(next() * 30)}`;
      if (next() < 0.25) {
        index.removeDocument(id);
        expected.delete(id);
      } else {
        const tokens = Array.from(
          { length: Math.floor(next() * 10) },
          () => vocabulary[Math.floor(next() * vocabulary.length)] as string,
        );
        index.addDocument({ id, fields: { content: tokens.join(' ') } });
        expected.set(id, tokens);
      }
      expect(index.documentCount).toBe(expected.size);
      for (const term of vocabulary) {
        const matching = [...expected].filter(([, tokens]) => tokens.includes(term));
        expect(index.getDocumentFrequency(term)).toBe(matching.length);
        expect(index.getPostingList(term)).toHaveLength(matching.length);
      }
      const expectedLength = [...expected.values()].reduce((sum, tokens) => sum + tokens.length, 0);
      expect(index.getCollectionStatistics().averageDocumentLength).toBe(
        expected.size === 0 ? 0 : expectedLength / expected.size,
      );
    }
  });
});

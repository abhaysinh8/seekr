import { describe, expect, it } from 'vitest';
import {
  dcgAtK,
  evaluateConfigurations,
  formatEvaluationTable,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  reciprocalRank,
} from './evaluation.js';

describe('offline ranking evaluation', () => {
  const relevant = { a: 3, c: 1 };
  const retrieved = ['a', 'b', 'c'];
  it('computes manually verifiable ranking metrics', () => {
    expect(precisionAtK(retrieved, relevant, 2)).toBe(0.5);
    expect(recallAtK(retrieved, relevant, 2)).toBe(0.5);
    expect(reciprocalRank(retrieved, relevant)).toBe(1);
    expect(dcgAtK(retrieved, relevant, 3)).toBeCloseTo(7.5);
    expect(ndcgAtK(retrieved, relevant, 3)).toBeCloseTo(7.5 / (7 + 1 / Math.log2(3)));
  });
  it('compares TF-IDF, BM25 parameters, and field weights', () => {
    const dataset = {
      documents: [
        { id: 'a', fields: { title: 'machine learning', body: 'models' } },
        { id: 'b', fields: { title: 'models', body: 'machine learning introduction' } },
        { id: 'c', fields: { title: 'databases', body: 'storage' } },
      ],
      queries: [{ query: 'machine learning', relevantDocuments: { a: 3, b: 1 } }],
    };
    const results = evaluateConfigurations(
      dataset,
      [
        { name: 'TF-IDF', search: { ranking: 'tfidf' } },
        { name: 'BM25 tuned', search: { ranking: 'bm25', k1: 1.8, b: 0.5 } },
        {
          name: 'Title boost',
          index: { fields: { title: { searchable: true, weight: 4 }, body: { searchable: true } } },
        },
      ],
      2,
    );
    expect(results).toHaveLength(3);
    expect(results.every((result) => result.meanReciprocalRank === 1)).toBe(true);
    expect(formatEvaluationTable(results)).toContain('BM25 tuned');
  });
});

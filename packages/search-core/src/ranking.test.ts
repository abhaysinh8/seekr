import { describe, expect, it } from 'vitest';

import { BM25RankingStrategy, inverseDocumentFrequency, TFIDFRankingStrategy } from './ranking.js';

const baseInput = {
  termFrequency: 1,
  documentFrequency: 2,
  documentCount: 10,
  documentLength: 10,
  averageDocumentLength: 10,
};

describe('ranking strategies', () => {
  it('implements raw and smoothed TF-IDF behavior', () => {
    expect(inverseDocumentFrequency(10, 2)).toBeCloseTo(Math.log(5));
    const strategy = new TFIDFRankingStrategy();
    expect(strategy.score({ ...baseInput, termFrequency: 3 }).score).toBeGreaterThan(
      strategy.score(baseInput).score,
    );
    expect(strategy.score({ ...baseInput, documentCount: 0 }).score).toBe(0);
  });

  it('makes term frequency saturate under BM25', () => {
    const strategy = new BM25RankingStrategy({ k1: 1.2, b: 0 });
    const once = strategy.score(baseInput).score;
    const twice = strategy.score({ ...baseInput, termFrequency: 2 }).score;
    const tenTimes = strategy.score({ ...baseInput, termFrequency: 10 }).score;
    expect(twice - once).toBeGreaterThan(0);
    expect(tenTimes - twice).toBeLessThan(once);
  });

  it('normalizes long documents when b is enabled', () => {
    const strategy = new BM25RankingStrategy({ b: 0.75 });
    const short = strategy.score({ ...baseInput, documentLength: 5 }).score;
    const long = strategy.score({ ...baseInput, documentLength: 50 }).score;
    expect(short).toBeGreaterThan(long);
  });

  it('allows k1 and b to alter saturation and length normalization', () => {
    const lowK1 = new BM25RankingStrategy({ k1: 0.2, b: 0 });
    const highK1 = new BM25RankingStrategy({ k1: 2, b: 0 });
    const repeated = { ...baseInput, termFrequency: 5 };
    expect(highK1.score(repeated).tf).toBeGreaterThan(lowK1.score(repeated).tf);

    const noLengthNormalization = new BM25RankingStrategy({ b: 0 });
    const lengthNormalization = new BM25RankingStrategy({ b: 1 });
    const long = { ...baseInput, documentLength: 50 };
    expect(noLengthNormalization.score(long).score).toBeGreaterThan(
      lengthNormalization.score(long).score,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { QuerySuggestionIndex } from './query-suggestions.js';

describe('query suggestions', () => {
  it('keeps query and term suggestions distinct and uses frequency and CTR', () => {
    const index = new QuerySuggestionIndex();
    index.recordSearch('s1', 'Machine Learning', 10, 10, new Date('2026-01-10'));
    index.recordSearch('s2', 'machine learning', 8, 8, new Date('2026-01-10'));
    index.recordSearch('s3', 'machine vision', 5, 5, new Date('2026-01-10'));
    index.recordClick('s3');
    index.recordClick('s3');
    const result = index.suggest('mach', {
      now: new Date('2026-01-10'),
      termSuggestions: ['machine', 'machinery'],
    });
    expect(result.termSuggestions).toEqual(['machine', 'machinery']);
    expect(result.querySuggestions.map((item) => item.value)).toEqual([
      'machine vision',
      'machine learning',
    ]);
  });
  it('decays old queries and excludes unsuccessful or missing prefixes', () => {
    const index = new QuerySuggestionIndex();
    index.recordSearch('old', 'machine learning algorithms', 4, 4, new Date('2025-01-01'));
    index.recordSearch('new', 'machine learning models', 4, 4, new Date('2026-01-01'));
    index.recordSearch('zero', 'machine impossible', 0, 0, new Date('2026-01-01'));
    expect(
      index
        .suggest('machine', { now: new Date('2026-01-01'), halfLifeMs: 30 * 24 * 60 * 60_000 })
        .querySuggestions.map((item) => item.value),
    ).toEqual(['machine learning models', 'machine learning algorithms']);
    expect(index.suggest('unknown').querySuggestions).toEqual([]);
  });
});

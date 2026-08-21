import { describe, expect, it, vi } from 'vitest';
import { SearchIndex } from './search-engine.js';

describe('safe declarative custom ranking rules', () => {
  it('keeps text relevance as the base and adds field boost contributions', () => {
    const index = new SearchIndex({
      rankingRules: [{ field: 'featured', condition: 'equals', value: true, boost: 1.5 }],
    });
    index.addDocuments([
      { id: 'normal', fields: { body: 'search search search' }, metadata: { featured: false } },
      { id: 'featured', fields: { body: 'search search search' }, metadata: { featured: true } },
    ]);
    const result = index.search('search', { explain: true });
    expect(result.results[0]?.documentId).toBe('featured');
    expect(result.results[0]?.explanation?.rankingRules[0]).toMatchObject({
      field: 'featured',
      rule: 'boost',
    });
  });
  it('supports recency decay without executing arbitrary expressions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));
    const index = new SearchIndex({
      rankingRules: [{ field: 'publishedAt', strategy: 'recency', halfLifeDays: 10, weight: 1 }],
    });
    index.addDocuments([
      { id: 'old', fields: { body: 'search' }, metadata: { publishedAt: '2025-01-01T00:00:00Z' } },
      { id: 'new', fields: { body: 'search' }, metadata: { publishedAt: '2026-01-30T00:00:00Z' } },
    ]);
    expect(index.search('search').results[0]?.documentId).toBe('new');
    vi.useRealTimers();
  });
});

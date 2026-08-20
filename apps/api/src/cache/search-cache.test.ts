import { describe, expect, it, vi } from 'vitest';
import { SearchResponseCache, createDeterministicCacheKey } from './search-cache.js';
import { MemoryCacheStore, ResilientCacheStore, type CacheStore } from './store.js';

const response = { results: [], total: 0, facets: {} } as const;

describe('search response cache', () => {
  it('creates deterministic keys independent of object property insertion order', () => {
    expect(createDeterministicCacheKey('search', { query: 'seekr', limit: 10 })).toBe(
      createDeterministicCacheKey('search', { limit: 10, query: 'seekr' }),
    );
  });

  it('serves hits and separates every relevant option and index generation', async () => {
    const cache = new SearchResponseCache(new MemoryCacheStore(), 30);
    const compute = vi.fn(() => response);
    await cache.getOrCompute(
      'index',
      1,
      'query',
      { limit: 10, ranking: 'bm25', filters: [] },
      compute,
    );
    await cache.getOrCompute(
      'index',
      1,
      'query',
      { limit: 10, ranking: 'bm25', filters: [] },
      compute,
    );
    expect(compute).toHaveBeenCalledOnce();
    await cache.getOrCompute(
      'index',
      2,
      'query',
      { limit: 10, ranking: 'bm25', filters: [] },
      compute,
    );
    await cache.getOrCompute(
      'index',
      2,
      'query',
      { limit: 20, ranking: 'bm25', filters: [] },
      compute,
    );
    await cache.getOrCompute(
      'index',
      2,
      'query',
      { limit: 20, ranking: 'tfidf', filters: [] },
      compute,
    );
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it('expires memory entries', async () => {
    let now = 1_000;
    const store = new MemoryCacheStore(() => now);
    await store.set('key', 'value', 1);
    expect(await store.get('key')).toBe('value');
    now = 2_000;
    expect(await store.get('key')).toBeUndefined();
  });

  it('falls back cleanly when the cache provider fails', async () => {
    const failing: CacheStore = {
      get: vi.fn().mockRejectedValue(new Error('redis unavailable')),
      set: vi.fn().mockRejectedValue(new Error('redis unavailable')),
      delete: vi.fn().mockRejectedValue(new Error('redis unavailable')),
    };
    const cache = new SearchResponseCache(new ResilientCacheStore(failing));
    await expect(cache.getOrCompute('index', 1, 'query', {}, () => response)).resolves.toEqual(
      response,
    );
  });
});

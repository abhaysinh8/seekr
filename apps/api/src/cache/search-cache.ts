import { createHash } from 'node:crypto';
import type { AutocompleteOptions, SearchOptions, SearchResponse } from '@seekr/search-core';
import type { CacheStore } from './store.js';

export class SearchResponseCache {
  readonly #inFlight = new Map<string, Promise<SearchResponse>>();
  constructor(
    private readonly store: CacheStore,
    private readonly ttlSeconds = 30,
  ) {}

  async getOrCompute(
    indexId: string,
    generation: number,
    query: string,
    options: SearchOptions,
    compute: () => SearchResponse,
  ): Promise<SearchResponse> {
    const key = createDeterministicCacheKey('search', { indexId, generation, query, options });
    const cached = await this.store.get(key);
    if (cached !== undefined) return JSON.parse(cached) as SearchResponse;
    const active = this.#inFlight.get(key);
    if (active !== undefined) return active;
    const pending = Promise.resolve()
      .then(async () => {
        const result = compute();
        await this.store.set(key, JSON.stringify(result), this.ttlSeconds);
        return result;
      })
      .finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, pending);
    return pending;
  }

  async getAutocompleteOrCompute(
    indexId: string,
    generation: number,
    prefix: string,
    options: AutocompleteOptions,
    compute: () => readonly string[],
  ): Promise<readonly string[]> {
    const key = createDeterministicCacheKey('autocomplete', {
      indexId,
      generation,
      prefix,
      options,
    });
    const cached = await this.store.get(key);
    if (cached !== undefined) return JSON.parse(cached) as readonly string[];
    const result = compute();
    await this.store.set(key, JSON.stringify(result), this.ttlSeconds);
    return result;
  }
}

export function createDeterministicCacheKey(namespace: string, value: unknown): string {
  const digest = createHash('sha256').update(stableStringify(value)).digest('hex');
  return `seekr:${namespace}:${digest}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

import { QuerySuggestionIndex } from '@seekr/search-core';

export class QuerySuggestionService {
  readonly #indexes = new Map<string, QuerySuggestionIndex>();
  readonly #searchIndexes = new Map<string, string>();

  recordSearch(
    indexId: string,
    searchId: string,
    query: string,
    resultCount: number,
    impressions: number,
  ): void {
    this.#searchIndexes.set(searchId, indexId);
    this.#get(indexId).recordSearch(searchId, query, resultCount, impressions);
  }

  recordClick(searchId: string): void {
    const indexId = this.#searchIndexes.get(searchId);
    if (indexId !== undefined) this.#get(indexId).recordClick(searchId);
  }

  suggest(indexId: string, prefix: string, limit: number, termSuggestions: readonly string[]) {
    return this.#get(indexId).suggest(prefix, { limit, termSuggestions });
  }

  #get(indexId: string): QuerySuggestionIndex {
    let index = this.#indexes.get(indexId);
    if (index === undefined) {
      index = new QuerySuggestionIndex();
      this.#indexes.set(indexId, index);
    }
    return index;
  }
}

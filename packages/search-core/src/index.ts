/** Input contract for search strategies. Algorithms intentionally arrive in the next milestone. */
export interface SearchRequest {
  readonly indexId: string;
  readonly query: string;
  readonly limit: number;
}

export interface SearchHit<TDocument = Readonly<Record<string, unknown>>> {
  readonly document: TDocument;
  readonly score: number;
}

export interface SearchResult<TDocument = Readonly<Record<string, unknown>>> {
  readonly hits: readonly SearchHit<TDocument>[];
  readonly total: number;
  readonly tookMs: number;
}

export interface SearchEngine<TDocument = Readonly<Record<string, unknown>>> {
  search(request: SearchRequest): Promise<SearchResult<TDocument>>;
}

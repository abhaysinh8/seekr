import type {
  AddDocumentApiRequest,
  AutocompleteApiRequest,
  ClickEventApiRequest,
  CreateIndexApiRequest,
  CreateProjectApiRequest,
  RecordInteractionApiRequest,
  SearchApiRequest,
} from '@seekr/shared';

export type {
  AddDocumentApiRequest,
  AutocompleteApiRequest,
  ClickEventApiRequest,
  CreateIndexApiRequest,
  CreateProjectApiRequest,
  RecordInteractionApiRequest,
  SearchApiRequest,
};

export interface SeekrClientOptions {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly idempotencyKey?: string;
}

export interface ApiEnvelope {
  readonly requestId: string;
}

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IndexRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly schema: CreateIndexApiRequest['schema'];
  readonly status: 'ready' | 'indexing' | 'error';
  readonly lastIndexedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentRecord extends AddDocumentApiRequest {
  readonly indexId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SearchHit {
  readonly documentId: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
  readonly document?: AddDocumentApiRequest;
  readonly highlights?: Readonly<Record<string, string>>;
  readonly explanation?: unknown;
}

export interface SearchResponse extends ApiEnvelope {
  readonly query: string;
  readonly searchId: string;
  readonly processingTimeMs: number;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hits: readonly SearchHit[];
  readonly facets: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly correction: unknown;
}

export type SearchRequest = { readonly query: string } & Partial<Omit<SearchApiRequest, 'query'>>;
export type AutocompleteRequest = { readonly prefix: string } & Partial<
  Omit<AutocompleteApiRequest, 'prefix'>
>;

export interface AutocompleteResponse extends ApiEnvelope {
  readonly prefix: string;
  readonly suggestions: readonly unknown[];
  readonly termSuggestions: readonly unknown[];
  readonly querySuggestions: readonly unknown[];
  readonly processingTimeMs: number;
}

export interface RecommendationQuery {
  readonly indexId: string;
  readonly limit?: number;
  readonly explain?: boolean;
}

export type AnalyticsRange = {
  readonly start?: string;
  readonly end?: string;
  readonly limit?: number;
};

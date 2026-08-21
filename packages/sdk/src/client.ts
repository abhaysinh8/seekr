import { SeekrError } from './error.js';
import type {
  AddDocumentApiRequest,
  AnalyticsRange,
  ApiEnvelope,
  AutocompleteRequest,
  AutocompleteResponse,
  ClickEventApiRequest,
  CreateIndexApiRequest,
  CreateProjectApiRequest,
  DocumentRecord,
  IndexRecord,
  ProjectRecord,
  RecommendationQuery,
  RecordInteractionApiRequest,
  RequestOptions,
  SearchRequest,
  SearchResponse,
  SeekrClientOptions,
} from './types.js';

interface InternalRequest extends RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly query?: object;
}

export class SeekrClient {
  readonly indexes: IndexesClient;
  readonly documents: DocumentsClient;
  readonly recommendations: RecommendationsClient;
  readonly analytics: AnalyticsClient;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: SeekrClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retries = options.retries ?? 2;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.indexes = new IndexesClient(this);
    this.documents = new DocumentsClient(this);
    this.recommendations = new RecommendationsClient(this);
    this.analytics = new AnalyticsClient(this);
  }

  health(options?: RequestOptions): Promise<unknown> {
    return this.request('/health', options);
  }

  createProject(
    input: CreateProjectApiRequest,
    options?: RequestOptions,
  ): Promise<{ project: ProjectRecord } & ApiEnvelope> {
    return this.request('/v1/projects', { ...options, method: 'POST', body: input });
  }

  search(indexId: string, input: SearchRequest, options?: RequestOptions): Promise<SearchResponse> {
    return this.indexes.search(indexId, input, options);
  }

  autocomplete(
    indexId: string,
    input: AutocompleteRequest,
    options?: RequestOptions,
  ): Promise<AutocompleteResponse> {
    return this.indexes.autocomplete(indexId, input, options);
  }

  async request<T>(path: string, options: InternalRequest = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers = new Headers({ accept: 'application/json' });
    if (this.apiKey !== undefined) headers.set('authorization', `Bearer ${this.apiKey}`);
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    if (options.idempotencyKey !== undefined)
      headers.set('idempotency-key', options.idempotencyKey);
    const retryable =
      method === 'GET' || method === 'DELETE' || options.idempotencyKey !== undefined;

    for (let attempt = 0; ; attempt += 1) {
      const timeout = AbortSignal.timeout(this.timeoutMs);
      const signal =
        options.signal === undefined ? timeout : AbortSignal.any([timeout, options.signal]);
      try {
        const response = await this.fetcher(url, {
          method,
          headers,
          signal,
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        });
        if (response.ok) {
          if (response.status === 204) return undefined as T;
          return (await response.json()) as T;
        }
        if (
          retryable &&
          attempt < this.retries &&
          (response.status === 429 || response.status >= 500)
        ) {
          await backoff(attempt, options.signal);
          continue;
        }
        throw await toSeekrError(response);
      } catch (error) {
        if (
          error instanceof SeekrError ||
          !retryable ||
          attempt >= this.retries ||
          options.signal?.aborted === true
        )
          throw error;
        await backoff(attempt, options.signal);
      }
    }
  }
}

export class IndexesClient {
  constructor(private readonly client: SeekrClient) {}
  create(
    input: CreateIndexApiRequest,
    options?: RequestOptions,
  ): Promise<{ index: IndexRecord } & ApiEnvelope> {
    return this.client.request('/v1/indexes', { ...options, method: 'POST', body: input });
  }
  list(
    projectId?: string,
    options?: RequestOptions,
  ): Promise<{ indexes: readonly IndexRecord[] } & ApiEnvelope> {
    return this.client.request('/v1/indexes', { ...options, query: { projectId } });
  }
  get(indexId: string, options?: RequestOptions): Promise<{ index: IndexRecord } & ApiEnvelope> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}`, options);
  }
  delete(indexId: string, options?: RequestOptions): Promise<void> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}`, {
      ...options,
      method: 'DELETE',
    });
  }
  updateSchema(
    indexId: string,
    schema: CreateIndexApiRequest['schema'],
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/schema`, {
      ...options,
      method: 'PUT',
      body: { schema },
    });
  }
  reindex(indexId: string, options?: RequestOptions): Promise<unknown> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/reindex`, {
      ...options,
      method: 'POST',
    });
  }
  addDocument(
    indexId: string,
    document: AddDocumentApiRequest,
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.client.request(documentPath(indexId), {
      ...options,
      method: 'POST',
      body: document,
    });
  }
  addDocuments(
    indexId: string,
    documents: readonly AddDocumentApiRequest[],
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.client.request(`${documentPath(indexId)}/bulk`, {
      ...options,
      method: 'POST',
      body: { documents },
    });
  }
  listDocuments(
    indexId: string,
    input: { limit?: number; offset?: number } = {},
    options?: RequestOptions,
  ): Promise<{ documents: readonly DocumentRecord[]; total: number } & ApiEnvelope> {
    return this.client.request(documentPath(indexId), { ...options, query: input });
  }
  getDocument(
    indexId: string,
    documentId: string,
    options?: RequestOptions,
  ): Promise<{ document: DocumentRecord } & ApiEnvelope> {
    return this.client.request(
      `${documentPath(indexId)}/${encodeURIComponent(documentId)}`,
      options,
    );
  }
  deleteDocument(indexId: string, documentId: string, options?: RequestOptions): Promise<void> {
    return this.client.request(`${documentPath(indexId)}/${encodeURIComponent(documentId)}`, {
      ...options,
      method: 'DELETE',
    });
  }
  search(indexId: string, input: SearchRequest, options?: RequestOptions): Promise<SearchResponse> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/search`, {
      ...options,
      method: 'POST',
      body: input,
    });
  }
  autocomplete(
    indexId: string,
    input: AutocompleteRequest,
    options?: RequestOptions,
  ): Promise<AutocompleteResponse> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/autocomplete`, {
      ...options,
      method: 'POST',
      body: input,
    });
  }
}

export class DocumentsClient {
  constructor(private readonly client: SeekrClient) {}
  add(
    indexId: string,
    document: AddDocumentApiRequest,
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.client.indexes.addDocument(indexId, document, options);
  }
  bulk(
    indexId: string,
    documents: readonly AddDocumentApiRequest[],
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.client.indexes.addDocuments(indexId, documents, options);
  }
  get(indexId: string, documentId: string, options?: RequestOptions) {
    return this.client.indexes.getDocument(indexId, documentId, options);
  }
  delete(indexId: string, documentId: string, options?: RequestOptions): Promise<void> {
    return this.client.indexes.deleteDocument(indexId, documentId, options);
  }
}

export class RecommendationsClient {
  constructor(private readonly client: SeekrClient) {}
  record(input: RecordInteractionApiRequest, options?: RequestOptions): Promise<unknown> {
    return this.client.request('/v1/interactions', { ...options, method: 'POST', body: input });
  }
  forItem(itemId: string, query: RecommendationQuery, options?: RequestOptions): Promise<unknown> {
    return this.client.request(`/v1/recommend/items/${encodeURIComponent(itemId)}`, {
      ...options,
      query,
    });
  }
  forUser(userId: string, query: RecommendationQuery, options?: RequestOptions): Promise<unknown> {
    return this.client.request(`/v1/recommend/users/${encodeURIComponent(userId)}`, {
      ...options,
      query,
    });
  }
  popular(query: RecommendationQuery, options?: RequestOptions): Promise<unknown> {
    return this.client.request('/v1/recommend/popular', { ...options, query });
  }
  statistics(query: RecommendationQuery, options?: RequestOptions): Promise<unknown> {
    return this.client.request('/v1/recommend/statistics', { ...options, query });
  }
}

export class AnalyticsClient {
  constructor(private readonly client: SeekrClient) {}
  overview(
    indexId: string,
    range: AnalyticsRange = {},
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/analytics/overview`, {
      ...options,
      query: range,
    });
  }
  queries(indexId: string, range: AnalyticsRange = {}, options?: RequestOptions): Promise<unknown> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/analytics/queries`, {
      ...options,
      query: range,
    });
  }
  noResults(
    indexId: string,
    range: AnalyticsRange = {},
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/analytics/no-results`, {
      ...options,
      query: range,
    });
  }
  latency(indexId: string, range: AnalyticsRange = {}, options?: RequestOptions): Promise<unknown> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/analytics/latency`, {
      ...options,
      query: range,
    });
  }
  clicks(indexId: string, range: AnalyticsRange = {}, options?: RequestOptions): Promise<unknown> {
    return this.client.request(`/v1/indexes/${encodeURIComponent(indexId)}/analytics/clicks`, {
      ...options,
      query: range,
    });
  }
  recordClick(input: ClickEventApiRequest, options?: RequestOptions): Promise<unknown> {
    return this.client.request('/v1/events/click', { ...options, method: 'POST', body: input });
  }
}

const documentPath = (indexId: string): string =>
  `/v1/indexes/${encodeURIComponent(indexId)}/documents`;

async function toSeekrError(response: Response): Promise<SeekrError> {
  let body: {
    error?: string | { code?: string; message?: string; details?: unknown };
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    /* non-JSON proxy response */
  }
  const nested = typeof body.error === 'object' ? body.error : undefined;
  return new SeekrError(
    nested?.message ?? body.message ?? `Seekr request failed with status ${response.status}`,
    response.status,
    nested?.code ?? body.code ?? 'HTTP_ERROR',
    body.requestId ?? response.headers.get('x-request-id') ?? undefined,
    nested?.details ?? body.details,
  );
}

async function backoff(attempt: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, Math.min(100 * 2 ** attempt, 1_000));
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error('Request aborted'));
      },
      { once: true },
    );
  });
}

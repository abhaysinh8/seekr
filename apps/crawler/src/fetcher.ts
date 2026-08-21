import { lookup } from 'node:dns/promises';

import type { FetchedPage, PageFetcher } from './types.js';
import { isPrivateNetworkAddress, normalizeUrl } from './url.js';

const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface HttpPageFetcherOptions {
  readonly requestTimeoutMs?: number;
  readonly maxRetries?: number;
  readonly maxResponseBytes?: number;
  readonly maxRedirects?: number;
  readonly retryBaseDelayMs?: number;
  readonly userAgent?: string;
  readonly fetchImplementation?: typeof fetch;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly resolveHostname?: (hostname: string) => Promise<readonly string[]>;
  readonly allowPrivateNetwork?: boolean;
}

export class CrawlFetchError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'CrawlFetchError';
  }
}

export class HttpPageFetcher implements PageFetcher {
  readonly #requestTimeoutMs: number;
  readonly #maxRetries: number;
  readonly #maxResponseBytes: number;
  readonly #maxRedirects: number;
  readonly #retryBaseDelayMs: number;
  readonly #userAgent: string;
  readonly #fetch: typeof fetch;
  readonly #wait: (milliseconds: number) => Promise<void>;
  readonly #resolveHostname: ((hostname: string) => Promise<readonly string[]>) | undefined;
  readonly #allowPrivateNetwork: boolean;

  constructor(options: HttpPageFetcherOptions = {}) {
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.#maxRetries = options.maxRetries ?? 2;
    this.#maxResponseBytes = options.maxResponseBytes ?? 2 * 1024 * 1024;
    this.#maxRedirects = options.maxRedirects ?? 5;
    this.#retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
    this.#userAgent = options.userAgent ?? 'SeekrBot/0.1 (+https://github.com/seekr)';
    this.#fetch = options.fetchImplementation ?? fetch;
    this.#resolveHostname =
      options.resolveHostname ??
      (options.fetchImplementation === undefined ? resolveAll : undefined);
    this.#allowPrivateNetwork = options.allowPrivateNetwork ?? false;
    this.#wait =
      options.wait ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async fetchPage(
    url: string,
    options: { readonly isUrlAllowed: (url: string) => boolean; readonly signal?: AbortSignal },
  ): Promise<FetchedPage> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      try {
        return await this.#fetchOnce(url, options);
      } catch (error) {
        lastError = error;
        const retryable = !(error instanceof CrawlFetchError) || error.retryable;
        if (!retryable || attempt === this.#maxRetries || options.signal?.aborted === true)
          throw error;
        await this.#wait(this.#retryBaseDelayMs * 2 ** attempt);
      }
    }
    throw lastError;
  }

  async #fetchOnce(
    requestedUrl: string,
    options: { readonly isUrlAllowed: (url: string) => boolean; readonly signal?: AbortSignal },
  ): Promise<FetchedPage> {
    let currentUrl = requestedUrl;
    for (let redirects = 0; redirects <= this.#maxRedirects; redirects += 1) {
      if (!options.isUrlAllowed(currentUrl)) {
        throw new CrawlFetchError(
          'URL_NOT_ALLOWED',
          `URL is outside the crawl policy: ${currentUrl}`,
        );
      }
      await this.#assertPublicResolution(currentUrl);
      const timeout = AbortSignal.timeout(this.#requestTimeoutMs);
      const signal =
        options.signal === undefined ? timeout : AbortSignal.any([options.signal, timeout]);
      const response = await this.#fetch(currentUrl, {
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9',
          'user-agent': this.#userAgent,
        },
        redirect: 'manual',
        signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location === null)
          throw new CrawlFetchError('INVALID_REDIRECT', 'Redirect has no Location header');
        const redirectUrl = normalizeUrl(location, currentUrl);
        if (redirectUrl === undefined)
          throw new CrawlFetchError('INVALID_REDIRECT', 'Redirect target is invalid');
        if (redirects === this.#maxRedirects) {
          throw new CrawlFetchError('TOO_MANY_REDIRECTS', 'Maximum redirects exceeded');
        }
        currentUrl = redirectUrl;
        continue;
      }

      if (!response.ok) {
        throw new CrawlFetchError(
          'HTTP_ERROR',
          `HTTP ${response.status} while fetching ${currentUrl}`,
          RETRYABLE_STATUS_CODES.has(response.status),
        );
      }
      const contentType =
        response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
      if (!HTML_CONTENT_TYPES.has(contentType)) {
        throw new CrawlFetchError(
          'UNSUPPORTED_CONTENT_TYPE',
          `Unsupported content type: ${contentType || 'unknown'}`,
        );
      }
      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(declaredLength) && declaredLength > this.#maxResponseBytes) {
        throw new CrawlFetchError(
          'RESPONSE_TOO_LARGE',
          'Response exceeds the configured size limit',
        );
      }
      const body = await readLimitedBody(response, this.#maxResponseBytes);
      return {
        requestedUrl,
        finalUrl: currentUrl,
        statusCode: response.status,
        contentType,
        body,
      };
    }
    throw new CrawlFetchError('TOO_MANY_REDIRECTS', 'Maximum redirects exceeded');
  }

  async #assertPublicResolution(url: string): Promise<void> {
    if (this.#resolveHostname === undefined || this.#allowPrivateNetwork) return;
    const hostname = new URL(url).hostname.replace(/^\[|\]$/gu, '');
    const addresses = await this.#resolveHostname(hostname);
    if (addresses.length === 0 || addresses.some(isPrivateNetworkAddress))
      throw new CrawlFetchError(
        'PRIVATE_NETWORK',
        `Hostname resolves to a blocked network address: ${hostname}`,
      );
  }
}

async function resolveAll(hostname: string): Promise<readonly string[]> {
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

async function readLimitedBody(response: Response, maximumBytes: number): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    const value = result.value;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new CrawlFetchError('RESPONSE_TOO_LARGE', 'Response exceeds the configured size limit');
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

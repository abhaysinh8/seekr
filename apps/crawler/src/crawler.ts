import { createHash } from 'node:crypto';

import { extractPageContent } from './extraction.js';
import { HttpPageFetcher } from './fetcher.js';
import { discoverPageLinks } from './links.js';
import { OriginRateLimiter } from './rate-limiter.js';
import { DefaultRobotsTextLoader, RobotsTxtCache } from './robots.js';
import type {
  CrawlFailure,
  CrawlJobResult,
  CrawlProgress,
  CrawlReporter,
  CrawlRequest,
  CrawledDocument,
  PageFetcher,
  PageIndexSink,
} from './types.js';
import { isAllowedDomain, isPrivateNetworkUrl, normalizeUrl } from './url.js';

interface QueueEntry {
  readonly url: string;
  readonly depth: number;
}

export interface WebCrawlerDependencies {
  readonly fetcher?: PageFetcher;
  readonly indexSink: PageIndexSink;
  readonly reporter?: CrawlReporter;
  readonly robots?: RobotsTxtCache;
  readonly rateLimiter?: OriginRateLimiter;
  readonly now?: () => Date;
}

export class WebCrawler {
  readonly #fetcher: PageFetcher | undefined;
  readonly #indexSink: PageIndexSink;
  readonly #reporter: CrawlReporter | undefined;
  readonly #robots: RobotsTxtCache | undefined;
  readonly #rateLimiter: OriginRateLimiter;
  readonly #now: () => Date;

  constructor(dependencies: WebCrawlerDependencies) {
    this.#fetcher = dependencies.fetcher;
    this.#indexSink = dependencies.indexSink;
    this.#reporter = dependencies.reporter;
    this.#robots = dependencies.robots;
    this.#rateLimiter = dependencies.rateLimiter ?? new OriginRateLimiter();
    this.#now = dependencies.now ?? (() => new Date());
  }

  async crawl(request: CrawlRequest): Promise<CrawlJobResult> {
    const startingUrl = normalizeUrl(request.startingUrl);
    if (startingUrl === undefined)
      throw new Error('startingUrl must be an absolute HTTP or HTTPS URL');
    const configuration = validateConfiguration(request);
    const allowedDomains = new Set(
      (request.allowedDomains ?? [new URL(startingUrl).hostname]).map((domain) =>
        domain.toLowerCase(),
      ),
    );
    const isUrlAllowed = (url: string) =>
      isAllowedDomain(url, allowedDomains) &&
      (configuration.allowPrivateNetwork || !isPrivateNetworkUrl(url));
    if (!isUrlAllowed(startingUrl))
      throw new Error('startingUrl is outside the allowed crawl policy');

    const startedAt = this.#now().toISOString();
    const queue: QueueEntry[] = [{ url: startingUrl, depth: 0 }];
    const seenUrls = new Set([startingUrl]);
    const contentHashes = new Set<string>();
    const failures: CrawlFailure[] = [];
    const counters = { discovered: 1, fetched: 0, indexed: 0, skipped: 0, failed: 0 };
    let processed = 0;
    const fetcher =
      this.#fetcher ??
      new HttpPageFetcher({
        requestTimeoutMs: configuration.requestTimeoutMs,
        maxRetries: configuration.maxRetries,
        maxResponseBytes: configuration.maxResponseBytes,
        maxRedirects: configuration.maxRedirects,
        allowPrivateNetwork: configuration.allowPrivateNetwork,
      });
    const robots =
      this.#robots ??
      new RobotsTxtCache(
        new DefaultRobotsTextLoader({ allowPrivateNetwork: configuration.allowPrivateNetwork }),
      );

    await this.#report('running', counters);
    while (queue.length > 0 && processed < configuration.maxPages) {
      if (request.signal?.aborted === true) {
        return this.#finish('cancelled', counters, failures, startedAt);
      }
      const remaining = configuration.maxPages - processed;
      const batch = queue.splice(0, Math.min(configuration.concurrency, remaining));
      await Promise.all(
        batch.map(async (entry) => {
          try {
            const policy = await robots.getPolicy(entry.url, request.signal);
            if (!policy.isAllowed(entry.url)) {
              counters.skipped += 1;
              return;
            }
            const delay = Math.max(configuration.crawlDelayMs, policy.crawlDelayMs() ?? 0);
            await this.#rateLimiter.acquire(new URL(entry.url).origin, delay);
            const fetched = await fetcher.fetchPage(entry.url, {
              isUrlAllowed,
              ...(request.signal === undefined ? {} : { signal: request.signal }),
            });
            counters.fetched += 1;
            const extracted = extractPageContent(fetched.body, fetched.finalUrl);
            if (extracted.content.length === 0 || contentHashes.has(extracted.contentHash)) {
              counters.skipped += 1;
            } else {
              contentHashes.add(extracted.contentHash);
              await this.#indexSink.indexDocument(
                request.indexId,
                toCrawledDocument(request.sourceId, fetched, extracted, this.#now()),
              );
              counters.indexed += 1;
            }

            if (entry.depth < configuration.maxDepth) {
              for (const link of discoverPageLinks(fetched.body, fetched.finalUrl)) {
                if (
                  seenUrls.has(link) ||
                  !isUrlAllowed(link) ||
                  seenUrls.size >= configuration.maxPages
                )
                  continue;
                seenUrls.add(link);
                queue.push({ url: link, depth: entry.depth + 1 });
                counters.discovered += 1;
              }
            }
          } catch (error) {
            counters.failed += 1;
            failures.push({
              url: entry.url,
              message: error instanceof Error ? error.message : 'Unknown crawl failure',
            });
          } finally {
            processed += 1;
            await this.#report('running', counters);
          }
        }),
      );
    }
    return this.#finish('completed', counters, failures, startedAt);
  }

  async #finish(
    status: 'completed' | 'cancelled',
    counters: Omit<CrawlProgress, 'status'>,
    failures: readonly CrawlFailure[],
    startedAt: string,
  ): Promise<CrawlJobResult> {
    await this.#report(status, counters);
    return {
      status,
      ...counters,
      failures,
      startedAt,
      completedAt: this.#now().toISOString(),
    };
  }

  async #report(status: CrawlProgress['status'], counters: Omit<CrawlProgress, 'status'>) {
    await this.#reporter?.report({ status, ...counters });
  }
}

interface ResolvedConfiguration {
  readonly maxDepth: number;
  readonly maxPages: number;
  readonly concurrency: number;
  readonly crawlDelayMs: number;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly maxResponseBytes: number;
  readonly maxRedirects: number;
  readonly allowPrivateNetwork: boolean;
}

function validateConfiguration(request: CrawlRequest): ResolvedConfiguration {
  const configuration: ResolvedConfiguration = {
    maxDepth: request.maxDepth ?? 3,
    maxPages: request.maxPages ?? 100,
    concurrency: request.concurrency ?? 2,
    crawlDelayMs: request.crawlDelayMs ?? 500,
    requestTimeoutMs: request.requestTimeoutMs ?? 10_000,
    maxRetries: request.maxRetries ?? 2,
    maxResponseBytes: request.maxResponseBytes ?? 2 * 1024 * 1024,
    maxRedirects: request.maxRedirects ?? 5,
    allowPrivateNetwork: request.allowPrivateNetwork ?? false,
  };
  if (
    !Number.isInteger(configuration.maxDepth) ||
    configuration.maxDepth < 0 ||
    configuration.maxDepth > 20
  )
    throw new Error('maxDepth must be an integer from 0 through 20');
  if (
    !Number.isInteger(configuration.maxPages) ||
    configuration.maxPages < 1 ||
    configuration.maxPages > 10_000
  )
    throw new Error('maxPages must be an integer from 1 through 10000');
  if (
    !Number.isInteger(configuration.concurrency) ||
    configuration.concurrency < 1 ||
    configuration.concurrency > 20
  )
    throw new Error('concurrency must be an integer from 1 through 20');
  if (configuration.crawlDelayMs < 0 || configuration.crawlDelayMs > 60_000)
    throw new Error('crawlDelayMs must be from 0 through 60000');
  return configuration;
}

function toCrawledDocument(
  sourceId: string,
  fetched: { finalUrl: string; statusCode: number; contentType: string },
  extracted: ReturnType<typeof extractPageContent>,
  crawledAt: Date,
): CrawledDocument {
  const id = createHash('sha256').update(extracted.canonicalUrl).digest('hex');
  return {
    id,
    fields: {
      title: extracted.title,
      description: extracted.metaDescription ?? '',
      headings: [extracted.mainHeading, ...extracted.sectionHeadings].filter(Boolean).join('\n'),
      content: extracted.content,
    },
    metadata: {
      sourceId,
      sourceUrl: fetched.finalUrl,
      canonicalUrl: extracted.canonicalUrl,
      contentHash: extracted.contentHash,
      crawledAt: crawledAt.toISOString(),
      statusCode: fetched.statusCode,
      contentType: fetched.contentType,
      ...(extracted.language === undefined ? {} : { language: extracted.language }),
    },
  };
}

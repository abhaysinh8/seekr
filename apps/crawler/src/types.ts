export type CrawlJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CrawlConfiguration {
  readonly allowedDomains?: readonly string[];
  readonly maxDepth?: number;
  readonly maxPages?: number;
  readonly concurrency?: number;
  readonly crawlDelayMs?: number;
  readonly requestTimeoutMs?: number;
  readonly maxRetries?: number;
  readonly maxResponseBytes?: number;
  readonly maxRedirects?: number;
  readonly allowPrivateNetwork?: boolean;
}

export interface CrawlRequest extends CrawlConfiguration {
  readonly sourceId: string;
  readonly indexId: string;
  readonly startingUrl: string;
  readonly signal?: AbortSignal;
}

export interface CrawlProgress {
  readonly status: CrawlJobStatus;
  readonly discovered: number;
  readonly fetched: number;
  readonly indexed: number;
  readonly skipped: number;
  readonly failed: number;
}

export interface CrawlFailure {
  readonly url: string;
  readonly message: string;
}

export interface CrawlJobResult extends CrawlProgress {
  readonly failures: readonly CrawlFailure[];
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface ExtractedPage {
  readonly title: string;
  readonly metaDescription?: string;
  readonly mainHeading?: string;
  readonly sectionHeadings: readonly string[];
  readonly content: string;
  readonly canonicalUrl: string;
  readonly language?: string;
  readonly structuredData: readonly unknown[];
  readonly contentHash: string;
}

export interface FetchedPage {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly statusCode: number;
  readonly contentType: string;
  readonly body: string;
}

export interface PageFetcher {
  fetchPage(
    url: string,
    options: {
      readonly isUrlAllowed: (url: string) => boolean;
      readonly signal?: AbortSignal;
    },
  ): Promise<FetchedPage>;
}

export interface CrawledDocument {
  readonly id: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PageIndexSink {
  indexDocument(indexId: string, document: CrawledDocument): Promise<void>;
}

export interface CrawlReporter {
  report(progress: CrawlProgress): Promise<void> | void;
}

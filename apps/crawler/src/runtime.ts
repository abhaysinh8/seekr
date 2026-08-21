import pino from 'pino';
import postgres from 'postgres';

import { loadCrawlerEnvironment } from '@seekr/config';
import { WebCrawler } from './crawler.js';
import type { CrawlConfiguration, CrawlProgress, CrawledDocument } from './types.js';

interface ClaimedJob {
  readonly id: string;
  readonly sourceId: string;
}
interface SourceRow {
  readonly id: string;
  readonly indexId: string;
  readonly startingUrl: string;
  readonly configuration: CrawlConfiguration;
}

const environment = loadCrawlerEnvironment();
const logger = pino(
  environment.NODE_ENV === 'development'
    ? {
        level: environment.LOG_LEVEL,
        transport: {
          options: { colorize: true, ignore: 'pid,hostname' },
          target: 'pino-pretty',
        },
      }
    : { level: environment.LOG_LEVEL },
);
const sql = postgres(environment.DATABASE_URL, { max: 4 });
let stopping = false;
let currentAbort: AbortController | undefined;
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

logger.info({ service: 'seekr-crawler' }, 'Crawler job worker started');
if (environment.SEEKR_API_KEY === undefined)
  logger.warn(
    'SEEKR_API_KEY is not configured; queued crawl jobs will fail until a documents:write key is provided',
  );

while (!stopping) {
  try {
    const job = await claimNextJob();
    if (job === undefined) await wait(environment.SEEKR_CRAWL_POLL_MS);
    else await execute(job);
  } catch (error) {
    logger.error({ err: error }, 'Crawler worker iteration failed');
    await wait(environment.SEEKR_CRAWL_POLL_MS);
  }
}

async function claimNextJob(): Promise<ClaimedJob | undefined> {
  const rows = await sql<ClaimedJob[]>`
    with candidate as (
      select id from crawl_jobs where status = 'queued'
      order by created_at for update skip locked limit 1
    )
    update crawl_jobs as job set status = 'running', started_at = now(), error_message = null
    from candidate where job.id = candidate.id
    returning job.id, job.source_id
  `;
  return rows[0];
}

async function execute(job: ClaimedJob): Promise<void> {
  const sources = await sql<SourceRow[]>`
    select id, index_id, start_url as starting_url, configuration
    from crawl_sources where id = ${job.sourceId} limit 1
  `;
  const source = sources[0];
  if (source === undefined) {
    await markFailed(job.id, 'Crawl source no longer exists');
    return;
  }
  if (environment.SEEKR_API_KEY === undefined) {
    await markFailed(job.id, 'Crawler worker requires SEEKR_API_KEY with documents:write scope');
    return;
  }
  currentAbort = new AbortController();
  const crawler = new WebCrawler({
    indexSink: {
      indexDocument: (indexId, document) => indexDocument(indexId, document),
    },
    reporter: { report: (progress) => report(job.id, progress) },
  });
  try {
    const result = await crawler.crawl({
      sourceId: source.id,
      indexId: source.indexId,
      startingUrl: source.startingUrl,
      ...source.configuration,
      signal: currentAbort.signal,
    });
    logger.info(
      {
        jobId: job.id,
        discovered: result.discovered,
        fetched: result.fetched,
        indexed: result.indexed,
        skipped: result.skipped,
        failed: result.failed,
      },
      'Crawl job completed',
    );
  } catch (error) {
    await markFailed(job.id, error instanceof Error ? error.message : 'Unknown crawl error');
    logger.error({ err: error, jobId: job.id }, 'Crawl job failed');
  } finally {
    currentAbort = undefined;
  }
}

async function indexDocument(indexId: string, document: CrawledDocument): Promise<void> {
  const response = await fetch(
    `${environment.SEEKR_API_URL.replace(/\/+$/u, '')}/v1/indexes/${encodeURIComponent(indexId)}/documents`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${environment.SEEKR_API_KEY as string}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(document),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    const body = (await response.text()).slice(0, 1_000);
    throw new Error(`Seekr ingestion returned HTTP ${response.status}: ${body}`);
  }
}

async function report(jobId: string, progress: CrawlProgress): Promise<void> {
  await sql`
    update crawl_jobs set status = ${progress.status}, discovered = ${progress.discovered},
      fetched = ${progress.fetched}, indexed = ${progress.indexed}, skipped = ${progress.skipped},
      failed = ${progress.failed},
      completed_at = case when ${progress.status} in ('completed', 'failed', 'cancelled') then now() else completed_at end
    where id = ${jobId}
  `;
}

async function markFailed(jobId: string, message: string): Promise<void> {
  await sql`
    update crawl_jobs set status = 'failed', error_message = ${message.slice(0, 4_000)},
      completed_at = now() where id = ${jobId}
  `;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  currentAbort?.abort(new Error(`Crawler shutting down after ${signal}`));
  logger.info({ signal }, 'Shutting down crawler worker');
  await sql.end({ timeout: 5 });
}

import { createServer, type Server } from 'node:http';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebCrawler } from './crawler.js';
import type { CrawledDocument } from './types.js';

describe('web crawler with a local fixture website', () => {
  let server: Server;
  let origin: string;
  const requests: string[] = [];

  beforeEach(async () => {
    requests.length = 0;
    server = createServer((request, response) => {
      const path = request.url ?? '/';
      requests.push(path);
      if (path === '/robots.txt') {
        response.setHeader('content-type', 'text/plain');
        response.end('User-agent: SeekrBot\nDisallow: /private\nCrawl-delay: 0');
        return;
      }
      if (path === '/') {
        response.setHeader('content-type', 'text/html');
        response.end(`
          <html><head><title>Home</title></head><body><main><p>Search infrastructure home.</p></main>
          <a href="/about#team">About</a><a href="/about">Duplicate link</a>
          <a href="/private">Private</a><a href="/copy">Copy</a><a href="/manual.pdf">PDF</a>
          <a href="https://outside.test/page">Outside</a></body></html>`);
        return;
      }
      if (path === '/about' || path === '/copy') {
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(
          `<html><head><title>${path}</title><link rel="canonical" href="${path}"></head>` +
            '<body><main><p>Seekr is built for developers.</p></main></body></html>',
        );
        return;
      }
      if (path === '/manual.pdf') {
        response.setHeader('content-type', 'application/pdf');
        response.end('%PDF fixture');
        return;
      }
      response.statusCode = 404;
      response.setHeader('content-type', 'text/html');
      response.end('<h1>Not found</h1>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string')
      throw new Error('Fixture server did not bind');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
  });

  it('obeys boundaries, robots, deduplication, extraction, and indexing', async () => {
    const indexed: Array<{ indexId: string; document: CrawledDocument }> = [];
    const report = vi.fn();
    const crawler = new WebCrawler({
      indexSink: {
        indexDocument: (indexId, document) => {
          indexed.push({ indexId, document });
          return Promise.resolve();
        },
      },
      reporter: { report },
    });

    const result = await crawler.crawl({
      sourceId: 'source-one',
      indexId: 'index-one',
      startingUrl: `${origin}/#top`,
      allowedDomains: ['127.0.0.1'],
      allowPrivateNetwork: true,
      maxDepth: 1,
      maxPages: 5,
      concurrency: 2,
      crawlDelayMs: 0,
      maxRetries: 0,
    });

    expect(result).toMatchObject({
      status: 'completed',
      discovered: 5,
      fetched: 3,
      indexed: 2,
      skipped: 2,
      failed: 1,
    });
    expect(requests.filter((path) => path === '/about')).toHaveLength(1);
    expect(requests).not.toContain('/private');
    expect(requests.every((path) => !path.includes('outside.test'))).toBe(true);
    expect(indexed).toHaveLength(2);
    expect(indexed[0]).toMatchObject({
      indexId: 'index-one',
      document: {
        fields: { title: 'Home', content: 'Search infrastructure home.' },
        metadata: {
          sourceId: 'source-one',
          sourceUrl: `${origin}/`,
          statusCode: 200,
          contentType: 'text/html',
        },
      },
    });
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('rejects private network crawling unless explicitly enabled', async () => {
    const crawler = new WebCrawler({
      indexSink: { indexDocument: vi.fn() },
    });
    await expect(
      crawler.crawl({ sourceId: 'source', indexId: 'index', startingUrl: origin }),
    ).rejects.toThrow('outside the allowed crawl policy');
  });
});

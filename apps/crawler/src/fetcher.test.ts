import { describe, expect, it, vi } from 'vitest';

import { CrawlFetchError, HttpPageFetcher } from './fetcher.js';

describe('HTTP page fetcher', () => {
  it('follows an allowed redirect and preserves the requested URL', async () => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/final' } }))
      .mockResolvedValueOnce(
        new Response('<main>Done</main>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      );
    const fetcher = new HttpPageFetcher({ fetchImplementation: implementation, maxRetries: 0 });
    await expect(
      fetcher.fetchPage('https://example.com/start', { isUrlAllowed: () => true }),
    ).resolves.toMatchObject({
      requestedUrl: 'https://example.com/start',
      finalUrl: 'https://example.com/final',
      body: '<main>Done</main>',
    });
  });

  it('rejects redirects outside the crawl policy', async () => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://evil.test' } }),
      );
    const fetcher = new HttpPageFetcher({ fetchImplementation: implementation, maxRetries: 0 });
    await expect(
      fetcher.fetchPage('https://example.com/start', {
        isUrlAllowed: (url) => new URL(url).hostname === 'example.com',
      }),
    ).rejects.toMatchObject({ code: 'URL_NOT_ALLOWED' });
  });

  it('rejects binary and oversized responses', async () => {
    const binary = new HttpPageFetcher({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('binary', { headers: { 'content-type': 'image/png' } })),
      maxRetries: 0,
    });
    await expect(
      binary.fetchPage('https://example.com/image', { isUrlAllowed: () => true }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT_TYPE' });

    const oversized = new HttpPageFetcher({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response('too large', {
          headers: { 'content-type': 'text/html', 'content-length': '9' },
        }),
      ),
      maxResponseBytes: 4,
      maxRetries: 0,
    });
    await expect(
      oversized.fetchPage('https://example.com/large', { isUrlAllowed: () => true }),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it('retries transient failures with exponential backoff', async () => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/html' } }),
      );
    const wait = vi.fn().mockResolvedValue(undefined);
    const fetcher = new HttpPageFetcher({
      fetchImplementation: implementation,
      maxRetries: 2,
      retryBaseDelayMs: 100,
      wait,
    });
    await expect(
      fetcher.fetchPage('https://example.com', { isUrlAllowed: () => true }),
    ).resolves.toMatchObject({ body: 'ok' });
    expect(wait).toHaveBeenCalledWith(100);
  });

  it('does not retry permanent HTTP failures', async () => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('no', { status: 404 }));
    const fetcher = new HttpPageFetcher({ fetchImplementation: implementation, maxRetries: 2 });
    await expect(
      fetcher.fetchPage('https://example.com/missing', { isUrlAllowed: () => true }),
    ).rejects.toBeInstanceOf(CrawlFetchError);
    expect(implementation).toHaveBeenCalledOnce();
  });
});

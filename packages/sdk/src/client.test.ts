import { describe, expect, it, vi } from 'vitest';
import { SeekrClient } from './index.js';
import type { SeekrError } from './index.js';

describe('SeekrClient', () => {
  it('sends authentication and typed search input', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ hits: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new SeekrClient({
      baseUrl: 'http://seekr.test/',
      apiKey: 'skr_test',
      fetch: fetcher,
    });
    await client.indexes.search('index id', {
      query: 'machine',
      limit: 10,
      offset: 0,
      filters: [],
      facets: [],
      ranking: 'bm25',
      typoTolerance: false,
      spellCorrection: false,
      highlight: false,
      explain: false,
      proximityBoost: false,
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url instanceof URL ? url.href : typeof url === 'string' ? url : url?.url).toBe(
      'http://seekr.test/v1/indexes/index%20id/search',
    );
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer skr_test');
    expect(init?.method).toBe('POST');
  });

  it('returns structured API errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'missing' }, requestId: 'req-1' }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
      );
    const client = new SeekrClient({ baseUrl: 'http://seekr.test', fetch: fetcher, retries: 0 });
    await expect(client.indexes.get('missing')).rejects.toEqual(
      expect.objectContaining<Partial<SeekrError>>({
        code: 'NOT_FOUND',
        status: 404,
        requestId: 'req-1',
      }),
    );
  });

  it('retries safe reads but not unkeyed writes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ indexes: [] }), { status: 200 }));
    const client = new SeekrClient({ baseUrl: 'http://seekr.test', fetch: fetcher, retries: 1 });
    await client.indexes.list();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

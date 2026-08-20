import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { HealthDependency } from '../services/health-dependency.js';
import { InMemoryIndexService } from '../services/index-service.js';

const indexId = 'dbf0813d-616d-4a37-88cb-a5a87fb60349';
const healthyDependency = (): HealthDependency => ({ close: vi.fn(), ping: vi.fn() });

async function fixture() {
  const indexes = new InMemoryIndexService();
  indexes.createIndex(indexId, {
    fields: { title: { searchable: true }, category: { filterable: true } },
  });
  indexes.addDocuments(indexId, [
    { id: 'doc-1', fields: { title: 'Machine learning' }, metadata: { category: 'education' } },
    { id: 'doc-2', fields: { title: 'Machine tools' }, metadata: { category: 'industry' } },
  ]);
  return buildApp({
    dependencies: { cache: healthyDependency(), database: healthyDependency(), indexes },
    environment: { CORS_ORIGIN: 'http://localhost:3000' },
  });
}

describe('search analytics and click tracking', () => {
  it('records searches, percentiles, query groups, zero results, and click metrics', async () => {
    const app = await fixture();
    const first = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      payload: { query: 'MACHINE', sessionId: 'anonymous-session' },
    });
    const firstBody = first.json<{ searchId: string; hits: Array<{ documentId: string }> }>();
    expect(firstBody.searchId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(firstBody.hits).toHaveLength(2);
    await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      payload: { query: 'machine' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      payload: { query: 'not-in-index' },
    });

    const click = await app.inject({
      method: 'POST',
      url: '/v1/events/click',
      payload: {
        searchId: firstBody.searchId,
        documentId: firstBody.hits[0]?.documentId,
        position: 1,
      },
    });
    expect(click.statusCode).toBe(202);

    const overview = await app.inject({
      method: 'GET',
      url: `/v1/indexes/${indexId}/analytics/overview`,
    });
    expect(overview.json()).toMatchObject({
      totalSearches: 3,
      uniqueQueries: 2,
      zeroResultSearches: 1,
    });
    expect(overview.json<{ latency: { p50: number; p95: number; p99: number } }>().latency).toEqual(
      expect.objectContaining({
        p50: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
      }),
    );

    const queries = await app.inject({
      method: 'GET',
      url: `/v1/indexes/${indexId}/analytics/queries`,
    });
    expect(queries.json<{ queries: unknown[] }>().queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedQuery: 'machine', searchCount: 2, clicks: 1 }),
      ]),
    );
    const noResults = await app.inject({
      method: 'GET',
      url: `/v1/indexes/${indexId}/analytics/no-results`,
    });
    expect(noResults.json()).toMatchObject({
      queries: [{ normalizedQuery: 'not index', zeroResultRate: 1 }],
    });
    const clicks = await app.inject({
      method: 'GET',
      url: `/v1/indexes/${indexId}/analytics/clicks`,
    });
    expect(clicks.json()).toMatchObject({
      impressions: 4,
      clicks: 1,
      ctr: 0.25,
      averageClickedPosition: 1,
      mostClickedDocuments: [{ clicks: 1 }],
    });
  });

  it('rejects click reports that were not present at the claimed position', async () => {
    const app = await fixture();
    const search = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      payload: { query: 'machine' },
    });
    const { searchId } = search.json<{ searchId: string }>();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/events/click',
      payload: { searchId, documentId: 'doc-2', position: 1 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_CLICK' });
  });

  it('validates date ranges', async () => {
    const app = await fixture();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/indexes/${indexId}/analytics/overview?start=2026-02-01T00:00:00.000Z&end=2026-01-01T00:00:00.000Z`,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_DATE_RANGE' });
  });
});

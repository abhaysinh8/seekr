import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { HealthDependency } from '../services/health-dependency.js';
import { InMemoryIndexService } from '../services/index-service.js';

const indexId = 'bcb3bc57-3cf8-4fb5-b3ed-7c646bfd23b7';

const healthyDependency = (): HealthDependency => ({
  close: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue(undefined),
});

const createFixture = async () => {
  const indexes = new InMemoryIndexService();
  indexes.createIndex(indexId, {
    fields: {
      title: { searchable: true, weight: 3 },
      description: { searchable: true, weight: 1 },
      brand: { filterable: true, facetable: true },
      price: { filterable: true, sortable: true },
    },
  });
  indexes.addDocuments(indexId, [
    {
      id: 'sony-headphones',
      fields: {
        title: 'Wireless Headphones',
        description: 'Comfortable wireless audio',
      },
      metadata: { brand: 'Sony', price: 199 },
    },
    {
      id: 'bose-headphones',
      fields: {
        title: 'Noise Cancelling Headphones',
        description: 'Wireless travel headphones',
      },
      metadata: { brand: 'Bose', price: 299 },
    },
  ]);
  const app = await buildApp({
    dependencies: {
      cache: healthyDependency(),
      database: healthyDependency(),
      indexes,
    },
    environment: { CORS_ORIGIN: 'http://localhost:3000' },
  });
  return { app, indexes };
};

describe('search REST API', () => {
  it('exposes ranking, filters, facets, fields, highlights, and explain mode', async () => {
    const { app } = await createFixture();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      headers: { 'x-request-id': 'request-search-1' },
      payload: {
        query: 'wireless headphones',
        fields: ['title', 'description'],
        filters: [{ field: 'price', operator: 'lessThan', value: 250 }],
        facets: ['brand'],
        typoTolerance: true,
        highlight: true,
        explain: true,
        limit: 20,
        offset: 0,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('request-search-1');
    expect(response.json()).toMatchObject({
      query: 'wireless headphones',
      total: 1,
      limit: 20,
      offset: 0,
      requestId: 'request-search-1',
      facets: { brand: { Sony: 1 } },
      hits: [
        {
          documentId: 'sony-headphones',
          document: { fields: { title: 'Wireless Headphones' } },
          highlights: { title: '<mark>Wireless Headphones</mark>' },
          explanation: { finalScore: expect.any(Number) },
        },
      ],
      processingTimeMs: expect.any(Number),
    });
    await app.close();
  });

  it('supports TF-IDF and phrase queries without route-level ranking logic', async () => {
    const { app } = await createFixture();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      payload: { query: '"wireless headphones"', ranking: 'tfidf' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ hits: Array<{ documentId: string }> }>();
    expect(body.hits.map((hit) => hit.documentId)).toEqual(['sony-headphones']);
    await app.close();
  });

  it('exposes document-frequency-ranked autocomplete', async () => {
    const { app } = await createFixture();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/autocomplete`,
      payload: { prefix: 'wire', limit: 5 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ prefix: 'wire', suggestions: ['wireless'] });
    await app.close();
  });

  it('returns structured validation and not-found errors', async () => {
    const { app } = await createFixture();
    const validation = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      payload: { query: 'search', limit: 101 },
    });
    expect(validation.statusCode).toBe(400);
    expect(validation.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      requestId: expect.any(String),
    });

    const missing = await app.inject({
      method: 'POST',
      url: '/v1/indexes/1a1c777d-3df7-405d-a5f8-8d1defc65db3/search',
      payload: { query: 'search' },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'INDEX_NOT_FOUND' });
    await app.close();
  });

  it('enforces the API body-size limit', async () => {
    const { app } = await createFixture();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ query: 'x'.repeat(1024 * 1024) }),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ statusCode: 413, requestId: expect.any(String) });
    await app.close();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { HealthDependency } from '../services/health-dependency.js';

const healthyDependency = (): HealthDependency => ({
  close: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue(undefined),
});

const createApp = () =>
  buildApp({
    dependencies: { cache: healthyDependency(), database: healthyDependency() },
    environment: { CORS_ORIGIN: 'http://localhost:3000' },
  });

describe('index and document management API', () => {
  it('manages a real index lifecycle and immediately exposes documents to search', async () => {
    const app = await createApp();
    const projectResponse = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: { name: 'Docs', slug: 'docs', ownerEmail: 'owner@example.com' },
    });
    const projectId = projectResponse.json<{ project: { id: string } }>().project.id;

    const indexResponse = await app.inject({
      method: 'POST',
      url: '/v1/indexes',
      payload: {
        projectId,
        name: 'Documentation',
        schema: {
          fields: {
            title: { type: 'text', searchable: true, weight: 3 },
            content: { type: 'text', searchable: true },
            price: { type: 'number', filterable: true, sortable: true },
          },
        },
      },
    });
    expect(indexResponse.statusCode).toBe(201);
    const indexId = indexResponse.json<{ index: { id: string } }>().index.id;

    const bulk = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/documents/bulk`,
      payload: {
        documents: [
          {
            id: 'guide-1',
            fields: { title: 'Machine Learning', content: 'Search guide', price: 10 },
          },
          {
            id: 'guide-2',
            fields: { title: 'Database Systems', content: 'Storage guide', price: 20 },
          },
        ],
      },
    });
    expect(bulk.statusCode).toBe(201);
    expect(bulk.json()).toMatchObject({ indexed: 2 });

    const search = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      payload: { query: 'machine', highlight: true },
    });
    expect(search.json()).toMatchObject({
      total: 1,
      hits: [{ documentId: 'guide-1', document: { fields: { title: 'Machine Learning' } } }],
    });

    const listing = await app.inject({ method: 'GET', url: `/v1/indexes?projectId=${projectId}` });
    expect(listing.json()).toMatchObject({
      indexes: [{ id: indexId, documentCount: 2, status: 'ready' }],
    });
    expect(
      listing.json<{ indexes: Array<{ termCount: number }> }>().indexes[0]?.termCount,
    ).toBeGreaterThan(0);

    const documents = await app.inject({
      method: 'GET',
      url: `/v1/indexes/${indexId}/documents?limit=1&offset=1`,
    });
    expect(documents.json()).toMatchObject({
      total: 2,
      limit: 1,
      offset: 1,
      documents: [{ id: 'guide-2' }],
    });

    const schemaUpdate = await app.inject({
      method: 'PUT',
      url: `/v1/indexes/${indexId}/schema`,
      payload: {
        schema: {
          fields: {
            title: { type: 'text', searchable: true, weight: 5 },
            content: { type: 'text', searchable: true },
            price: { type: 'number', filterable: true, sortable: true },
          },
        },
      },
    });
    expect(schemaUpdate.json()).toMatchObject({ reindexRequired: true, reindexedDocuments: 2 });

    expect(
      (await app.inject({ method: 'DELETE', url: `/v1/indexes/${indexId}/documents/guide-1` }))
        .statusCode,
    ).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `/v1/indexes/${indexId}` })).statusCode).toBe(
      204,
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/indexes/${indexId}/search`,
          payload: { query: 'database' },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('validates schema constraints and document field types', async () => {
    const app = await createApp();
    const project = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: { name: 'Test', slug: 'test', ownerEmail: 'test@example.com' },
    });
    const projectId = project.json<{ project: { id: string } }>().project.id;
    const invalidSchema = await app.inject({
      method: 'POST',
      url: '/v1/indexes',
      payload: {
        projectId,
        name: 'Invalid',
        schema: { fields: { price: { type: 'number', searchable: true } } },
      },
    });
    expect(invalidSchema.statusCode).toBe(400);

    const valid = await app.inject({
      method: 'POST',
      url: '/v1/indexes',
      payload: { projectId, name: 'Valid', schema: { fields: { price: { type: 'number' } } } },
    });
    const indexId = valid.json<{ index: { id: string } }>().index.id;
    const invalidDocument = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/documents`,
      payload: { id: 'wrong', fields: { price: 'free' } },
    });
    expect(invalidDocument.statusCode).toBe(400);
    expect(invalidDocument.json()).toMatchObject({ code: 'FIELD_TYPE_MISMATCH' });
  });
});

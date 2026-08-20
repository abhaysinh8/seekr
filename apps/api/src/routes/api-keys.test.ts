import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import { InMemoryApiKeyRepository } from '../services/api-key-repository.js';
import { ApiKeyService } from '../services/api-key-service.js';
import type { HealthDependency } from '../services/health-dependency.js';
import { InMemoryIndexService } from '../services/index-service.js';

const projectId = '2e883bed-e0b6-4a2c-b008-8278b8c9fe3d';
const indexId = '691f076c-c049-45f4-9777-0fc0114f906f';
const healthyDependency = (): HealthDependency => ({ close: vi.fn(), ping: vi.fn() });

async function fixture() {
  const repository = new InMemoryApiKeyRepository();
  const apiKeys = new ApiKeyService(repository);
  const indexes = new InMemoryIndexService();
  indexes.createIndex(indexId, { fields: { title: { searchable: true } } });
  indexes.addDocument(indexId, { id: 'doc-1', fields: { title: 'Search systems' } });
  const app = await buildApp({
    dependencies: { apiKeys, cache: healthyDependency(), database: healthyDependency(), indexes },
    environment: { CORS_ORIGIN: 'http://localhost:3000' },
  });
  return { app, apiKeys, repository };
}

describe('API key authentication and authorization', () => {
  it('reveals a bootstrap key once, authenticates it, and never lists its secret', async () => {
    const { app } = await fixture();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      payload: { projectId, name: 'Search client', scopes: ['search', 'indexes:read'] },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json<{ rawKey: string; key: { id: string; prefix: string } }>();
    expect(body.rawKey).toMatch(/^skr_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/u);
    expect(JSON.stringify(body.key)).not.toContain(body.rawKey);

    const search = await app.inject({
      method: 'POST',
      url: `/v1/indexes/${indexId}/search`,
      headers: { authorization: `Bearer ${body.rawKey}` },
      payload: { query: 'search' },
    });
    expect(search.statusCode).toBe(200);

    const listed = await app.inject({
      method: 'GET',
      url: `/v1/api-keys?projectId=${projectId}`,
      headers: { authorization: `Bearer ${body.rawKey}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain(body.rawKey);
    expect(listed.body).not.toContain('hashedSecret');
  });

  it('rejects missing, invalid, insufficient-scope, and revoked keys', async () => {
    const { app } = await fixture();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      payload: { projectId, name: 'Search only', scopes: ['search'] },
    });
    const { rawKey, key } = created.json<{ rawKey: string; key: { id: string } }>();

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/indexes/${indexId}/search`,
          payload: { query: 'search' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/indexes/${indexId}/search`,
          headers: { authorization: 'Bearer invalid' },
          payload: { query: 'search' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/v1/indexes/${indexId}/documents`,
          headers: { authorization: `Bearer ${rawKey}` },
        })
      ).statusCode,
    ).toBe(403);

    await app.inject({
      method: 'DELETE',
      url: `/v1/api-keys/${key.id}`,
      headers: { authorization: `Bearer ${rawKey}` },
    });
    // A search-only key cannot revoke itself because revocation requires indexes:write.
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/indexes/${indexId}/search`,
          headers: { authorization: `Bearer ${rawKey}` },
          payload: { query: 'search' },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('requires authentication after project bootstrap and supports authorized revocation', async () => {
    const { app } = await fixture();
    const owner = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      payload: { projectId, name: 'Owner', scopes: ['indexes:write', 'indexes:read'] },
    });
    const ownerBody = owner.json<{ rawKey: string }>();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/api-keys',
          payload: { projectId, name: 'No auth', scopes: ['search'] },
        })
      ).statusCode,
    ).toBe(401);
    const child = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: { authorization: `Bearer ${ownerBody.rawKey}` },
      payload: { projectId, name: 'Child', scopes: ['search'] },
    });
    const childBody = child.json<{ key: { id: string }; rawKey: string }>();
    expect(child.statusCode).toBe(201);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/v1/api-keys/${childBody.key.id}`,
          headers: { authorization: `Bearer ${ownerBody.rawKey}` },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/indexes/${indexId}/search`,
          headers: { authorization: `Bearer ${childBody.rawKey}` },
          payload: { query: 'search' },
        })
      ).statusCode,
    ).toBe(401);
  });
});

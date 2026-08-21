import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { InMemoryApiKeyRepository } from '../services/api-key-repository.js';
import { ApiKeyService } from '../services/api-key-service.js';
import { InMemoryCatalogStore } from '../services/catalog-store.js';
import { InMemoryCrawlRepository } from '../services/crawl-repository.js';
import type { HealthDependency } from '../services/health-dependency.js';
import { IndexManagementService } from '../services/index-management.js';
import { InMemoryIndexService } from '../services/index-service.js';

const healthy = (): HealthDependency => ({ close: async () => {}, ping: async () => {} });
const schema = {
  fields: {
    title: {
      type: 'text' as const,
      searchable: true,
      filterable: false,
      facetable: false,
      sortable: false,
      weight: 1,
    },
  },
  synonyms: [],
  synonymPenalty: 0.7,
  rankingRules: [],
};

describe('project resource authorization', () => {
  it('prevents a scoped key from crossing project boundaries', async () => {
    const store = new InMemoryCatalogStore();
    const engine = new InMemoryIndexService();
    const management = new IndexManagementService(store, engine);
    const [one, two] = await Promise.all([
      management.createProject({ name: 'One', slug: 'one', ownerEmail: 'one@example.com' }),
      management.createProject({ name: 'Two', slug: 'two', ownerEmail: 'two@example.com' }),
    ]);
    const [indexOne, indexTwo] = await Promise.all([
      management.createIndex({ projectId: one.id, name: 'One', schema }),
      management.createIndex({ projectId: two.id, name: 'Two', schema }),
    ]);
    const apiKeys = new ApiKeyService(new InMemoryApiKeyRepository());
    const { rawKey } = await apiKeys.create({
      projectId: one.id,
      name: 'Project one',
      scopes: ['search', 'indexes:read', 'documents:read'],
    });
    const crawls = new InMemoryCrawlRepository();
    const otherSource = await crawls.createSource({
      projectId: two.id,
      indexId: indexTwo.id,
      name: 'Other',
      startingUrl: 'https://example.com',
      configuration: {
        maxDepth: 1,
        maxPages: 10,
        concurrency: 1,
        crawlDelayMs: 100,
        requestTimeoutMs: 1000,
        maxRetries: 0,
        maxResponseBytes: 10_000,
        maxRedirects: 1,
      },
    });
    const app = await buildApp({
      dependencies: {
        apiKeys,
        cache: healthy(),
        crawls,
        database: healthy(),
        indexManagement: management,
        indexes: engine,
      },
      environment: { CORS_ORIGIN: 'http://localhost:3000' },
    });
    const headers = { authorization: `Bearer ${rawKey}` };
    const ownList = await app.inject({ method: 'GET', url: '/v1/indexes', headers });
    expect(ownList.json<{ indexes: Array<{ id: string }> }>().indexes.map(({ id }) => id)).toEqual([
      indexOne.id,
    ]);
    expect(
      (await app.inject({ method: 'GET', url: `/v1/indexes/${indexTwo.id}`, headers })).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/indexes/${indexTwo.id}/search`,
          headers,
          payload: { query: 'test' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'GET', url: `/v1/sources/${otherSource.id}`, headers }))
        .statusCode,
    ).toBe(403);
    await app.close();
  });
});

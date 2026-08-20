import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { HealthDependency } from '../services/health-dependency.js';

const healthyDependency = (): HealthDependency => ({ close: vi.fn(), ping: vi.fn() });

async function fixture() {
  const app = await buildApp({
    dependencies: { cache: healthyDependency(), database: healthyDependency() },
    environment: { CORS_ORIGIN: 'http://localhost:3000' },
  });
  const project = await app.inject({
    method: 'POST',
    url: '/v1/projects',
    payload: { name: 'Recommendations', slug: 'recommendations', ownerEmail: 'rec@example.com' },
  });
  const projectId = project.json<{ project: { id: string } }>().project.id;
  const index = await app.inject({
    method: 'POST',
    url: '/v1/indexes',
    payload: {
      projectId,
      name: 'Articles',
      schema: {
        fields: {
          title: { type: 'text', searchable: true },
          content: { type: 'text', searchable: true },
        },
      },
    },
  });
  const indexId = index.json<{ index: { id: string } }>().index.id;
  await app.inject({
    method: 'POST',
    url: `/v1/indexes/${indexId}/documents/bulk`,
    payload: {
      documents: [
        {
          id: 'search-a',
          fields: { title: 'Search ranking', content: 'inverted index relevance' },
        },
        {
          id: 'search-b',
          fields: { title: 'Search engine', content: 'ranking relevance scoring' },
        },
        { id: 'cooking', fields: { title: 'Pasta recipe', content: 'tomato kitchen cooking' } },
      ],
    },
  });
  return { app, indexId };
}

describe('recommendation REST API', () => {
  it('serves content, collaborative, hybrid, popularity, and statistics from real documents', async () => {
    const { app, indexId } = await fixture();
    const similar = await app.inject({
      method: 'GET',
      url: `/v1/recommend/items/search-a?indexId=${indexId}&limit=2`,
    });
    expect(similar.json()).toMatchObject({
      itemId: 'search-a',
      recommendations: [{ itemId: 'search-b' }],
    });

    for (const interaction of [
      { userId: 'target', itemId: 'search-a', type: 'like' },
      { userId: 'peer', itemId: 'search-a', type: 'click' },
      { userId: 'peer', itemId: 'search-b', type: 'purchase' },
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/interactions',
            payload: { indexId, ...interaction },
          })
        ).statusCode,
      ).toBe(202);
    }

    const user = await app.inject({
      method: 'GET',
      url: `/v1/recommend/users/target?indexId=${indexId}&explain=true`,
    });
    expect(user.json()).toMatchObject({
      userId: 'target',
      recommendations: [
        {
          itemId: 'search-b',
          reasons: {
            content: expect.any(Number),
            collaborative: expect.any(Number),
            popularity: expect.any(Number),
          },
        },
      ],
    });
    const popular = await app.inject({
      method: 'GET',
      url: `/v1/recommend/popular?indexId=${indexId}`,
    });
    expect(
      popular.json<{ recommendations: Array<{ itemId: string }> }>().recommendations[0]?.itemId,
    ).toBe('search-a');
    const stats = await app.inject({
      method: 'GET',
      url: `/v1/recommend/statistics?indexId=${indexId}`,
    });
    expect(stats.json()).toMatchObject({
      statistics: { totalInteractions: 3, uniqueUsers: 2, uniqueItems: 2 },
    });
  });

  it('uses popularity for new users and rejects interactions with unknown items', async () => {
    const { app, indexId } = await fixture();
    await app.inject({
      method: 'POST',
      url: '/v1/interactions',
      payload: { indexId, userId: 'known', itemId: 'cooking', type: 'purchase' },
    });
    const cold = await app.inject({
      method: 'GET',
      url: `/v1/recommend/users/new-user?indexId=${indexId}`,
    });
    expect(cold.json()).toMatchObject({ recommendations: [{ itemId: 'cooking' }] });
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/interactions',
      payload: { indexId, userId: 'u', itemId: 'missing', type: 'view' },
    });
    expect(invalid.statusCode).toBe(404);
    expect(invalid.json()).toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });
});

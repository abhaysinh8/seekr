import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { HealthDependency } from '../services/health-dependency.js';

const projectId = '999b2c15-a72c-4e53-8578-4d3a61ce63e7';
const indexId = '6c718f93-c189-46a7-b772-6fb8afc8ca43';

const healthyDependency = (): HealthDependency => ({
  close: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue(undefined),
});

const createApp = () =>
  buildApp({
    dependencies: { cache: healthyDependency(), database: healthyDependency() },
    environment: { CORS_ORIGIN: 'http://localhost:3000' },
  });

describe('crawl source REST API', () => {
  it('creates, lists, reads, queues, checks, and deletes a source', async () => {
    const app = await createApp();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/sources',
      headers: { 'x-request-id': 'crawl-request' },
      payload: {
        projectId,
        indexId,
        name: 'Seekr documentation',
        startingUrl: 'https://docs.example.com/start#intro',
        configuration: {
          allowedDomains: ['docs.example.com'],
          maxDepth: 4,
          maxPages: 250,
          concurrency: 3,
        },
      },
    });
    expect(created.statusCode).toBe(201);
    const source = created.json().source as { id: string };

    const listed = await app.inject({ method: 'GET', url: `/v1/sources?projectId=${projectId}` });
    expect(listed.json()).toMatchObject({
      sources: [
        {
          id: source.id,
          name: 'Seekr documentation',
          configuration: { maxDepth: 4, maxPages: 250, concurrency: 3, crawlDelayMs: 500 },
        },
      ],
    });

    const read = await app.inject({ method: 'GET', url: `/v1/sources/${source.id}` });
    expect(read.statusCode).toBe(200);

    const queued = await app.inject({ method: 'POST', url: `/v1/sources/${source.id}/crawl` });
    expect(queued.statusCode).toBe(202);
    const job = queued.json().job as { id: string };
    expect(queued.json().job).toMatchObject({ sourceId: source.id, status: 'queued', indexed: 0 });

    const status = await app.inject({ method: 'GET', url: `/v1/crawl/${job.id}` });
    expect(status.json().job).toMatchObject({ id: job.id, status: 'queued' });

    expect(
      (await app.inject({ method: 'DELETE', url: `/v1/sources/${source.id}` })).statusCode,
    ).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/v1/sources/${source.id}` })).statusCode).toBe(
      404,
    );
    expect((await app.inject({ method: 'GET', url: `/v1/crawl/${job.id}` })).statusCode).toBe(404);
  });

  it('validates crawl safety limits', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sources',
      payload: {
        projectId,
        indexId,
        name: 'Unsafe source',
        startingUrl: 'file:///etc/passwd',
        configuration: { concurrency: 100, maxPages: 1_000_000 },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

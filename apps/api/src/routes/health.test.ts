import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { HealthDependency } from '../services/health-dependency.js';

const healthyDependency = (): HealthDependency => ({
  close: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue(undefined),
});

describe('health routes', () => {
  it('reports liveness without touching external services', async () => {
    const database = healthyDependency();
    const cache = healthyDependency();
    const app = await buildApp({
      dependencies: { cache, database },
      environment: { CORS_ORIGIN: 'http://localhost:3000' },
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: 'seekr-api', status: 'ok' });
    expect(database.ping).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 503 when a required dependency is unavailable', async () => {
    const database = healthyDependency();
    const cache: HealthDependency = {
      close: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    };
    const app = await buildApp({
      dependencies: { cache, database },
      environment: { CORS_ORIGIN: 'http://localhost:3000' },
    });

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      dependencies: { postgres: 'up', redis: 'down' },
      status: 'degraded',
    });
    await app.close();
  });
});

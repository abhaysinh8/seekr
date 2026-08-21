import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { HealthDependency } from '../services/health-dependency.js';

const healthy = (): HealthDependency => ({ close: async () => {}, ping: async () => {} });

describe('metrics routes', () => {
  it('exposes Prometheus counters and index gauges', async () => {
    const app = await buildApp({
      dependencies: { database: healthy(), cache: healthy() },
      environment: { CORS_ORIGIN: 'http://localhost:3000' },
    });
    await app.inject({ method: 'GET', url: '/health' });
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('seekr_http_requests_total');
    expect(response.body).toContain('seekr_index_documents');
    await app.close();
  });
});

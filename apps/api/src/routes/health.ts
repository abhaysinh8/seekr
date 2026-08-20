import type { FastifyPluginCallback } from 'fastify';

import type { DependencyStatus, HealthResponse } from '@seekr/shared';

import type { HealthDependency } from '../services/health-dependency.js';

interface HealthRouteOptions {
  readonly database: HealthDependency;
  readonly cache: HealthDependency;
}

const checkDependency = async (dependency: HealthDependency): Promise<DependencyStatus> => {
  try {
    await dependency.ping();
    return 'up';
  } catch {
    return 'down';
  }
};

export const healthRoutes: FastifyPluginCallback<HealthRouteOptions> = (app, options, done) => {
  app.get('/health', (): HealthResponse => ({
    service: 'seekr-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }));

  app.get('/ready', async (_request, reply): Promise<HealthResponse> => {
    const [postgres, redis] = await Promise.all([
      checkDependency(options.database),
      checkDependency(options.cache),
    ]);
    const status = postgres === 'up' && redis === 'up' ? 'ok' : 'degraded';

    if (status === 'degraded') {
      reply.status(503);
    }

    return {
      dependencies: { postgres, redis },
      service: 'seekr-api',
      status,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  });

  done();
};

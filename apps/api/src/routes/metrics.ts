import type { FastifyPluginCallback } from 'fastify';
import type { MetricsRegistry } from '../observability/metrics.js';
import type { IndexManagementService } from '../services/index-management.js';

export const metricsRoutes: FastifyPluginCallback<{
  metrics: MetricsRegistry;
  indexes: IndexManagementService;
}> = (app, options, done) => {
  app.get('/metrics', async (_request, reply) =>
    reply
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(await options.metrics.render(options.indexes)),
  );
  done();
};

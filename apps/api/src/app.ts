import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';
import type { FastifyError, FastifyServerOptions } from 'fastify';

import type { ApiEnvironment } from '@seekr/config';

import type { HealthDependency } from './services/health-dependency.js';
import { healthRoutes } from './routes/health.js';

export interface AppDependencies {
  readonly database: HealthDependency;
  readonly cache: HealthDependency;
}

export interface BuildAppOptions {
  readonly environment: Pick<ApiEnvironment, 'CORS_ORIGIN'>;
  readonly dependencies: AppDependencies;
  readonly logger?: FastifyServerOptions['logger'];
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
  });

  await app.register(sensible);
  await app.register(cors, {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: options.environment.CORS_ORIGIN,
  });

  await app.register(healthRoutes, options.dependencies);

  app.setNotFoundHandler(async (request, reply) => {
    await reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} does not exist`,
      statusCode: 404,
    });
  });

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request failed');
    const statusCode = error.statusCode ?? 500;

    await reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.name,
      message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
      statusCode,
    });
  });

  return app;
}

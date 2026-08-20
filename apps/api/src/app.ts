import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';
import type { FastifyError, FastifyServerOptions } from 'fastify';

import type { ApiEnvironment } from '@seekr/config';

import { createAuthenticationHook } from './auth/authentication.js';
import { SearchResponseCache } from './cache/search-cache.js';
import { MemoryCacheStore, ResilientCacheStore } from './cache/store.js';
import { HttpError } from './errors/http-error.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { analyticsRoutes } from './routes/analytics.js';
import { crawlRoutes } from './routes/crawl.js';
import { indexRoutes } from './routes/indexes.js';
import { recommendationRoutes } from './routes/recommendations.js';
import { searchRoutes } from './routes/search.js';
import { InMemoryCatalogStore } from './services/catalog-store.js';
import { InMemoryAnalyticsRepository } from './services/analytics-repository.js';
import { AnalyticsService } from './services/analytics-service.js';
import type { ApiKeyService } from './services/api-key-service.js';
import { InMemoryCrawlRepository, type CrawlRepository } from './services/crawl-repository.js';
import { IndexManagementService } from './services/index-management.js';
import { InMemoryInteractionRepository } from './services/interaction-repository.js';
import { InMemoryIndexService, type IndexService } from './services/index-service.js';
import type { HealthDependency } from './services/health-dependency.js';
import { RecommendationService } from './services/recommendation-service.js';
import { healthRoutes } from './routes/health.js';

export interface AppDependencies {
  readonly database: HealthDependency;
  readonly cache: HealthDependency;
  readonly indexes?: IndexService;
  readonly crawls?: CrawlRepository;
  readonly indexManagement?: IndexManagementService;
  readonly apiKeys?: ApiKeyService;
  readonly analytics?: AnalyticsService;
  readonly recommendations?: RecommendationService;
  readonly searchCache?: SearchResponseCache;
}

export interface BuildAppOptions {
  readonly environment: Pick<ApiEnvironment, 'CORS_ORIGIN'>;
  readonly dependencies: AppDependencies;
  readonly logger?: FastifyServerOptions['logger'];
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    genReqId: () => randomUUID(),
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
  });

  await app.register(sensible);
  await app.register(cors, {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: options.environment.CORS_ORIGIN,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.decorateRequest('auth', null);
  if (options.dependencies.apiKeys !== undefined) {
    app.addHook('preHandler', createAuthenticationHook(options.dependencies.apiKeys));
  }

  const indexes = options.dependencies.indexes ?? new InMemoryIndexService();
  const recommendations =
    options.dependencies.recommendations ??
    new RecommendationService(new InMemoryInteractionRepository());
  const indexManagement =
    options.dependencies.indexManagement ??
    new IndexManagementService(new InMemoryCatalogStore(), indexes, recommendations);
  const analytics =
    options.dependencies.analytics ?? new AnalyticsService(new InMemoryAnalyticsRepository());
  const searchCache =
    options.dependencies.searchCache ??
    new SearchResponseCache(new ResilientCacheStore(new MemoryCacheStore()));

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request failed');
    const isHttpError = error instanceof HttpError;
    const statusCode = isHttpError ? error.statusCode : (error.statusCode ?? 500);

    await reply.status(statusCode).send({
      code: isHttpError ? error.code : (error.code ?? 'INTERNAL_ERROR'),
      error: statusCode >= 500 ? 'Internal Server Error' : error.name,
      message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
      requestId: request.id,
      statusCode,
      ...(isHttpError && error.details !== undefined ? { details: error.details } : {}),
    });
  });

  await app.register(healthRoutes, options.dependencies);
  if (options.dependencies.apiKeys !== undefined) {
    await app.register(apiKeyRoutes, { apiKeys: options.dependencies.apiKeys });
  }
  await app.register(analyticsRoutes, { analytics });
  await app.register(crawlRoutes, {
    crawls: options.dependencies.crawls ?? new InMemoryCrawlRepository(),
  });
  await app.register(indexRoutes, { management: indexManagement });
  await app.register(recommendationRoutes, { recommendations });
  await app.register(searchRoutes, {
    indexes,
    analytics,
    cache: searchCache,
  });

  app.setNotFoundHandler(async (request, reply) => {
    await reply.status(404).send({
      code: 'ROUTE_NOT_FOUND',
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} does not exist`,
      requestId: request.id,
      statusCode: 404,
    });
  });

  return app;
}

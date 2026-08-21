import { loadApiEnvironment } from '@seekr/config';

import { buildApp } from './app.js';
import { createCache } from './cache/client.js';
import { SearchResponseCache } from './cache/search-cache.js';
import { RedisCacheStore, ResilientCacheStore } from './cache/store.js';
import { createDatabase } from './database/client.js';
import { PostgresCatalogStore } from './services/catalog-store.js';
import { PostgresApiKeyRepository } from './services/api-key-repository.js';
import { ApiKeyService } from './services/api-key-service.js';
import { PostgresAnalyticsRepository } from './services/analytics-repository.js';
import { AnalyticsService } from './services/analytics-service.js';
import { InMemoryIndexService } from './services/index-service.js';
import { PostgresCrawlRepository } from './services/crawl-repository.js';
import { IndexManagementService } from './services/index-management.js';
import { PostgresInteractionRepository } from './services/interaction-repository.js';
import { RecommendationService } from './services/recommendation-service.js';
import { BackgroundJobService } from './services/background-jobs.js';
import { PostgresJobRepository } from './services/job-repository.js';
import { bulkDocumentsRequestSchema } from '@seekr/shared';
import { QuerySuggestionService } from './services/query-suggestion-service.js';
import { IndexSnapshotService } from './services/snapshot-service.js';

const environment = loadApiEnvironment();
const database = createDatabase(environment.DATABASE_URL);
const cache = createCache(environment.REDIS_URL);
const indexes = new InMemoryIndexService();
const crawls = new PostgresCrawlRepository(database);
const catalogStore = new PostgresCatalogStore(database);
const interactionRepository = new PostgresInteractionRepository(database);
const recommendations = new RecommendationService(interactionRepository);
const indexManagement = new IndexManagementService(catalogStore, indexes, recommendations);
const apiKeys = new ApiKeyService(new PostgresApiKeyRepository(database));
const analytics = new AnalyticsService(new PostgresAnalyticsRepository(database));
const searchCache = new SearchResponseCache(
  new ResilientCacheStore(new RedisCacheStore(cache.client)),
);
const querySuggestions = new QuerySuggestionService();
const backgroundJobs = new BackgroundJobService(new PostgresJobRepository(database));
const snapshots = new IndexSnapshotService(
  indexManagement,
  environment.SEEKR_INDEX_PATH,
  environment.SEEKR_SNAPSHOT_PATH,
);
backgroundJobs.register('reindex', async (payload, context) => {
  if (typeof payload.indexId !== 'string') throw new Error('Invalid reindex job payload');
  await context.reportProgress(10);
  await indexManagement.reindex(payload.indexId);
});
backgroundJobs.register('bulk_ingestion', async (payload, context) => {
  if (typeof payload.indexId !== 'string') throw new Error('Invalid bulk ingestion job payload');
  const { documents } = bulkDocumentsRequestSchema.parse({ documents: payload.documents });
  await context.reportProgress(10);
  await indexManagement.addDocuments(payload.indexId, documents);
});
const jobTimer = setInterval(() => void backgroundJobs.runOnce(), 250);
await indexManagement.initialize();
for (const index of await catalogStore.listIndexes())
  await recommendations.loadInteractions(index.id);

const app = await buildApp({
  dependencies: {
    analytics,
    apiKeys,
    backgroundJobs,
    cache,
    crawls,
    database,
    indexManagement,
    indexes,
    recommendations,
    querySuggestions,
    searchCache,
    snapshots,
  },
  environment,
  logger: {
    level: environment.LOG_LEVEL,
    ...(environment.NODE_ENV === 'development'
      ? {
          transport: {
            options: { colorize: true, ignore: 'pid,hostname' },
            target: 'pino-pretty',
          },
        }
      : {}),
  },
});

app.addHook('onClose', async () => {
  clearInterval(jobTimer);
  await Promise.allSettled([database.close(), cache.close()]);
});

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, 'Shutting down API');
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'API failed to start');
  await app.close();
  process.exit(1);
}

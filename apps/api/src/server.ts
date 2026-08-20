import { loadApiEnvironment } from '@seekr/config';

import { buildApp } from './app.js';
import { createCache } from './cache/client.js';
import { createDatabase } from './database/client.js';
import { PostgresCatalogStore } from './services/catalog-store.js';
import { PostgresApiKeyRepository } from './services/api-key-repository.js';
import { ApiKeyService } from './services/api-key-service.js';
import { PostgresAnalyticsRepository } from './services/analytics-repository.js';
import { AnalyticsService } from './services/analytics-service.js';
import { InMemoryIndexService } from './services/index-service.js';
import { PostgresCrawlRepository } from './services/crawl-repository.js';
import { IndexManagementService } from './services/index-management.js';

const environment = loadApiEnvironment();
const database = createDatabase(environment.DATABASE_URL);
const cache = createCache(environment.REDIS_URL);
const indexes = new InMemoryIndexService();
const crawls = new PostgresCrawlRepository(database);
const indexManagement = new IndexManagementService(new PostgresCatalogStore(database), indexes);
const apiKeys = new ApiKeyService(new PostgresApiKeyRepository(database));
const analytics = new AnalyticsService(new PostgresAnalyticsRepository(database));
await indexManagement.initialize();

const app = await buildApp({
  dependencies: { analytics, apiKeys, cache, crawls, database, indexManagement, indexes },
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

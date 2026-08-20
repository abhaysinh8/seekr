import pino from 'pino';

import { loadCrawlerEnvironment } from '@seekr/config';

const environment = loadCrawlerEnvironment();
const logger = pino(
  environment.NODE_ENV === 'development'
    ? {
        level: environment.LOG_LEVEL,
        transport: {
          options: { colorize: true, ignore: 'pid,hostname' },
          target: 'pino-pretty',
        },
      }
    : { level: environment.LOG_LEVEL },
);

logger.info({ service: 'seekr-crawler' }, 'Crawler worker is ready to accept jobs');

const heartbeat = setInterval(() => {
  logger.debug({ service: 'seekr-crawler' }, 'Crawler worker heartbeat');
}, 60_000);

const shutdown = (signal: NodeJS.Signals) => {
  clearInterval(heartbeat);
  logger.info({ signal }, 'Shutting down crawler');
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

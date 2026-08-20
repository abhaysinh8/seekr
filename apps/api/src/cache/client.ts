import { Redis } from 'ioredis';

import type { HealthDependency } from '../services/health-dependency.js';

export interface Cache extends HealthDependency {
  readonly client: Redis;
}

export function createCache(connectionString: string): Cache {
  const client = new Redis(connectionString, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  client.on('error', () => {
    // Connection failures are surfaced by ping and reported by readiness checks.
  });

  return {
    client,
    async ping() {
      if (client.status === 'wait') {
        await client.connect();
      }
      await client.ping();
    },
    close() {
      if (client.status !== 'end' && client.status !== 'wait') {
        client.disconnect(false);
      }
      return Promise.resolve();
    },
  };
}

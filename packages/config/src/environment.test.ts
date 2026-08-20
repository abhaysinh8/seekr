import { describe, expect, it } from 'vitest';

import { loadApiEnvironment } from './environment.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://seekr:password@localhost:5432/seekr',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadApiEnvironment', () => {
  it('applies safe local defaults', () => {
    const environment = loadApiEnvironment(validEnvironment);

    expect(environment).toMatchObject({
      API_HOST: '0.0.0.0',
      API_PORT: 4000,
      CORS_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'development',
    });
  });

  it('reports every invalid value in one error', () => {
    expect(() =>
      loadApiEnvironment({
        DATABASE_URL: 'not-a-database-url',
        REDIS_URL: 'https://localhost:6379',
      }),
    ).toThrow(/DATABASE_URL.*REDIS_URL/);
  });
});

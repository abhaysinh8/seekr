import { describe, expect, it } from 'vitest';
import { parseArguments } from './parser.js';
import { resolveConfiguration } from './config.js';

describe('CLI', () => {
  it('parses commands and flags', () => {
    expect(parseArguments(['documents', 'get', '--index-id', 'idx', '--json'])).toEqual({
      command: ['documents', 'get'],
      flags: { indexId: 'idx', json: true },
    });
  });
  it('uses flags over environment configuration', async () => {
    await expect(
      resolveConfiguration(
        { url: 'http://flag', apiKey: 'flag-key' },
        { SEEKR_URL: 'http://env', SEEKR_API_KEY: 'env-key', SEEKR_CONFIG: 'missing-file' },
      ),
    ).resolves.toMatchObject({ baseUrl: 'http://flag', apiKey: 'flag-key' });
  });
});

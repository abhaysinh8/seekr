import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliConfiguration {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly output: 'human' | 'json';
}

export async function resolveConfiguration(
  flags: Readonly<Record<string, string | boolean>>,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CliConfiguration> {
  const configPath =
    asString(flags.config) ??
    environment.SEEKR_CONFIG ??
    join(homedir(), '.config', 'seekr', 'config.json');
  const file = await readConfig(configPath);
  return {
    baseUrl:
      asString(flags.url) ?? environment.SEEKR_URL ?? file.baseUrl ?? 'http://localhost:4000',
    ...((asString(flags.apiKey) ?? environment.SEEKR_API_KEY ?? file.apiKey) === undefined
      ? {}
      : { apiKey: asString(flags.apiKey) ?? environment.SEEKR_API_KEY ?? file.apiKey }),
    output:
      flags.json === true || environment.SEEKR_OUTPUT === 'json' || file.output === 'json'
        ? 'json'
        : 'human',
  };
}

async function readConfig(path: string): Promise<Partial<CliConfiguration>> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const record = value as Record<string, unknown>;
    return {
      ...(typeof record.baseUrl === 'string' ? { baseUrl: record.baseUrl } : {}),
      ...(typeof record.apiKey === 'string' ? { apiKey: record.apiKey } : {}),
      ...(record.output === 'human' || record.output === 'json' ? { output: record.output } : {}),
    };
  } catch {
    return {};
  }
}

const asString = (value: string | boolean | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

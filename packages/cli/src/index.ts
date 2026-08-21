import { readFile } from 'node:fs/promises';
import { SeekrClient } from '@seekr/sdk';
import { resolveConfiguration } from './config.js';
import { parseArguments } from './parser.js';

export { resolveConfiguration } from './config.js';
export { parseArguments } from './parser.js';

export async function run(arguments_: readonly string[]): Promise<void> {
  const parsed = parseArguments(arguments_);
  const config = await resolveConfiguration(parsed.flags);
  const client = new SeekrClient({
    baseUrl: config.baseUrl,
    ...(config.apiKey === undefined ? {} : { apiKey: config.apiKey }),
  });
  const [group, action] = parsed.command;
  let result: unknown;
  if (group === 'health') result = await client.health();
  else if (group === 'indexes' && action === 'list')
    result = await client.indexes.list(stringFlag(parsed.flags.projectId));
  else if (group === 'indexes' && action === 'get')
    result = await client.indexes.get(required(parsed.flags.indexId, 'index-id'));
  else if (group === 'indexes' && action === 'create')
    result = await client.indexes.create(await jsonInput(parsed.flags));
  else if (group === 'indexes' && action === 'delete')
    result = await client.indexes.delete(required(parsed.flags.indexId, 'index-id'));
  else if (group === 'documents' && action === 'add')
    result = await client.indexes.addDocument(
      required(parsed.flags.indexId, 'index-id'),
      await jsonInput(parsed.flags),
    );
  else if (group === 'documents' && action === 'bulk')
    result = await client.indexes.addDocuments(
      required(parsed.flags.indexId, 'index-id'),
      await jsonInput(parsed.flags),
      requestOptions(parsed.flags),
    );
  else if (group === 'documents' && action === 'get')
    result = await client.indexes.getDocument(
      required(parsed.flags.indexId, 'index-id'),
      required(parsed.flags.documentId, 'document-id'),
    );
  else if (group === 'documents' && action === 'delete')
    result = await client.indexes.deleteDocument(
      required(parsed.flags.indexId, 'index-id'),
      required(parsed.flags.documentId, 'document-id'),
    );
  else if (group === 'search')
    result = await client.indexes.search(required(parsed.flags.indexId, 'index-id'), {
      query: required(parsed.flags.query, 'query'),
    });
  else if (group === 'autocomplete')
    result = await client.indexes.autocomplete(required(parsed.flags.indexId, 'index-id'), {
      prefix: required(parsed.flags.prefix, 'prefix'),
    });
  else if (group === 'crawl' && action === 'start')
    result = await client.request(
      `/v1/sources/${encodeURIComponent(required(parsed.flags.sourceId, 'source-id'))}/crawl`,
      { method: 'POST' },
    );
  else if (group === 'crawl' && action === 'status')
    result = await client.request(
      `/v1/crawl/${encodeURIComponent(required(parsed.flags.jobId, 'job-id'))}`,
    );
  else if (group === 'snapshot' && action === 'list')
    result = await client.request(
      `/v1/indexes/${encodeURIComponent(required(parsed.flags.indexId, 'index-id'))}/snapshots`,
    );
  else if (group === 'snapshot' && action === 'create')
    result = await client.request(
      `/v1/indexes/${encodeURIComponent(required(parsed.flags.indexId, 'index-id'))}/snapshots`,
      { method: 'POST', ...requestOptions(parsed.flags) },
    );
  else if (group === 'snapshot' && action === 'restore')
    result = await client.request(
      `/v1/indexes/${encodeURIComponent(required(parsed.flags.indexId, 'index-id'))}/snapshots/${encodeURIComponent(required(parsed.flags.snapshotId, 'snapshot-id'))}/restore`,
      { method: 'POST', ...requestOptions(parsed.flags) },
    );
  else throw new Error(usage());
  print(result, config.output);
}

function requestOptions(flags: Readonly<Record<string, string | boolean>>) {
  const idempotencyKey = stringFlag(flags.idempotencyKey);
  return idempotencyKey === undefined ? {} : { idempotencyKey };
}
async function jsonInput<T>(flags: Readonly<Record<string, string | boolean>>): Promise<T> {
  const inline = stringFlag(flags.data);
  const file = stringFlag(flags.file);
  if (inline !== undefined) return JSON.parse(inline) as T;
  if (file !== undefined) return JSON.parse(await readFile(file, 'utf8')) as T;
  throw new Error('Provide JSON using --data or --file.');
}
function required(value: string | boolean | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing --${name}.`);
  return value;
}
const stringFlag = (value: string | boolean | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;
function print(value: unknown, output: 'human' | 'json'): void {
  if (value === undefined) {
    process.stdout.write(output === 'json' ? '{}\n' : 'Done.\n');
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, output === 'json' ? 0 : 2)}\n`);
}
function usage(): string {
  return 'Usage: seekr <health|indexes|documents|search|autocomplete|crawl|snapshot> [action] [--flags]';
}

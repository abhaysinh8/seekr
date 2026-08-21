import { readFile } from 'node:fs/promises';
import { SeekrClient } from '@seekr/sdk';

const [indexId, sourceFile] = process.argv.slice(2);
if (!indexId || !sourceFile) throw new Error('Usage: pnpm seed <index-id> <documents.json>');
const documents = JSON.parse(await readFile(sourceFile, 'utf8')) as Array<{
  id: string;
  fields: Record<string, string>;
  metadata: Record<string, string>;
}>;
const client = new SeekrClient({
  baseUrl: process.env.SEEKR_URL ?? 'http://localhost:4000',
  ...(process.env.SEEKR_API_KEY ? { apiKey: process.env.SEEKR_API_KEY } : {}),
});
await client.indexes.addDocuments(indexId, documents, { idempotencyKey: `docs-${Date.now()}` });
process.stdout.write(`Indexed ${documents.length} documentation pages.\n`);

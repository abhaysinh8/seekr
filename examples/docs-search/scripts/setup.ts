import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SeekrClient } from '@seekr/sdk';

const baseUrl = process.env.SEEKR_URL ?? 'http://localhost:4000';
const bootstrap = new SeekrClient({ baseUrl });
const suffix = Date.now().toString(36);
const { project } = await bootstrap.createProject({
  name: 'Seekr Documentation Demo',
  slug: `seekr-docs-${suffix}`,
  ownerEmail: `docs-${suffix}@example.invalid`,
});
const createdKey = await bootstrap.request<{ rawKey: string }>('/v1/api-keys', {
  method: 'POST',
  body: {
    projectId: project.id,
    name: 'Documentation demo',
    scopes: ['search', 'indexes:read', 'indexes:write', 'documents:read', 'documents:write'],
  },
});
const seekr = new SeekrClient({ baseUrl, apiKey: createdKey.rawKey });
const { index } = await seekr.indexes.create({
  projectId: project.id,
  name: 'Developer documentation',
  schema: {
    fields: {
      title: {
        type: 'text',
        searchable: true,
        filterable: false,
        facetable: false,
        sortable: false,
        weight: 3,
      },
      content: {
        type: 'text',
        searchable: true,
        filterable: false,
        facetable: false,
        sortable: false,
        weight: 1,
      },
      section: {
        type: 'string',
        searchable: false,
        filterable: true,
        facetable: true,
        sortable: true,
        weight: 1,
      },
    },
    synonyms: [{ source: 'docs', targets: ['documentation'], bidirectional: true }],
    synonymPenalty: 0.7,
    rankingRules: [],
  },
});
const documents = JSON.parse(
  await readFile(new URL('../data/documents.json', import.meta.url), 'utf8'),
) as Array<{ id: string; fields: Record<string, string>; metadata: Record<string, string> }>;
await seekr.documents.bulk(index.id, documents, { idempotencyKey: `docs-demo-${suffix}` });
await writeFile(
  fileURLToPath(new URL('../.env.local', import.meta.url)),
  `SEEKR_URL=${baseUrl}\nSEEKR_API_KEY=${createdKey.rawKey}\nSEEKR_INDEX_ID=${index.id}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `Created documentation demo index ${index.id} with ${documents.length} documents.\n`,
);

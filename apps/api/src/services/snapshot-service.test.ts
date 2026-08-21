import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryCatalogStore } from './catalog-store.js';
import { IndexManagementService } from './index-management.js';
import { InMemoryIndexService } from './index-service.js';
import { IndexSnapshotService } from './snapshot-service.js';

const directories: string[] = [];
afterEach(async () =>
  Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  ),
);

describe('IndexSnapshotService', () => {
  it('round-trips schema and documents through checksummed immutable segments', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'seekr-api-snapshot-'));
    directories.push(root);
    const management = new IndexManagementService(
      new InMemoryCatalogStore(),
      new InMemoryIndexService(),
    );
    const project = await management.createProject({
      name: 'Docs',
      slug: 'docs',
      ownerEmail: 'owner@example.com',
    });
    const created = await management.createIndex({
      projectId: project.id,
      name: 'Docs',
      schema: {
        fields: {
          title: {
            type: 'text',
            searchable: true,
            filterable: false,
            facetable: false,
            sortable: false,
            weight: 1,
          },
        },
        synonyms: [],
        synonymPenalty: 0.7,
        rankingRules: [],
      },
    });
    await management.addDocuments(created.id, [
      { id: 'one', fields: { title: 'Original' }, metadata: {} },
    ]);
    const snapshots = new IndexSnapshotService(
      management,
      path.join(root, 'work'),
      path.join(root, 'snapshots'),
    );
    const snapshot = await snapshots.create(created.id);
    await management.addDocuments(created.id, [
      { id: 'one', fields: { title: 'Changed' }, metadata: {} },
      { id: 'two', fields: { title: 'Extra' }, metadata: {} },
    ]);
    await snapshots.restore(created.id, snapshot.id);
    await expect(management.listDocuments(created.id, 10, 0)).resolves.toMatchObject({
      total: 1,
      documents: [{ id: 'one', fields: { title: 'Original' } }],
    });
  });
});

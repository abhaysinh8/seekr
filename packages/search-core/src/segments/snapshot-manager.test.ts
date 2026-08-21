import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemSegmentStore } from './file-system-store.js';
import { ImmutableSegmentIndex } from './immutable-segment-index.js';
import { SnapshotManager } from './snapshot-manager.js';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('immutable index snapshots', () => {
  it('creates, lists, validates, and atomically restores original search results', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'seekr-snapshot-test-'));
    roots.push(root);
    const indexRoot = path.join(root, 'live-index');
    const snapshotsRoot = path.join(root, 'snapshots');
    const configuration = { fields: { body: { searchable: true } } };
    const index = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(indexRoot), {
      configuration,
    });
    await index.addDocument({ id: 'original', fields: { body: 'machine learning' } });
    await index.flush();
    const manager = new SnapshotManager(indexRoot, snapshotsRoot);
    const snapshot = await manager.create(configuration, { name: 'test-index' });
    await index.addDocument({ id: 'changed', fields: { body: 'database systems' } });
    await index.flush();
    expect(index.search('database').total).toBe(1);
    await manager.restore(snapshot.id);
    const restored = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(indexRoot), {
      configuration,
    });
    expect(restored.search('machine').results[0]?.documentId).toBe('original');
    expect(restored.search('database').total).toBe(0);
    expect(await manager.list()).toHaveLength(1);
  });

  it('rejects corruption before replacing the live index', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'seekr-snapshot-test-'));
    roots.push(root);
    const indexRoot = path.join(root, 'live-index');
    const snapshotsRoot = path.join(root, 'snapshots');
    const index = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(indexRoot));
    await index.addDocument({ id: 'safe', fields: { body: 'safe content' } });
    await index.flush();
    const manager = new SnapshotManager(indexRoot, snapshotsRoot);
    const snapshot = await manager.create({});
    const manifestPath = path.join(snapshotsRoot, snapshot.id, 'index', 'manifest.json');
    await writeFile(manifestPath, `${await readFile(manifestPath, 'utf8')}corrupt`, 'utf8');
    await expect(manager.restore(snapshot.id)).rejects.toThrow('checksum');
    const stillLive = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(indexRoot));
    expect(stillLive.search('safe').total).toBe(1);
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FileSystemSegmentStore } from './file-system-store.js';
import { ImmutableSegmentIndex } from './immutable-segment-index.js';
import { MemorySegmentStore } from './memory-store.js';

describe('ImmutableSegmentIndex', () => {
  it('searches documents across independently flushed segments', async () => {
    const store = new MemorySegmentStore();
    const index = await ImmutableSegmentIndex.open(store);
    await index.addDocument({ id: 'one', fields: { body: 'machine learning' } });
    await index.flush();
    await index.addDocument({ id: 'two', fields: { body: 'machine vision' } });
    await index.flush();

    expect(index.segmentCount).toBe(2);
    expect(
      index
        .search('machine', { limit: 10 })
        .results.map(({ documentId }) => documentId)
        .sort(),
    ).toEqual(['one', 'two']);
  });

  it('persists tombstones and excludes deleted documents after restart', async () => {
    const store = new MemorySegmentStore();
    const index = await ImmutableSegmentIndex.open(store);
    await index.addDocuments([
      { id: 'keep', fields: { body: 'search engine' } },
      { id: 'delete', fields: { body: 'search obsolete' } },
    ]);
    await index.flush();
    expect(await index.removeDocument('delete')).toBe(true);

    const restarted = await ImmutableSegmentIndex.open(store);
    expect(restarted.getDocument('delete')).toBeUndefined();
    expect(restarted.search('search').results.map(({ documentId }) => documentId)).toEqual([
      'keep',
    ]);
    expect(restarted.autocomplete('obs')).toEqual([]);
  });

  it('supports updates using a tombstone plus a newer immutable segment', async () => {
    const store = new MemorySegmentStore();
    const index = await ImmutableSegmentIndex.open(store);
    await index.addDocument({ id: 'doc', fields: { body: 'old term' } });
    await index.flush();
    await index.updateDocument({ id: 'doc', fields: { body: 'new term' } });
    await index.flush();
    expect(index.search('old').results).toEqual([]);
    expect(index.search('new').results.map(({ documentId }) => documentId)).toEqual(['doc']);
  });

  it('compacts segments while preserving visible search results', async () => {
    const store = new MemorySegmentStore();
    const index = await ImmutableSegmentIndex.open(store);
    await index.addDocument({ id: 'one', fields: { body: 'machine learning' } });
    await index.flush();
    await index.addDocument({ id: 'two', fields: { body: 'machine search' } });
    await index.flush();
    await index.addDocument({ id: 'remove', fields: { body: 'machine old' } });
    await index.flush();
    await index.removeDocument('remove');
    const before = index
      .search('machine', { limit: 10 })
      .results.map(({ documentId }) => documentId)
      .sort();

    await index.compact();

    expect(index.segmentCount).toBe(1);
    expect(
      index
        .search('machine', { limit: 10 })
        .results.map(({ documentId }) => documentId)
        .sort(),
    ).toEqual(before);
  });

  it('writes and reloads the documented filesystem layout', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'seekr-segments-'));
    try {
      const store = new FileSystemSegmentStore(directory);
      const index = await ImmutableSegmentIndex.open(store);
      await index.addDocument({ id: 'disk', fields: { body: 'durable machine search' } });
      const descriptor = await index.flush();
      const manifest = JSON.parse(
        await readFile(path.join(directory, 'manifest.json'), 'utf8'),
      ) as {
        segments: Array<{ id: string }>;
      };
      expect(manifest.segments[0]?.id).toBe(descriptor?.id);
      const segment = JSON.parse(
        await readFile(
          path.join(directory, 'segments', descriptor?.id ?? '', 'segment.json'),
          'utf8',
        ),
      ) as { dictionary: Array<{ term: string }> };
      expect(segment.dictionary.map(({ term }) => term)).toContain('machine');

      const restarted = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(directory));
      expect(restarted.search('durable').results[0]?.documentId).toBe('disk');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

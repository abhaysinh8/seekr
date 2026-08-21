import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileSystemSegmentStore, ImmutableSegmentIndex, SnapshotManager } from '@seekr/search-core';
import { indexSchemaConfigurationSchema, type AddDocumentApiRequest } from '@seekr/shared';
import { HttpError } from '../errors/http-error.js';
import { toEngineConfiguration } from './index-management.js';
import type { IndexManagementService } from './index-management.js';

export class IndexSnapshotService {
  constructor(
    private readonly management: IndexManagementService,
    private readonly workingRoot: string,
    private readonly snapshotsRoot: string,
  ) {}

  async create(indexId: string) {
    const exported = await this.management.exportIndex(indexId);
    const schema = exported.index.schema;
    const configuration = toEngineConfiguration(schema);
    return this.withWorkingIndex(indexId, async (working) => {
      const index = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(working), {
        configuration,
      });
      await index.addDocuments(exported.documents.map(toSearchDocument));
      await index.flush();
      return new SnapshotManager(working, this.snapshotDirectory(indexId)).create(configuration, {
        indexId,
        schema,
        documentCount: exported.documents.length,
      });
    });
  }

  list(indexId: string) {
    return this.withEmptyWorkingManager(indexId, (manager) => manager.list());
  }

  async restore(indexId: string, snapshotId: string) {
    return this.withWorkingIndex(indexId, async (working) => {
      const manager = new SnapshotManager(working, this.snapshotDirectory(indexId));
      const manifest = await manager.restore(snapshotId);
      if (manifest.indexMetadata.indexId !== indexId)
        throw new HttpError(400, 'SNAPSHOT_INDEX_MISMATCH', 'Snapshot belongs to another index');
      const parsed = indexSchemaConfigurationSchema.safeParse(manifest.indexMetadata.schema);
      if (!parsed.success)
        throw new HttpError(400, 'INVALID_SNAPSHOT', 'Snapshot schema metadata is invalid');
      const index = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(working), {
        configuration: manifest.configuration,
      });
      const documents: AddDocumentApiRequest[] = index.getDocuments().map((document) => ({
        id: document.id,
        fields: mutableRecord(document.fields),
        metadata: mutableRecord(document.metadata ?? {}),
      }));
      await this.management.restoreIndex(indexId, parsed.data, documents);
      return { manifest, restoredDocuments: documents.length };
    });
  }

  delete(indexId: string, snapshotId: string) {
    return this.withEmptyWorkingManager(indexId, (manager) => manager.delete(snapshotId));
  }

  private snapshotDirectory(indexId: string): string {
    assertIndexId(indexId);
    return path.join(this.snapshotsRoot, indexId);
  }

  private async withEmptyWorkingManager<T>(
    indexId: string,
    action: (manager: SnapshotManager) => Promise<T>,
  ): Promise<T> {
    return this.withWorkingIndex(indexId, (working) =>
      action(new SnapshotManager(working, this.snapshotDirectory(indexId))),
    );
  }

  private async withWorkingIndex<T>(
    indexId: string,
    action: (directory: string) => Promise<T>,
  ): Promise<T> {
    assertIndexId(indexId);
    const directory = path.join(this.workingRoot, `.snapshot-work-${indexId}-${randomUUID()}`);
    await mkdir(directory, { recursive: true });
    try {
      return await action(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

function toSearchDocument(document: AddDocumentApiRequest) {
  return { id: document.id, fields: document.fields, metadata: document.metadata };
}
function mutableRecord(
  value: Readonly<
    Record<string, string | number | boolean | readonly (string | number | boolean)[] | null>
  >,
): Record<string, string | number | boolean | (string | number | boolean)[] | null> {
  const output: Record<string, string | number | boolean | (string | number | boolean)[] | null> =
    {};
  for (const [key, entry] of Object.entries(value))
    output[key] = typeof entry === 'object' && entry !== null ? [...entry] : entry;
  return output;
}
function assertIndexId(indexId: string): void {
  if (!/^[0-9a-f-]{36}$/iu.test(indexId)) throw new Error('Invalid index ID');
}

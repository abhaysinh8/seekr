import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IndexConfiguration } from '../types.js';

export interface SnapshotManifest {
  readonly id: string;
  readonly createdAt: string;
  readonly indexMetadata: Readonly<Record<string, unknown>>;
  readonly configuration: IndexConfiguration;
  readonly files: Readonly<Record<string, string>>;
}

export class SnapshotManager {
  readonly #indexRoot: string;
  readonly #snapshotsRoot: string;
  constructor(indexRoot: string, snapshotsRoot: string) {
    this.#indexRoot = path.resolve(indexRoot);
    this.#snapshotsRoot = path.resolve(snapshotsRoot);
    if (
      isInside(this.#indexRoot, this.#snapshotsRoot) ||
      isInside(this.#snapshotsRoot, this.#indexRoot)
    ) {
      throw new Error('Index and snapshot directories must not contain each other');
    }
  }

  async create(
    configuration: IndexConfiguration,
    indexMetadata: Readonly<Record<string, unknown>> = {},
  ): Promise<SnapshotManifest> {
    const id = `snapshot-${new Date().toISOString().replace(/[:.]/gu, '-')}-${randomUUID()}`;
    const temporary = path.join(this.#snapshotsRoot, `.tmp-${randomUUID()}`);
    const destination = path.join(this.#snapshotsRoot, id);
    await mkdir(this.#snapshotsRoot, { recursive: true });
    try {
      await cp(this.#indexRoot, path.join(temporary, 'index'), {
        recursive: true,
        errorOnExist: true,
      });
      const files = await checksums(path.join(temporary, 'index'));
      const manifest: SnapshotManifest = {
        id,
        createdAt: new Date().toISOString(),
        indexMetadata,
        configuration,
        files,
      };
      await writeFile(
        path.join(temporary, 'snapshot.json'),
        JSON.stringify(manifest, null, 2),
        'utf8',
      );
      await rename(temporary, destination);
      return manifest;
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  async list(): Promise<readonly SnapshotManifest[]> {
    try {
      const entries = await readdir(this.#snapshotsRoot, { withFileTypes: true });
      const manifests: SnapshotManifest[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('snapshot-')) continue;
        manifests.push(
          JSON.parse(
            await readFile(path.join(this.#snapshotsRoot, entry.name, 'snapshot.json'), 'utf8'),
          ) as SnapshotManifest,
        );
      }
      return manifests.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async validate(id: string): Promise<SnapshotManifest> {
    validateId(id);
    const directory = path.join(this.#snapshotsRoot, id);
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'snapshot.json'), 'utf8'),
    ) as SnapshotManifest;
    if (manifest.id !== id) throw new Error('Snapshot manifest ID does not match its directory');
    const actual = await checksums(path.join(directory, 'index'));
    if (JSON.stringify(actual) !== JSON.stringify(manifest.files))
      throw new Error(`Snapshot ${id} checksum validation failed`);
    return manifest;
  }

  async restore(id: string): Promise<SnapshotManifest> {
    const manifest = await this.validate(id);
    const staging = `${this.#indexRoot}.restore-${randomUUID()}`;
    const backup = `${this.#indexRoot}.backup-${randomUUID()}`;
    await cp(path.join(this.#snapshotsRoot, id, 'index'), staging, {
      recursive: true,
      errorOnExist: true,
    });
    let movedCurrent = false;
    try {
      try {
        await rename(this.#indexRoot, backup);
        movedCurrent = true;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      await rename(staging, this.#indexRoot);
      if (movedCurrent) await rm(backup, { recursive: true, force: true });
      return manifest;
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      if (movedCurrent) {
        await rm(this.#indexRoot, { recursive: true, force: true });
        await rename(backup, this.#indexRoot);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    validateId(id);
    const directory = path.join(this.#snapshotsRoot, id);
    try {
      await stat(directory);
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
    await rm(directory, { recursive: true, force: false });
    return true;
  }
}

async function checksums(root: string): Promise<Record<string, string>> {
  const files = await walk(root);
  const values: Record<string, string> = {};
  for (const file of files.sort()) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    values[relative] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  }
  return values;
}
async function walk(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(fullPath)));
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}
function validateId(id: string): void {
  if (!/^snapshot-[A-Za-z0-9-]+$/u.test(id)) throw new Error('Invalid snapshot ID');
}
function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

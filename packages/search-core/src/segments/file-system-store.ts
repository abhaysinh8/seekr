import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SegmentData, SegmentDescriptor, SegmentManifest, SegmentStore } from './types.js';

const isNotFound = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

export class FileSystemSegmentStore implements SegmentStore {
  readonly #manifestPath: string;
  readonly #segmentsPath: string;

  public constructor(private readonly rootPath: string) {
    this.#manifestPath = path.join(rootPath, 'manifest.json');
    this.#segmentsPath = path.join(rootPath, 'segments');
  }

  public async loadManifest(): Promise<SegmentManifest | undefined> {
    try {
      return JSON.parse(await readFile(this.#manifestPath, 'utf8')) as SegmentManifest;
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  public async saveManifest(manifest: SegmentManifest): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
    const temporaryPath = `${this.#manifestPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), 'utf8');
    await rename(temporaryPath, this.#manifestPath);
  }

  public async writeSegment(segment: SegmentData): Promise<void> {
    const directory = this.segmentDirectory(segment.descriptor.id);
    await mkdir(this.#segmentsPath, { recursive: true });
    await mkdir(directory, { recursive: false });
    await writeFile(path.join(directory, 'segment.json'), JSON.stringify(segment), 'utf8');
  }

  public async readSegment(descriptor: SegmentDescriptor): Promise<SegmentData> {
    const value = await readFile(
      path.join(this.segmentDirectory(descriptor.id), 'segment.json'),
      'utf8',
    );
    return JSON.parse(value) as SegmentData;
  }

  public async removeSegment(descriptor: SegmentDescriptor): Promise<void> {
    await rm(this.segmentDirectory(descriptor.id), { recursive: true, force: true });
  }

  private segmentDirectory(segmentId: string): string {
    if (!/^segment-\d{6}$/u.test(segmentId)) throw new Error(`Invalid segment id: ${segmentId}`);
    return path.join(this.#segmentsPath, segmentId);
  }
}

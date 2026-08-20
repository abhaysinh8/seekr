import type { SegmentData, SegmentDescriptor, SegmentManifest, SegmentStore } from './types.js';

export class MemorySegmentStore implements SegmentStore {
  #manifest: SegmentManifest | undefined;
  readonly #segments = new Map<string, SegmentData>();

  public loadManifest(): Promise<SegmentManifest | undefined> {
    return Promise.resolve(
      this.#manifest === undefined ? undefined : structuredClone(this.#manifest),
    );
  }

  public saveManifest(manifest: SegmentManifest): Promise<void> {
    this.#manifest = structuredClone(manifest);
    return Promise.resolve();
  }

  public writeSegment(segment: SegmentData): Promise<void> {
    if (this.#segments.has(segment.descriptor.id))
      throw new Error(`Immutable segment ${segment.descriptor.id} already exists`);
    this.#segments.set(segment.descriptor.id, structuredClone(segment));
    return Promise.resolve();
  }

  public readSegment(descriptor: SegmentDescriptor): Promise<SegmentData> {
    const segment = this.#segments.get(descriptor.id);
    if (segment === undefined) throw new Error(`Segment ${descriptor.id} does not exist`);
    return Promise.resolve(structuredClone(segment));
  }

  public removeSegment(descriptor: SegmentDescriptor): Promise<void> {
    this.#segments.delete(descriptor.id);
    return Promise.resolve();
  }
}

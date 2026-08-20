import type {
  CollectionStatistics,
  IndexConfiguration,
  PostingEntry,
  SearchDocument,
} from '../types.js';

export interface SegmentDescriptor {
  readonly id: string;
  readonly generation: number;
  readonly documentCount: number;
  readonly createdAt: string;
}

export interface SegmentManifest {
  readonly version: 1;
  readonly nextGeneration: number;
  readonly segments: readonly SegmentDescriptor[];
  /** A document is hidden in segments up to and including the stored generation. */
  readonly tombstones: Readonly<Record<string, number>>;
}

export interface SerializedTerm {
  readonly term: string;
  readonly postings: readonly PostingEntry[];
}

export interface SegmentData {
  readonly version: 1;
  readonly descriptor: SegmentDescriptor;
  readonly documents: readonly SearchDocument[];
  readonly dictionary: readonly SerializedTerm[];
  readonly statistics: CollectionStatistics;
}

export interface SegmentStore {
  loadManifest(): Promise<SegmentManifest | undefined>;
  saveManifest(manifest: SegmentManifest): Promise<void>;
  writeSegment(segment: SegmentData): Promise<void>;
  readSegment(descriptor: SegmentDescriptor): Promise<SegmentData>;
  removeSegment(descriptor: SegmentDescriptor): Promise<void>;
}

export interface ImmutableSegmentOptions {
  readonly configuration?: IndexConfiguration;
}

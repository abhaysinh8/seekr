import { selectTopK } from '../heap.js';
import { SearchIndex } from '../search-engine.js';
import type {
  AutocompleteOptions,
  FieldValue,
  IndexConfiguration,
  SearchDocument,
  SearchHit,
  SearchOptions,
  SearchResponse,
  SearchSort,
} from '../types.js';
import type {
  ImmutableSegmentOptions,
  SegmentData,
  SegmentDescriptor,
  SegmentManifest,
  SegmentStore,
} from './types.js';

interface LoadedSegment {
  readonly descriptor: SegmentDescriptor;
  readonly index: SearchIndex;
}

const emptyManifest = (): SegmentManifest => ({
  version: 1,
  nextGeneration: 1,
  segments: [],
  tombstones: {},
});

export class ImmutableSegmentIndex {
  #active: SearchIndex;
  #manifest: SegmentManifest;
  readonly #segments: LoadedSegment[];
  readonly #configuration: IndexConfiguration;

  private constructor(
    private readonly store: SegmentStore,
    configuration: IndexConfiguration,
    manifest: SegmentManifest,
    segments: LoadedSegment[],
  ) {
    this.#configuration = configuration;
    this.#active = new SearchIndex(configuration);
    this.#manifest = manifest;
    this.#segments = segments;
  }

  public static async open(
    store: SegmentStore,
    options: ImmutableSegmentOptions = {},
  ): Promise<ImmutableSegmentIndex> {
    const configuration = options.configuration ?? {};
    const manifest = (await store.loadManifest()) ?? emptyManifest();
    const segments: LoadedSegment[] = [];
    for (const descriptor of manifest.segments) {
      const data = await store.readSegment(descriptor);
      const index = new SearchIndex(configuration);
      index.addDocuments(data.documents);
      segments.push({ descriptor, index });
    }
    return new ImmutableSegmentIndex(store, configuration, manifest, segments);
  }

  public get segmentCount(): number {
    return this.#segments.length;
  }

  public get pendingDocumentCount(): number {
    return this.#active.documentCount;
  }

  public async addDocument(document: SearchDocument): Promise<void> {
    if (this.getDocument(document.id) !== undefined) await this.removeDocument(document.id);
    this.#active.addDocument(document);
  }

  public async addDocuments(documents: readonly SearchDocument[]): Promise<void> {
    for (const document of documents) await this.addDocument(document);
  }

  public async removeDocument(documentId: string): Promise<boolean> {
    const removedActive = this.#active.removeDocument(documentId);
    let latestGeneration = 0;
    for (const segment of this.#segments) {
      if (segment.index.getDocument(documentId) !== undefined)
        latestGeneration = Math.max(latestGeneration, segment.descriptor.generation);
    }
    if (!removedActive && latestGeneration === 0) return false;
    if (latestGeneration > 0) {
      this.#manifest = {
        ...this.#manifest,
        tombstones: {
          ...this.#manifest.tombstones,
          [documentId]: Math.max(this.#manifest.tombstones[documentId] ?? 0, latestGeneration),
        },
      };
      await this.store.saveManifest(this.#manifest);
    }
    return true;
  }

  public async updateDocument(document: SearchDocument): Promise<void> {
    await this.removeDocument(document.id);
    this.#active.addDocument(document);
  }

  public getDocument(documentId: string): SearchDocument | undefined {
    const active = this.#active.getDocument(documentId);
    if (active !== undefined) return active;
    for (const segment of [...this.#segments].sort(
      (left, right) => right.descriptor.generation - left.descriptor.generation,
    )) {
      if (!this.isVisible(documentId, segment.descriptor.generation)) continue;
      const document = segment.index.getDocument(documentId);
      if (document !== undefined) return document;
    }
    return undefined;
  }

  public async flush(): Promise<SegmentDescriptor | undefined> {
    const documents = this.#active.getDocuments();
    if (documents.length === 0) return undefined;
    const generation = this.#manifest.nextGeneration;
    const descriptor: SegmentDescriptor = {
      id: `segment-${String(generation).padStart(6, '0')}`,
      generation,
      documentCount: documents.length,
      createdAt: new Date().toISOString(),
    };
    const data = this.createSegmentData(descriptor, this.#active);
    await this.store.writeSegment(data);
    this.#segments.push({ descriptor, index: this.#active });
    this.#active = new SearchIndex(this.#configuration);
    this.#manifest = {
      ...this.#manifest,
      nextGeneration: generation + 1,
      segments: [...this.#manifest.segments, descriptor],
    };
    await this.store.saveManifest(this.#manifest);
    return descriptor;
  }

  public search(query: string, options: SearchOptions = {}): SearchResponse {
    const all: SearchHit[] = [];
    const seen = new Set<string>();
    const sources: Array<{ generation: number; index: SearchIndex }> = [
      { generation: Number.MAX_SAFE_INTEGER, index: this.#active },
      ...[...this.#segments]
        .sort((left, right) => right.descriptor.generation - left.descriptor.generation)
        .map(({ descriptor, index }) => ({ generation: descriptor.generation, index })),
    ];

    for (const source of sources) {
      const response = source.index.search(query, {
        ...options,
        limit: source.index.documentCount,
        offset: 0,
        facets: [],
      });
      for (const hit of response.results) {
        if (seen.has(hit.documentId) || !this.isVisible(hit.documentId, source.generation))
          continue;
        seen.add(hit.documentId);
        all.push(hit);
      }
    }

    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;
    const compare = this.createComparator(options.sort);
    const results = selectTopK(all, limit + offset, compare).slice(offset, offset + limit);
    const facets: Record<string, Record<string, number>> = {};
    for (const field of options.facets ?? []) {
      facets[field] = {};
      for (const hit of all) {
        for (const value of this.scalarValues(this.resolveFieldValue(hit.documentId, field))) {
          const key = String(value);
          facets[field][key] = (facets[field][key] ?? 0) + 1;
        }
      }
    }
    return { results, total: all.length, facets };
  }

  public autocomplete(prefix: string, options: AutocompleteOptions = {}): readonly string[] {
    const frequencies = new Map<string, number>();
    const sources = [
      { generation: Number.MAX_SAFE_INTEGER, index: this.#active },
      ...this.#segments.map(({ descriptor, index }) => ({
        generation: descriptor.generation,
        index,
      })),
    ];
    for (const { generation, index } of sources) {
      for (const term of index.autocomplete(prefix, { limit: Number.MAX_SAFE_INTEGER })) {
        const visibleFrequency = new Set(
          index
            .getPostingList(term)
            .filter(({ documentId }) => this.isVisible(documentId, generation))
            .map(({ documentId }) => documentId),
        ).size;
        if (visibleFrequency > 0)
          frequencies.set(term, (frequencies.get(term) ?? 0) + visibleFrequency);
      }
    }
    return [...frequencies]
      .sort(
        ([leftTerm, left], [rightTerm, right]) => right - left || leftTerm.localeCompare(rightTerm),
      )
      .slice(0, options.limit ?? 10)
      .map(([term]) => term);
  }

  public async compact(): Promise<SegmentDescriptor | undefined> {
    await this.flush();
    const documents = new Map<string, SearchDocument>();
    for (const segment of [...this.#segments].sort(
      (left, right) => left.descriptor.generation - right.descriptor.generation,
    )) {
      for (const document of segment.index.getDocuments()) {
        if (this.isVisible(document.id, segment.descriptor.generation))
          documents.set(document.id, document);
      }
    }

    const previous = [...this.#segments];
    if (documents.size === 0) {
      for (const segment of previous) await this.store.removeSegment(segment.descriptor);
      this.#segments.splice(0);
      this.#manifest = { ...emptyManifest(), nextGeneration: this.#manifest.nextGeneration };
      await this.store.saveManifest(this.#manifest);
      return undefined;
    }

    const generation = this.#manifest.nextGeneration;
    const descriptor: SegmentDescriptor = {
      id: `segment-${String(generation).padStart(6, '0')}`,
      generation,
      documentCount: documents.size,
      createdAt: new Date().toISOString(),
    };
    const index = new SearchIndex(this.#configuration);
    index.addDocuments([...documents.values()]);
    await this.store.writeSegment(this.createSegmentData(descriptor, index));
    for (const segment of previous) await this.store.removeSegment(segment.descriptor);
    this.#segments.splice(0, this.#segments.length, { descriptor, index });
    this.#manifest = {
      version: 1,
      nextGeneration: generation + 1,
      segments: [descriptor],
      tombstones: {},
    };
    await this.store.saveManifest(this.#manifest);
    return descriptor;
  }

  private createSegmentData(descriptor: SegmentDescriptor, index: SearchIndex): SegmentData {
    return {
      version: 1,
      descriptor,
      documents: index.getDocuments(),
      dictionary: index
        .getVocabulary()
        .map((term) => ({ term, postings: index.getPostingList(term) })),
      statistics: index.getCollectionStatistics(),
    };
  }

  private isVisible(documentId: string, generation: number): boolean {
    const tombstone = this.#manifest.tombstones[documentId] ?? 0;
    if (generation <= tombstone) return false;
    if (
      generation !== Number.MAX_SAFE_INTEGER &&
      this.#active.getDocument(documentId) !== undefined
    )
      return false;
    return !this.#segments.some(
      (segment) =>
        segment.descriptor.generation > generation &&
        segment.index.getDocument(documentId) !== undefined &&
        segment.descriptor.generation > tombstone,
    );
  }

  private createComparator(sort: SearchSort | undefined) {
    if (sort === undefined)
      return (left: SearchHit, right: SearchHit) =>
        right.score - left.score || left.documentId.localeCompare(right.documentId);
    return (left: SearchHit, right: SearchHit) => {
      const leftValue = this.scalarValues(this.resolveFieldValue(left.documentId, sort.field))[0];
      const rightValue = this.scalarValues(this.resolveFieldValue(right.documentId, sort.field))[0];
      if (leftValue === undefined && rightValue === undefined)
        return left.documentId.localeCompare(right.documentId);
      if (leftValue === undefined) return 1;
      if (rightValue === undefined) return -1;
      const direction = sort.direction === 'asc' ? 1 : -1;
      return (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0) * direction;
    };
  }

  private resolveFieldValue(documentId: string, field: string): FieldValue | undefined {
    const document = this.getDocument(documentId);
    if (document === undefined) return undefined;
    if (Object.hasOwn(document.metadata ?? {}, field)) return document.metadata?.[field];
    return document.fields[field];
  }

  private scalarValues(value: FieldValue | undefined): Array<string | number | boolean> {
    if (value === undefined || value === null) return [];
    return typeof value === 'object' ? [...value] : [value];
  }
}

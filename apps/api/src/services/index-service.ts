import { SearchIndex } from '@seekr/search-core';
import type {
  AutocompleteOptions,
  CollectionStatistics,
  IndexConfiguration,
  SearchDocument,
  SearchOptions,
  SearchResponse,
  SpellCorrectionResult,
} from '@seekr/search-core';

import { HttpError } from '../errors/http-error.js';

export interface IndexSearchService {
  search(indexId: string, query: string, options: SearchOptions): SearchResponse;
  autocomplete(indexId: string, prefix: string, options: AutocompleteOptions): readonly string[];
  getDocument(indexId: string, documentId: string): SearchDocument | undefined;
  getGeneration(indexId: string): number;
  correctQuery(indexId: string, query: string): SpellCorrectionResult;
}

export interface IndexService extends IndexSearchService {
  createIndex(indexId: string, configuration?: IndexConfiguration): SearchIndex;
  deleteIndex(indexId: string): boolean;
  addDocument(indexId: string, document: SearchDocument): void;
  addDocuments(indexId: string, documents: readonly SearchDocument[]): void;
  removeDocument(indexId: string, documentId: string): boolean;
  getStatistics(indexId: string): CollectionStatistics;
}

export class InMemoryIndexService implements IndexService {
  readonly #indexes = new Map<string, SearchIndex>();
  readonly #generations = new Map<string, number>();

  public createIndex(indexId: string, configuration: IndexConfiguration = {}): SearchIndex {
    if (this.#indexes.has(indexId))
      throw new HttpError(409, 'INDEX_ALREADY_EXISTS', `Index ${indexId} already exists`);
    const index = new SearchIndex(configuration);
    this.#indexes.set(indexId, index);
    this.#generations.set(indexId, 1);
    return index;
  }

  public deleteIndex(indexId: string): boolean {
    this.#generations.delete(indexId);
    return this.#indexes.delete(indexId);
  }

  public addDocument(indexId: string, document: SearchDocument): void {
    this.getIndex(indexId).addDocument(document);
    this.#incrementGeneration(indexId);
  }

  public addDocuments(indexId: string, documents: readonly SearchDocument[]): void {
    this.getIndex(indexId).addDocuments(documents);
    if (documents.length > 0) this.#incrementGeneration(indexId);
  }

  public removeDocument(indexId: string, documentId: string): boolean {
    const removed = this.getIndex(indexId).removeDocument(documentId);
    if (removed) this.#incrementGeneration(indexId);
    return removed;
  }

  public getStatistics(indexId: string): CollectionStatistics {
    return this.getIndex(indexId).getCollectionStatistics();
  }

  public search(indexId: string, query: string, options: SearchOptions): SearchResponse {
    return this.getIndex(indexId).search(query, options);
  }

  public autocomplete(
    indexId: string,
    prefix: string,
    options: AutocompleteOptions,
  ): readonly string[] {
    return this.getIndex(indexId).autocomplete(prefix, options);
  }

  public getDocument(indexId: string, documentId: string): SearchDocument | undefined {
    return this.getIndex(indexId).getDocument(documentId);
  }

  public getGeneration(indexId: string): number {
    this.getIndex(indexId);
    return this.#generations.get(indexId) ?? 1;
  }

  public correctQuery(indexId: string, query: string): SpellCorrectionResult {
    return this.getIndex(indexId).correctQuery(query);
  }

  #incrementGeneration(indexId: string): void {
    this.#generations.set(indexId, (this.#generations.get(indexId) ?? 1) + 1);
  }

  public getIndex(indexId: string): SearchIndex {
    const index = this.#indexes.get(indexId);
    if (index === undefined)
      throw new HttpError(404, 'INDEX_NOT_FOUND', `Index ${indexId} does not exist`);
    return index;
  }
}

import { SearchIndex } from '@seekr/search-core';
import type {
  AutocompleteOptions,
  CollectionStatistics,
  IndexConfiguration,
  SearchDocument,
  SearchOptions,
  SearchResponse,
} from '@seekr/search-core';

import { HttpError } from '../errors/http-error.js';

export interface IndexSearchService {
  search(indexId: string, query: string, options: SearchOptions): SearchResponse;
  autocomplete(indexId: string, prefix: string, options: AutocompleteOptions): readonly string[];
  getDocument(indexId: string, documentId: string): SearchDocument | undefined;
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

  public createIndex(indexId: string, configuration: IndexConfiguration = {}): SearchIndex {
    if (this.#indexes.has(indexId))
      throw new HttpError(409, 'INDEX_ALREADY_EXISTS', `Index ${indexId} already exists`);
    const index = new SearchIndex(configuration);
    this.#indexes.set(indexId, index);
    return index;
  }

  public deleteIndex(indexId: string): boolean {
    return this.#indexes.delete(indexId);
  }

  public addDocument(indexId: string, document: SearchDocument): void {
    this.getIndex(indexId).addDocument(document);
  }

  public addDocuments(indexId: string, documents: readonly SearchDocument[]): void {
    this.getIndex(indexId).addDocuments(documents);
  }

  public removeDocument(indexId: string, documentId: string): boolean {
    return this.getIndex(indexId).removeDocument(documentId);
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

  public getIndex(indexId: string): SearchIndex {
    const index = this.#indexes.get(indexId);
    if (index === undefined)
      throw new HttpError(404, 'INDEX_NOT_FOUND', `Index ${indexId} does not exist`);
    return index;
  }
}

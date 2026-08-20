import { normalizeToken, tokenizeDetailed } from '@seekr/tokenizer';

import { Trie } from './trie.js';
import type {
  AutocompleteOptions,
  CollectionStatistics,
  DocumentStatistics,
  FieldConfiguration,
  FieldValue,
  IndexConfiguration,
  InvertedIndexStorage,
  PostingEntry,
  ScalarValue,
  SearchDocument,
  SearchFilter,
  TokenOffset,
} from './types.js';

interface MutableFieldPosting {
  readonly positions: number[];
  readonly offsets: TokenOffset[];
}

type DocumentPostings = Map<string, MutableFieldPosting>;
type TermPostings = Map<string, DocumentPostings>;

interface ValueBucket {
  readonly value: ScalarValue;
  readonly documentIds: Set<string>;
}

const isScalarArray = (value: FieldValue): value is readonly ScalarValue[] =>
  typeof value === 'object' && value !== null;

const cloneValue = (value: FieldValue): FieldValue => (isScalarArray(value) ? [...value] : value);

const cloneDocument = (document: SearchDocument): SearchDocument => ({
  id: document.id,
  fields: Object.fromEntries(
    Object.entries(document.fields).map(([field, value]) => [field, cloneValue(value)]),
  ),
  ...(document.metadata === undefined
    ? {}
    : {
        metadata: Object.fromEntries(
          Object.entries(document.metadata).map(([field, value]) => [field, cloneValue(value)]),
        ),
      }),
});

const scalarValues = (value: FieldValue | undefined): ScalarValue[] => {
  if (value === undefined || value === null) return [];
  return isScalarArray(value) ? [...value] : [value];
};

const valueKey = (value: ScalarValue): string => `${typeof value}:${String(value)}`;

const fieldText = (value: FieldValue): string =>
  scalarValues(value)
    .map((part) => String(part))
    .join(' ');

export class InMemoryInvertedIndex implements InvertedIndexStorage {
  readonly #documents = new Map<string, SearchDocument>();
  readonly #postings = new Map<string, TermPostings>();
  readonly #documentTerms = new Map<string, Set<string>>();
  readonly #documentLengths = new Map<string, number>();
  readonly #fieldDocumentLengths = new Map<string, Map<string, number>>();
  readonly #fieldTotalLengths = new Map<string, number>();
  readonly #valueIndexes = new Map<string, Map<string, ValueBucket>>();
  readonly #vocabularyByLength = new Map<number, Set<string>>();
  readonly #trie = new Trie();
  #totalDocumentLength = 0;

  public constructor(public readonly configuration: IndexConfiguration = {}) {}

  public get documentCount(): number {
    return this.#documents.size;
  }

  public addDocument(document: SearchDocument): void {
    if (document.id.length === 0) throw new Error('Document id must not be empty');
    if (this.#documents.has(document.id)) this.removeDocument(document.id);

    const stored = cloneDocument(document);
    const terms = new Set<string>();
    const fieldLengths: Record<string, number> = {};
    let documentLength = 0;

    for (const [field, value] of Object.entries(stored.fields)) {
      if (!this.isSearchableField(field)) continue;
      const tokens = tokenizeDetailed(fieldText(value), this.configuration.tokenizer);
      fieldLengths[field] = tokens.length;
      documentLength += tokens.length;
      let lengths = this.#fieldDocumentLengths.get(field);
      if (lengths === undefined) {
        lengths = new Map();
        this.#fieldDocumentLengths.set(field, lengths);
      }
      lengths.set(stored.id, tokens.length);
      this.#fieldTotalLengths.set(field, (this.#fieldTotalLengths.get(field) ?? 0) + tokens.length);

      for (const token of tokens) {
        let termPostings = this.#postings.get(token.token);
        if (termPostings === undefined) {
          termPostings = new Map();
          this.#postings.set(token.token, termPostings);
          this.addVocabularyTerm(token.token);
        }
        let documentPostings = termPostings.get(stored.id);
        if (documentPostings === undefined) {
          documentPostings = new Map();
          termPostings.set(stored.id, documentPostings);
        }
        let posting = documentPostings.get(field);
        if (posting === undefined) {
          posting = { positions: [], offsets: [] };
          documentPostings.set(field, posting);
        }
        posting.positions.push(token.position);
        posting.offsets.push({ startOffset: token.startOffset, endOffset: token.endOffset });
        terms.add(token.token);
      }
    }

    this.#documents.set(stored.id, stored);
    this.#documentTerms.set(stored.id, terms);
    this.#documentLengths.set(stored.id, documentLength);
    this.#totalDocumentLength += documentLength;
    this.indexStructuredValues(stored);
  }

  public addDocuments(documents: readonly SearchDocument[]): void {
    for (const document of documents) this.addDocument(document);
  }

  public removeDocument(documentId: string): boolean {
    const document = this.#documents.get(documentId);
    if (document === undefined) return false;

    for (const term of this.#documentTerms.get(documentId) ?? []) {
      const termPostings = this.#postings.get(term);
      termPostings?.delete(documentId);
      if (termPostings?.size === 0) {
        this.#postings.delete(term);
        this.removeVocabularyTerm(term);
      }
    }

    const documentLength = this.#documentLengths.get(documentId) ?? 0;
    this.#totalDocumentLength -= documentLength;
    for (const [field, lengths] of this.#fieldDocumentLengths) {
      const length = lengths.get(documentId);
      if (length !== undefined) {
        this.#fieldTotalLengths.set(field, (this.#fieldTotalLengths.get(field) ?? 0) - length);
        lengths.delete(documentId);
        if (lengths.size === 0) {
          this.#fieldDocumentLengths.delete(field);
          this.#fieldTotalLengths.delete(field);
        }
      }
    }

    this.removeStructuredValues(document);
    this.#documents.delete(documentId);
    this.#documentTerms.delete(documentId);
    this.#documentLengths.delete(documentId);
    return true;
  }

  public updateDocument(document: SearchDocument): void {
    this.removeDocument(document.id);
    this.addDocument(document);
  }

  public getDocument(documentId: string): SearchDocument | undefined {
    const document = this.#documents.get(documentId);
    return document === undefined ? undefined : cloneDocument(document);
  }

  public getDocuments(): readonly SearchDocument[] {
    return [...this.#documents.values()].map(cloneDocument);
  }

  public getDocumentIds(): ReadonlySet<string> {
    return new Set(this.#documents.keys());
  }

  public searchTerm(term: string, fields?: readonly string[]): readonly PostingEntry[] {
    const normalized = normalizeToken(term, this.configuration.tokenizer);
    const allowedFields = fields === undefined ? undefined : new Set(fields);
    return this.flattenPostings(normalized).filter(
      ({ field }) => allowedFields === undefined || allowedFields.has(field),
    );
  }

  public getPostingList(term: string): readonly PostingEntry[] {
    const normalized = normalizeToken(term, this.configuration.tokenizer);
    return this.flattenPostings(normalized);
  }

  public getDocumentFrequency(term: string, field?: string): number {
    const normalized = normalizeToken(term, this.configuration.tokenizer);
    const postings = this.#postings.get(normalized);
    if (postings === undefined) return 0;
    if (field === undefined) return postings.size;
    let count = 0;
    for (const documentPostings of postings.values()) {
      if (documentPostings.has(field)) count += 1;
    }
    return count;
  }

  public getCollectionStatistics(): CollectionStatistics {
    const fieldDocumentCounts: Record<string, number> = {};
    const fieldTotalLengths: Record<string, number> = {};
    const fieldAverageLengths: Record<string, number> = {};

    for (const [field, lengths] of this.#fieldDocumentLengths) {
      const total = this.#fieldTotalLengths.get(field) ?? 0;
      fieldDocumentCounts[field] = lengths.size;
      fieldTotalLengths[field] = total;
      fieldAverageLengths[field] = lengths.size === 0 ? 0 : total / lengths.size;
    }

    return {
      documentCount: this.#documents.size,
      totalDocumentLength: this.#totalDocumentLength,
      averageDocumentLength:
        this.#documents.size === 0 ? 0 : this.#totalDocumentLength / this.#documents.size,
      vocabularySize: this.#postings.size,
      fieldDocumentCounts,
      fieldTotalLengths,
      fieldAverageLengths,
    };
  }

  public getDocumentStatistics(documentId: string): DocumentStatistics | undefined {
    if (!this.#documents.has(documentId)) return undefined;
    const fieldLengths: Record<string, number> = {};
    for (const [field, lengths] of this.#fieldDocumentLengths) {
      const length = lengths.get(documentId);
      if (length !== undefined) fieldLengths[field] = length;
    }
    return {
      documentId,
      length: this.#documentLengths.get(documentId) ?? 0,
      fieldLengths,
    };
  }

  public getFieldPosting(
    term: string,
    documentId: string,
    field: string,
  ): PostingEntry | undefined {
    const posting = this.#postings.get(term)?.get(documentId)?.get(field);
    return posting === undefined
      ? undefined
      : {
          documentId,
          field,
          termFrequency: posting.positions.length,
          positions: [...posting.positions],
          offsets: posting.offsets.map((offset) => ({ ...offset })),
        };
  }

  public getFieldsForTerm(term: string, documentId: string): readonly string[] {
    return [...(this.#postings.get(term)?.get(documentId)?.keys() ?? [])];
  }

  public getVocabularyCandidates(minLength: number, maxLength: number): readonly string[] {
    const candidates: string[] = [];
    for (let length = minLength; length <= maxLength; length += 1) {
      candidates.push(...(this.#vocabularyByLength.get(length) ?? []));
    }
    return candidates;
  }

  public getVocabulary(): readonly string[] {
    return [...this.#postings.keys()].sort();
  }

  public autocomplete(prefix: string, options: AutocompleteOptions = {}): readonly string[] {
    const normalized = normalizeToken(prefix, {
      ...this.configuration.tokenizer,
      punctuation: 'remove',
    });
    if (normalized.length === 0) return [];
    return this.#trie.suggest(
      normalized,
      options.limit ?? 10,
      (term) => this.#postings.get(term)?.size ?? 0,
    );
  }

  public getFieldConfiguration(field: string): FieldConfiguration | undefined {
    return this.configuration.fields?.[field];
  }

  public getFieldValue(documentId: string, field: string): FieldValue | undefined {
    const document = this.#documents.get(documentId);
    if (document === undefined) return undefined;
    if (Object.hasOwn(document.metadata ?? {}, field)) return document.metadata?.[field];
    return document.fields[field];
  }

  public filterCandidates(filter: SearchFilter): ReadonlySet<string> {
    const configuration = this.configuration.fields?.[filter.field];
    if (configuration?.filterable !== true)
      throw new Error(`Field "${filter.field}" is not configured as filterable`);

    const buckets = this.#valueIndexes.get(filter.field) ?? new Map<string, ValueBucket>();
    const matching = new Set<string>();
    const addBucket = (bucket: ValueBucket | undefined) => {
      for (const documentId of bucket?.documentIds ?? []) matching.add(documentId);
    };
    const values = scalarValues(filter.value);

    switch (filter.operator) {
      case 'equals':
      case 'in':
        for (const value of values) addBucket(buckets.get(valueKey(value)));
        break;
      case 'notEquals':
      case 'notIn': {
        const excluded = new Set<string>();
        for (const value of values) {
          for (const documentId of buckets.get(valueKey(value))?.documentIds ?? [])
            excluded.add(documentId);
        }
        for (const documentId of this.#documents.keys()) {
          if (!excluded.has(documentId)) matching.add(documentId);
        }
        break;
      }
      case 'exists': {
        const shouldExist = filter.value === undefined ? true : Boolean(filter.value);
        const existing = new Set<string>();
        for (const bucket of buckets.values()) {
          for (const documentId of bucket.documentIds) existing.add(documentId);
        }
        for (const documentId of this.#documents.keys()) {
          if (existing.has(documentId) === shouldExist) matching.add(documentId);
        }
        break;
      }
      default: {
        const expected = values[0];
        if (expected === undefined) break;
        for (const bucket of buckets.values()) {
          if (this.compareRange(bucket.value, expected, filter.operator)) addBucket(bucket);
        }
      }
    }
    return matching;
  }

  public facet(field: string, candidates: ReadonlySet<string>): Readonly<Record<string, number>> {
    if (this.configuration.fields?.[field]?.facetable !== true)
      throw new Error(`Field "${field}" is not configured as facetable`);
    const counts: Record<string, number> = {};
    for (const bucket of this.#valueIndexes.get(field)?.values() ?? []) {
      let count = 0;
      for (const documentId of bucket.documentIds) if (candidates.has(documentId)) count += 1;
      if (count > 0) counts[String(bucket.value)] = count;
    }
    return counts;
  }

  public clear(): void {
    this.#documents.clear();
    this.#postings.clear();
    this.#documentTerms.clear();
    this.#documentLengths.clear();
    this.#fieldDocumentLengths.clear();
    this.#fieldTotalLengths.clear();
    this.#valueIndexes.clear();
    this.#vocabularyByLength.clear();
    this.#trie.clear();
    this.#totalDocumentLength = 0;
  }

  private isSearchableField(field: string): boolean {
    const configuredFields = this.configuration.fields;
    if (configuredFields === undefined || Object.keys(configuredFields).length === 0) return true;
    return configuredFields[field]?.searchable === true;
  }

  private flattenPostings(term: string): PostingEntry[] {
    const entries: PostingEntry[] = [];
    for (const [documentId, documentPostings] of this.#postings.get(term) ?? []) {
      for (const [field, posting] of documentPostings) {
        entries.push({
          documentId,
          field,
          termFrequency: posting.positions.length,
          positions: [...posting.positions],
          offsets: posting.offsets.map((offset) => ({ ...offset })),
        });
      }
    }
    return entries.sort(
      (left, right) =>
        left.documentId.localeCompare(right.documentId) || left.field.localeCompare(right.field),
    );
  }

  private addVocabularyTerm(term: string): void {
    this.#trie.insert(term);
    const length = Array.from(term).length;
    let bucket = this.#vocabularyByLength.get(length);
    if (bucket === undefined) {
      bucket = new Set();
      this.#vocabularyByLength.set(length, bucket);
    }
    bucket.add(term);
  }

  private removeVocabularyTerm(term: string): void {
    this.#trie.remove(term);
    const length = Array.from(term).length;
    const bucket = this.#vocabularyByLength.get(length);
    bucket?.delete(term);
    if (bucket?.size === 0) this.#vocabularyByLength.delete(length);
  }

  private indexStructuredValues(document: SearchDocument): void {
    for (const [field, configuration] of Object.entries(this.configuration.fields ?? {})) {
      if (
        configuration.filterable !== true &&
        configuration.facetable !== true &&
        configuration.sortable !== true
      )
        continue;
      for (const value of scalarValues(this.resolveFieldValue(document, field))) {
        let index = this.#valueIndexes.get(field);
        if (index === undefined) {
          index = new Map();
          this.#valueIndexes.set(field, index);
        }
        const key = valueKey(value);
        let bucket = index.get(key);
        if (bucket === undefined) {
          bucket = { value, documentIds: new Set() };
          index.set(key, bucket);
        }
        bucket.documentIds.add(document.id);
      }
    }
  }

  private removeStructuredValues(document: SearchDocument): void {
    for (const [field, index] of this.#valueIndexes) {
      for (const value of scalarValues(this.resolveFieldValue(document, field))) {
        const key = valueKey(value);
        const bucket = index.get(key);
        bucket?.documentIds.delete(document.id);
        if (bucket?.documentIds.size === 0) index.delete(key);
      }
      if (index.size === 0) this.#valueIndexes.delete(field);
    }
  }

  private resolveFieldValue(document: SearchDocument, field: string): FieldValue | undefined {
    if (Object.hasOwn(document.metadata ?? {}, field)) return document.metadata?.[field];
    return document.fields[field];
  }

  private compareRange(
    left: ScalarValue,
    right: ScalarValue,
    operator: SearchFilter['operator'],
  ): boolean {
    if (typeof left !== typeof right || (typeof left !== 'number' && typeof left !== 'string'))
      return false;
    switch (operator) {
      case 'greaterThan':
        return left > right;
      case 'greaterThanOrEqual':
        return left >= right;
      case 'lessThan':
        return left < right;
      case 'lessThanOrEqual':
        return left <= right;
      default:
        return false;
    }
  }
}

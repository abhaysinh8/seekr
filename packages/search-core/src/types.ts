import type { TokenizeOptions } from '@seekr/tokenizer';
import type { SynonymRule } from './synonyms.js';

export type ScalarValue = string | number | boolean;
export type FieldValue = ScalarValue | readonly ScalarValue[] | null;

export interface SearchDocument {
  readonly id: string;
  readonly fields: Readonly<Record<string, FieldValue>>;
  readonly metadata?: Readonly<Record<string, FieldValue>>;
}

export interface FieldConfiguration {
  readonly searchable?: boolean;
  readonly filterable?: boolean;
  readonly facetable?: boolean;
  readonly sortable?: boolean;
  readonly weight?: number;
}

export interface IndexConfiguration {
  readonly fields?: Readonly<Record<string, FieldConfiguration>>;
  readonly tokenizer?: TokenizeOptions;
  readonly synonyms?: readonly SynonymRule[];
  readonly synonymPenalty?: number;
  readonly rankingRules?: readonly RankingRule[];
}

export type RankingRule =
  | {
      readonly field: string;
      readonly condition: 'equals' | 'notEquals' | 'exists';
      readonly value?: ScalarValue;
      readonly boost: number;
    }
  | {
      readonly field: string;
      readonly strategy: 'recency';
      readonly halfLifeDays: number;
      readonly weight?: number;
    };

export interface RankingRuleContribution {
  readonly field: string;
  readonly rule: 'boost' | 'recency';
  readonly contribution: number;
}

export interface TokenOffset {
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface PostingEntry {
  readonly documentId: string;
  readonly field: string;
  readonly termFrequency: number;
  readonly positions: readonly number[];
  readonly offsets: readonly TokenOffset[];
}

export interface DocumentStatistics {
  readonly documentId: string;
  readonly length: number;
  readonly fieldLengths: Readonly<Record<string, number>>;
}

export interface CollectionStatistics {
  readonly documentCount: number;
  readonly totalDocumentLength: number;
  readonly averageDocumentLength: number;
  readonly vocabularySize: number;
  readonly fieldDocumentCounts: Readonly<Record<string, number>>;
  readonly fieldTotalLengths: Readonly<Record<string, number>>;
  readonly fieldAverageLengths: Readonly<Record<string, number>>;
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'exists';

export interface SearchFilter {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value?: FieldValue;
}

export interface SearchSort {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

export interface HighlightOptions {
  readonly fields?: readonly string[];
  readonly preTag?: string;
  readonly postTag?: string;
}

export interface TypoToleranceOptions {
  readonly maxDistance?: number;
  readonly prefixLength?: number;
}

export interface SearchOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly ranking?: 'bm25' | 'tfidf';
  readonly fields?: readonly string[];
  readonly filters?: readonly SearchFilter[];
  readonly sort?: SearchSort;
  readonly facets?: readonly string[];
  readonly typoTolerance?: boolean | TypoToleranceOptions;
  readonly proximityBoost?: boolean;
  readonly maxProximityDistance?: number;
  readonly highlights?: boolean | HighlightOptions;
  readonly explain?: boolean;
  readonly debug?: boolean;
  readonly k1?: number;
  readonly b?: number;
}

export interface TermScoreDebug {
  readonly queryTerm: string;
  readonly matchedTerm: string;
  readonly field: string;
  readonly tf: number;
  readonly df: number;
  readonly idf: number;
  readonly documentLength: number;
  readonly averageDocumentLength: number;
  readonly fieldWeight: number;
  readonly typoPenalty: number;
  readonly synonymPenalty?: number;
  readonly proximityBoost: number;
  readonly contribution: number;
  readonly bm25Score?: number;
  readonly editDistance?: number;
}

export interface PhraseMatchDebug {
  readonly phrase: string;
  readonly field: string;
  readonly positions: readonly number[];
}

export interface ScoreExplanation {
  readonly finalScore: number;
  readonly terms: readonly TermScoreDebug[];
  readonly phrases: readonly PhraseMatchDebug[];
  readonly proximityBoost: number;
  readonly rankingRules: readonly RankingRuleContribution[];
}

export interface FieldContribution {
  readonly field: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export interface SearchHit {
  readonly documentId: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
  readonly matchedFields: readonly string[];
  readonly fieldContributions: readonly FieldContribution[];
  readonly highlights?: Readonly<Record<string, string>>;
  readonly explanation?: ScoreExplanation;
  readonly debug?: readonly TermScoreDebug[];
}

export interface SearchResponse {
  readonly results: readonly SearchHit[];
  readonly total: number;
  readonly facets: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface AutocompleteOptions {
  readonly limit?: number;
}

export interface InvertedIndexStorage {
  addDocument(document: SearchDocument): void;
  addDocuments(documents: readonly SearchDocument[]): void;
  removeDocument(documentId: string): boolean;
  updateDocument(document: SearchDocument): void;
  getDocument(documentId: string): SearchDocument | undefined;
  searchTerm(term: string, fields?: readonly string[]): readonly PostingEntry[];
  getPostingList(term: string): readonly PostingEntry[];
  getDocumentFrequency(term: string, field?: string): number;
  getCollectionStatistics(): CollectionStatistics;
  clear(): void;
}

export interface SeekrSearchIndex extends InvertedIndexStorage {
  search(query: string, options?: SearchOptions): SearchResponse;
  autocomplete(prefix: string, options?: AutocompleteOptions): readonly string[];
}

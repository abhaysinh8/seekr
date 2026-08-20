export interface IndexFieldView {
  readonly type: 'text' | 'string' | 'number' | 'boolean' | 'date';
  readonly searchable: boolean;
  readonly filterable: boolean;
  readonly facetable: boolean;
  readonly sortable: boolean;
  readonly weight: number;
}

export interface IndexView {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly schema: { readonly fields: Readonly<Record<string, IndexFieldView>> };
  readonly status: 'ready' | 'indexing' | 'error';
  readonly documentCount: number;
  readonly termCount: number;
  readonly storageSizeBytes: number | null;
  readonly lastIndexedAt: string | null;
  readonly createdAt: string;
}

export interface SearchExplanationTerm {
  readonly queryTerm: string;
  readonly matchedTerm: string;
  readonly field: string;
  readonly tf: number;
  readonly df: number;
  readonly idf: number;
  readonly documentLength: number;
  readonly averageDocumentLength: number;
  readonly bm25Score?: number;
  readonly fieldWeight: number;
  readonly typoPenalty: number;
  readonly proximityBoost: number;
  readonly contribution: number;
}

export interface SearchHitView {
  readonly documentId: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
  readonly matchedFields: readonly string[];
  readonly highlights?: Readonly<Record<string, string>>;
  readonly document?: {
    readonly id: string;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
  readonly explanation?: {
    readonly finalScore: number;
    readonly proximityBoost: number;
    readonly terms: readonly SearchExplanationTerm[];
  };
}

export interface SearchResponseView {
  readonly searchId: string;
  readonly query: string;
  readonly processingTimeMs: number;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hits: readonly SearchHitView[];
  readonly facets: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly requestId: string;
}

export { escapeHtml, highlightField } from './highlight.js';
export { MinHeap, selectTopK, type Comparator } from './heap.js';
export { InMemoryInvertedIndex } from './inverted-index.js';
export { defaultMaximumEditDistance, levenshteinDistance } from './levenshtein.js';
export { parseQuery, type ParsedPhrase, type ParsedQuery } from './query-parser.js';
export {
  BM25RankingStrategy,
  inverseDocumentFrequency,
  smoothedInverseDocumentFrequency,
  TFIDFRankingStrategy,
  type BM25Options,
  type RankingInput,
  type RankingScore,
  type RankingStrategy,
} from './ranking.js';
export { SearchIndex } from './search-engine.js';
export { FileSystemSegmentStore } from './segments/file-system-store.js';
export { ImmutableSegmentIndex } from './segments/immutable-segment-index.js';
export { MemorySegmentStore } from './segments/memory-store.js';
export type * from './segments/types.js';
export { Trie } from './trie.js';
export type * from './types.js';

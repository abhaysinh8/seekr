# `@seekr/search-core`

Seekr's dependency-free lexical search engine. It implements token-based indexing, retrieval, ranking, filters, facets, autocomplete, typo tolerance, phrase/proximity matching, highlighting, explanations, and a simplified immutable-segment persistence architecture without wrapping an external search product.

## Inverted index

`SearchIndex` is the default in-memory implementation. Documents may contain arbitrary fields:

```ts
import { SearchIndex } from '@seekr/search-core';

const index = new SearchIndex({
  fields: {
    title: { searchable: true, weight: 3 },
    body: { searchable: true, weight: 1 },
    category: { filterable: true, facetable: true },
    price: { filterable: true, sortable: true },
  },
});

index.addDocument({
  id: 'doc-1',
  fields: {
    title: 'Machine Learning',
    body: 'Introduction to machine learning algorithms',
  },
  metadata: { category: 'education', price: 49 },
});
```

The dictionary is a `Map<term, posting list>`. A posting stores document id, field, term frequency, positions, and source offsets. Reverse per-document term sets make update and deletion proportional to that document's indexed terms; empty posting lists and Trie vocabulary entries are removed immediately.

### Complexity

Let `T` be the number of analyzed tokens in a document, `U` its unique terms, `P` the returned postings, `n` matching candidates, and `k = offset + limit`.

| Operation                       | Expected complexity                               |
| ------------------------------- | ------------------------------------------------- |
| Index document                  | `O(T)` average Map insertion time                 |
| Delete/update old document      | `O(U)` posting removals                           |
| Term existence/frequency lookup | `O(1)` average                                    |
| Posting-list retrieval          | `O(P)` to materialize returned postings           |
| Ranked retrieval with heap      | `O(n log k)` instead of full `O(n log n)` sorting |

Ordinary term lookup never scans stored documents.

## Ranking

BM25 is the default. TF-IDF remains selectable with `ranking: 'tfidf'`.

### TF-IDF

Seekr uses logarithmic term frequency and smoothed inverse document frequency:

```text
tf(t,d)  = 1 + log(rawFrequency)
idf(t)   = log((N + 1) / (df(t) + 1)) + 1
score    = tf × idf
```

The package also exports the unsmoothed `log(N / df)` helper for mathematical comparison.

### BM25

For each query term and field:

```text
idf(t) = log(1 + (N - df + 0.5) / (df + 0.5))

score(t,d) = idf(t) ×
             tf × (k1 + 1)
             --------------------------------------------
             tf + k1 × (1 - b + b × fieldLength / avgFieldLength)
```

Defaults are `k1 = 1.2` and `b = 0.75`. Field weights multiply each field's term contribution before document aggregation; Seekr does not multiply an already-aggregated document score. This preserves field-specific frequency and length normalization.

```ts
index.search('machine learning', {
  ranking: 'bm25',
  fields: ['title'],
  limit: 10,
  offset: 0,
});
```

## Filters, sorting, and facets

Filters are structured data—not executable predicates—and are combined with AND semantics:

```ts
index.search('headphones', {
  filters: [
    { field: 'brand', operator: 'in', value: ['Sony', 'Bose'] },
    { field: 'price', operator: 'lessThan', value: 300 },
  ],
  sort: { field: 'price', direction: 'asc' },
  facets: ['brand', 'category'],
});
```

Supported operators are `equals`, `notEquals`, `in`, `notIn`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, and `exists`. Equality uses typed value-to-document buckets. Range filters iterate distinct indexed values instead of every document. Facets count intersections between matching document ids and the same value buckets. An empty query is permitted when at least one filter is supplied.

## Autocomplete and typo tolerance

The vocabulary Trie supports `insert`, `remove`, `contains`, `startsWith`, and `suggest`. Prefix traversal costs `O(p)` for prefix length `p`; collecting and ordering suggestions costs `O(s log s)` for the terms below that prefix. Suggestions use document frequency and lexical order. Vocabulary terms disappear when their final posting is removed.

```ts
index.autocomplete('mach', { limit: 5 });
index.search('machien learning', { typoTolerance: true });
```

Levenshtein distance uses dynamic programming in `O(mn)` time and `O(min(m,n))` memory. Fuzzy candidate generation checks only vocabulary length buckets within the allowed edit distance and, by default, requires the first code point to match. Terms of length four or less allow distance one; longer terms allow distance two. Exact terms bypass fuzzy expansion, and fuzzy contributions receive an edit-distance penalty.

## Phrases, proximity, highlighting, and explanations

Quoted phrases are resolved from posting positions and must occur adjacently, in order, within one field. Original document text is not rescanned. Normal multi-term queries may opt into a modest same-field proximity boost:

```ts
index.search('"machine learning" algorithms', {
  proximityBoost: true,
  highlights: { preTag: '<mark>', postTag: '</mark>' },
  explain: true,
});
```

Highlight ranges come from tokenizer offsets. Stored text is HTML-escaped before simple validated highlight tags are inserted, preventing source content from creating executable markup. Stored documents are never mutated. Explanations are omitted unless requested and include TF, DF, IDF, field length, average field length, field weight, typo penalty, BM25 contribution, phrase positions, and proximity contribution.

## Immutable segments

`ImmutableSegmentIndex` accumulates documents in memory and flushes them through a `SegmentStore`:

```text
index/
├── manifest.json
└── segments/
    ├── segment-000001/segment.json
    └── segment-000002/segment.json
```

Each immutable segment contains documents, dictionary/postings, and statistics. The manifest orders generations and persists tombstones. Searches run against every loaded segment and merge visible results; newer generations shadow older document versions. `compact()` writes current visible documents into one new segment and removes superseded segment directories.

Immutability improves durability because completed files are never edited in place, concurrency because readers can retain stable segment snapshots, and incremental indexing because only the active buffer must be flushed. This is intentionally a small, understandable design—not a Lucene clone or distributed system.

```ts
const store = new FileSystemSegmentStore('./index');
const segmented = await ImmutableSegmentIndex.open(store, { configuration });
await segmented.addDocument(document);
await segmented.flush();
await segmented.compact();
```

Configuration is supplied when opening an index so executable tokenizer strategies are not serialized as data.

## Benchmarks

Run deterministic synthetic fixtures comparing full sorting, heap top-K, exact ranked retrieval, and fuzzy retrieval:

```bash
pnpm --filter @seekr/search-core benchmark
```

Benchmarks are directional developer diagnostics, not cross-machine performance guarantees.

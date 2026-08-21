# Search guide

## Schema and indexing

An index defines arbitrary named fields. `searchable` fields are tokenized and receive posting lists; `filterable` fields receive exact-value lookup structures; `facetable` fields may be counted in a response; `sortable` fields may order results. A positive `weight` adjusts that field's per-term BM25 or TF-IDF contribution. Documents may omit configured fields. Unknown fields and incompatible scalar types are rejected at ingestion.

```json
{
  "fields": {
    "title": {
      "type": "text",
      "searchable": true,
      "filterable": false,
      "facetable": false,
      "sortable": false,
      "weight": 3
    },
    "price": {
      "type": "number",
      "searchable": false,
      "filterable": true,
      "facetable": false,
      "sortable": true,
      "weight": 1
    }
  }
}
```

## Querying

`POST /v1/indexes/:indexId/search` accepts `query`, `limit`, `offset`, optional target `fields`, `ranking` (`bm25` by default or `tfidf`), filters, facets, sort, typo tolerance, spell correction, highlights, proximity boost, and explain mode. An empty query is allowed for pure filtering. Quoted text is a same-field, adjacent-position phrase: `"machine learning" systems` requires the phrase and also scores `systems`.

Filters are structured data—never executable expressions. Operators are `equals`, `notEquals`, `in`, `notIn`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, and `exists`. Facet counts are calculated over the filtered candidate set before page slicing. Sorting defaults to relevance; explicit field sort requires a sortable field.

Autocomplete uses the vocabulary Trie and document frequency. `typoTolerance` expands candidate terms through length buckets and edit distance, penalizing fuzzy matches so exact matches remain stronger. `spellCorrection` is more conservative: Seekr retries a zero-result query only when a high-confidence vocabulary correction exists. Quoted phrases are preserved. Synonym rules are query-time, non-recursive expansions; directional and bidirectional rules are supported, and exact terms retain a score advantage.

Highlights use tokenizer source offsets, merge overlapping spans, escape stored text, then insert validated tags. Explain mode returns per-term/per-field TF, DF, IDF, lengths, BM25 score, field weight, typo/synonym penalties, proximity contribution, ranking-rule contribution, and final score. Both features are opt-in because they add response work and bytes.

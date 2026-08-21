# Performance and evaluation

Run `pnpm benchmark`. `SEEKR_BENCHMARK_SIZES=1000,10000,100000` controls synthetic collection sizes. The suite measures tokenization, indexing throughput, memory, term lookup, single/multi-term BM25, top-K, filtering, facets, autocomplete, fuzzy matching, and segment persistence/restoration. It reports average, p50, p95, and p99 and writes `benchmark-results.json`. Results depend on CPU, memory, Node version, corpus, schema, and warmup; do not compare machines without recording those variables.

Run `pnpm loadtest` against a live API with `SEEKR_LOADTEST_URL`, `SEEKR_LOADTEST_INDEX_ID`, optional API key, concurrency, and duration. Search, autocomplete, mixed, and analytics scenarios produce request rate, errors, and latency percentiles.

Relevance evaluation helpers compute Precision@K, Recall@K, MRR, DCG, and NDCG from judged fixtures and can compare BM25, TF-IDF, field weights, typo tolerance, synonyms, and custom ranking rules. Performance and relevance are separate dimensions; improve one only after checking the other.

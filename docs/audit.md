# Architecture and code-quality audit

This audit was performed after the Phase 16–51 implementation. Priorities are P0 correctness/security, P1 architecture, P2 performance, and P3 developer experience.

## Fixed

- P0: index scopes were checked but resource ownership was not uniformly enforced. Index, recommendation, analytics, crawl source/job, and background-job access now resolve back to the authenticated project.
- P0: crawler SSRF checks covered literal IPs but not DNS rebinding. Page and robots requests now resolve every hop and reject private, loopback, link-local, reserved, documentation, and multicast addresses; redirects remain manual.
- P0: the crawler Docker target launched an export-only module and exited. It now runs a durable PostgreSQL job-claim loop and indexes through the authenticated API.
- P0: API/crawler production images copied the compiler and entire development workspace. Runtime stages now use production dependencies, compiled output, and the unprivileged `node` account.
- P0: Compose initialized only migration 001. It now mounts the ordered migration directory.
- P1: SDK required a single-document read operation missing from the REST surface. A direct keyed lookup was added to both catalog implementations and API.
- P1: CLI snapshot commands pointed at no server routes. Authenticated snapshot create/list/restore/delete orchestration now materializes immutable segments, checks checksums, and rebuilds the target live index.
- P1: the overview still described bootstrap/pending algorithms and showed static statuses. It now loads real index, document, readiness, latency, query, zero-result, and activity values.
- P2: randomized deterministic invariants now exercise heap ordering and posting/statistic consistency across repeated updates/deletes.

## Remaining debt

- P1: the API's hot search state is in process and reconstructed from PostgreSQL on restart. Segment persistence is proven and used for snapshots, but normal ingestion does not yet flush/merge segments continuously. This is the next architectural milestone.
- P1: reindex/bulk jobs execute in the API process because a separate worker cannot mutate that process's in-memory index safely. Moving the hot index fully behind durable segments is prerequisite to independent index workers and API replicas.
- P1: snapshot restore reconciles source documents outside one PostgreSQL transaction. Checksums/files are crash safe, but database rollback for a mid-restore infrastructure failure needs a repository-level transaction.
- P2: query-suggestion signals are in memory and not replayed from persisted analytics at startup.
- P2: cross-segment search currently scores per segment and merges; globally exact BM25 statistics require a shared segment-statistics layer before segments become the hot API path.
- P2: offset pagination retains `offset + limit` heap entries; cursor/search-after pagination would bound deep-page work better.
- P3: generated OpenAPI and CLI shell completions are not yet included.

Large modules in the search engine remain deliberately explicit where splitting them would obscure candidate/scoring flow. Future refactors should extract cohesive phrase/fuzzy/explanation collaborators only with equivalence tests and benchmark evidence.

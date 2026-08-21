# Contributing to Seekr

Thank you for helping build an understandable, self-hosted search engine. Be kind, keep core algorithms visible, and never replace an internal algorithm with a hosted service.

## Development

```bash
pnpm install
pnpm dev:services
pnpm db:migrate
pnpm dev
```

Before a pull request run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Search performance changes should also run `pnpm benchmark`; include machine/runtime/corpus details, not only a percentage. Tests must be deterministic, clean temporary files, and assert behavior rather than inflate coverage.

Add an ordered migration instead of editing a released SQL file. Keep transport validation in shared Zod schemas, orchestration in applications, token processing in `packages/tokenizer`, retrieval/ranking in `packages/search-core`, and recommendation math in `packages/recommendation-core`.

## Extension points

- Ranking strategy: implement the `RankingStrategy` contract, keep score math independent of Fastify, add equation/corner-case tests and explain fields, then expose a validated selection.
- Tokenizer stage: create one focused module that preserves mapped offsets, compose it in the pipeline, and test Unicode and source spans.
- Recommendation algorithm: implement against sparse vectors/contracts, normalize scores before hybrid composition, invalidate affected neighbor caches, and add cold-start tests.
- API endpoint: define a bounded shared schema, add a thin route and reusable service, authorize project ownership/scopes, return request IDs/structured errors, and add Fastify injection tests.

## Pull requests

Keep changes reviewable and explain algorithmic complexity and compatibility impact. Do not commit `.env`, API keys, database volumes, benchmark output, coverage, or generated builds. Screenshots are helpful for dashboard changes, but the implementation must still handle empty/loading/error states without fake data.

Good first issues grounded in the current code include: expose snapshot-manager create/list/restore through authenticated API jobs; add cache hit/miss Prometheus counters; rebuild query suggestions from persisted analytics on startup; add language-specific stop-word packs; add CLI shell-completion generation; and create a Postgres-backed integration-test fixture that verifies migrations on both empty and populated databases.

# HTTP API

The Fastify API validates every public payload with shared Zod schemas, caps request bodies at 1 MiB, and returns an `x-request-id` header. Error bodies include `statusCode`, `code`, `message`, and `requestId`; validation failures also include structured field details.

Authenticate `/v1` operations with `Authorization: Bearer skr_...`. Keys are project scoped and may carry `search`, `indexes:read`, `indexes:write`, `documents:read`, `documents:write`, and `analytics:read`. The first key for a project is a one-time bootstrap; later creation requires an authenticated key with write scope. Secrets are never returned by list operations.

## Projects, indexes, and documents

- `POST /v1/projects` creates a project.
- `POST /v1/indexes`, `GET /v1/indexes`, `GET/DELETE /v1/indexes/:indexId` manage index lifecycle.
- `PUT /v1/indexes/:indexId/schema` validates and reindexes existing documents.
- `POST /v1/indexes/:indexId/documents` upserts one external document.
- `POST /v1/indexes/:indexId/documents/bulk` upserts up to 1,000; large production batches return a job.
- `GET /v1/indexes/:indexId/documents` paginates; `GET/DELETE /v1/indexes/:indexId/documents/:documentId` reads or removes one.
- `POST /v1/indexes/:indexId/reindex` rebuilds the live index.

Schemas support text, string, number, boolean, and date fields plus searchable/filterable/facetable/sortable flags, field weights, synonyms, and safe custom ranking rules. Documents contain external `id`, arbitrary `fields`, and `metadata`; values must match the configured schema.

## Search

`POST /v1/indexes/:indexId/search` accepts the query plus ranking and retrieval options. The current limits are a 2,048-character query, 100 results, offset 10,000, 32 selected fields, 20 filters, and 20 facets.

```json
{
  "query": "\"wireless headphones\"",
  "ranking": "bm25",
  "limit": 20,
  "offset": 0,
  "fields": ["title", "description"],
  "filters": [{ "field": "brand", "operator": "in", "value": ["Sony", "Bose"] }],
  "facets": ["brand"],
  "typoTolerance": true,
  "highlight": true,
  "explain": false
}
```

Ranking, filters, facets, phrase handling, fuzzy matching, highlighting, and explanations are delegated directly to `@seekr/search-core`; the HTTP layer does not reimplement them.

`POST /v1/indexes/:indexId/autocomplete` accepts `{ "prefix": "head", "limit": 10 }`.

## Crawl sources

- `POST /v1/sources` creates a durable source in PostgreSQL.
- `GET /v1/sources?projectId=<uuid>` lists sources, optionally by project.
- `GET /v1/sources/:sourceId` reads a source.
- `DELETE /v1/sources/:sourceId` deletes a source and its jobs.
- `POST /v1/sources/:sourceId/crawl` creates a queued crawl job.
- `GET /v1/crawl/:jobId` returns state and `discovered`, `fetched`, `indexed`, `skipped`, and `failed` counters.

Source configuration bounds depth, page count, concurrency, delay, timeouts, retries, redirects, response size, and allowed domains. Queuing and progress are durable.

The crawler container claims queued jobs with `SKIP LOCKED`, updates progress, and ingests extracted documents through the authenticated public document endpoint. Configure a `documents:write` `SEEKR_API_KEY` for it.

## Analytics, recommendations, jobs, and snapshots

Analytics endpoints under `/v1/indexes/:indexId/analytics` expose overview, query, no-result, latency, and click metrics. `POST /v1/events/click` accepts only document/position tuples actually impressed by its search ID. Recommendation endpoints and interaction payloads are documented in [recommendations](recommendations.md). Long-running work is read/cancelled through `/v1/jobs/:jobId`. Snapshot create/list/restore/delete routes live under `/v1/indexes/:indexId/snapshots` and are described in [backups](backups.md).

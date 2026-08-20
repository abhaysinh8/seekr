# HTTP API

The Fastify API validates every public payload with shared Zod schemas, caps request bodies at 1 MiB, and returns an `x-request-id` header. Error bodies include `statusCode`, `code`, `message`, and `requestId`; validation failures also include structured field details.

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

Source configuration bounds depth, page count, concurrency, delay, timeouts, retries, redirects, response size, and allowed domains. Queuing is durable; worker claiming and dispatch belong to the background-job milestone.

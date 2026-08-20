# Architecture

Seekr is a TypeScript monorepo with runtime applications under `apps/` and reusable domain boundaries under `packages/`.

## Runtime applications

- `apps/web`: Next.js App Router dashboard. It presents only capabilities that exist and explicit planned states.
- `apps/api`: Fastify HTTP service, environment validation, structured logging, data-service adapters, and health endpoints.
- `apps/crawler`: independently deployable crawler process boundary. Crawl processing is intentionally deferred.

## Core packages

- `packages/tokenizer`: dependency-free Unicode normalization, tokenization, source offsets, stop-word filtering, stemming strategy hooks, and n-grams shared by indexing and querying.
- `packages/search-core`: in-memory and immutable-segment inverted indexes, postings, BM25/TF-IDF ranking, field-aware retrieval, filters/facets, autocomplete, typo tolerance, phrases, highlighting, and explanations.
- `packages/recommendation-core`: recommendation contracts and future in-process algorithms.
- `packages/shared`: transport-safe schemas and types shared across applications.
- `packages/config`: fail-fast environment parsing for backend processes.

Core packages do not depend on web frameworks, databases, hosted search products, or embedding APIs. This keeps algorithms testable and portable.

## Data services

PostgreSQL is the source of truth for tenancy, source documents, crawl state, analytics, interactions, and credentials. Redis is reserved for ephemeral coordination and caching; no durable state is stored only in Redis.

The API exposes two operational checks:

- `GET /health` reports process liveness and does not call dependencies.
- `GET /ready` probes PostgreSQL and Redis and returns `503` when either is unavailable.

## Dependency direction

Applications may depend on packages. Framework-neutral packages must never import from applications. `search-core`, `tokenizer`, and `recommendation-core` remain independent of storage and transport details.

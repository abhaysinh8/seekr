# Development guide

## Prerequisites

- Node.js 24 or later
- pnpm 11 or later
- Docker with Docker Compose

## Local workflow

1. Copy `.env.example` to `.env`.
2. Install dependencies with `pnpm install`.
3. Start PostgreSQL and Redis with `pnpm dev:services`.
4. Run `pnpm db:migrate` after adding or changing migrations.
5. Start the applications with `pnpm dev`.

The dashboard is served on `http://localhost:3000`; the API is served on `http://localhost:4000`. The crawler worker needs a project key with `documents:write` scope in `SEEKR_API_KEY` before it can ingest queued jobs.

Important environment variables are `DATABASE_URL`, `REDIS_URL`, `API_HOST`, `API_PORT`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, `SEEKR_INDEX_PATH`, `SEEKR_SNAPSHOT_PATH`, `SEEKR_REQUEST_BODY_LIMIT`, `SEEKR_RATE_LIMIT_MAX`, `SEEKR_API_URL`, `SEEKR_API_KEY`, and `SEEKR_CRAWL_POLL_MS`. `.env.example` documents local values; production secrets should come from the deployment platform rather than an image or repository file.

## Quality gates

Run these before opening a pull request:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
```

Tests must not require live PostgreSQL or Redis instances unless they are explicitly marked as integration tests. Inject narrow dependencies into Fastify routes and services for unit testing.

## Database migrations

Migrations live in `infrastructure/postgres/migrations`. The ordered directory is mounted into new PostgreSQL containers for initial setup. The API migration command applies all pending files in one transaction and records them in `schema_migrations`; never edit a migration that has shipped—add the next ordered file instead.

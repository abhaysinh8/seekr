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

The dashboard is served on `http://localhost:3000`; the API is served on `http://localhost:4000`.

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

Migrations live in `infrastructure/postgres/migrations`. The first migration is also mounted into new PostgreSQL containers for initial setup. The API migration command records applied files in `schema_migrations`; never edit a migration that has shipped—add the next ordered file instead.

# Seekr

Seekr is an open-source, self-hosted search and recommendation engine built from first principles. It is designed for developers who want to run search infrastructure locally or deploy it without handing indexing, ranking, or recommendation logic to a hosted search provider.

> **Project status:** bootstrap and shared tokenizer milestones complete. Indexing, ranking, and recommendation algorithms are deliberately not implemented yet.

## What exists today

- pnpm and Turborepo TypeScript monorepo
- Next.js dashboard shell with all planned product sections
- Fastify API with structured errors, request logging, CORS, liveness, and dependency readiness
- PostgreSQL schema for users, projects, indexes, documents, crawling, analytics, interactions, and API keys
- Redis connection and readiness adapter
- independently deployable crawler process boundary
- strict environment parsing with Zod
- Docker Compose for the complete local stack
- ESLint, Prettier, strict TypeScript, Vitest, and build orchestration
- isolated package boundaries for tokenization, search, and recommendation algorithms
- dependency-free, Unicode-aware tokenizer with source offsets, stop words, stemming hooks, and n-grams

No Elasticsearch, OpenSearch, Algolia, Meilisearch, Typesense, Solr, hosted search API, vector database, or external embedding service is used.

## Repository layout

```text
seekr/
├── apps/
│   ├── api/                  # Fastify HTTP API
│   ├── crawler/              # crawl worker process boundary
│   └── web/                  # Next.js dashboard
├── config/
│   └── typescript/           # shared compiler profiles
├── docs/                     # architecture and contributor guides
├── examples/                 # client examples as APIs become available
├── infrastructure/
│   ├── docker/               # application container build
│   └── postgres/migrations/  # ordered PostgreSQL schema migrations
├── packages/
│   ├── config/               # validated runtime configuration
│   ├── recommendation-core/  # recommendation algorithm boundary
│   ├── search-core/          # search algorithm boundary
│   ├── shared/               # shared schemas and transport types
│   └── tokenizer/            # shared indexing/query text pipeline
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

## Requirements

- Node.js 24+
- pnpm 11+
- Docker and Docker Compose

## Run locally

```bash
cp .env.example .env
pnpm install
pnpm dev:services
pnpm db:migrate
pnpm dev
```

Open the dashboard at `http://localhost:3000`. Check the API at `http://localhost:4000/health` and full dependency readiness at `http://localhost:4000/ready`.

On PowerShell, copy the environment file with `Copy-Item .env.example .env`.

## Run everything with Docker

```bash
docker compose up --build
```

PostgreSQL and Redis data are stored in named volumes. The initial schema is applied automatically when the PostgreSQL volume is first created.

## Environment variables

| Variable              | Required     | Default                 | Purpose                                                       |
| --------------------- | ------------ | ----------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`        | API/crawler  | none                    | PostgreSQL connection URL                                     |
| `REDIS_URL`           | API/crawler  | none                    | Redis connection URL using `redis://` or `rediss://`          |
| `NODE_ENV`            | no           | `development`           | runtime mode                                                  |
| `LOG_LEVEL`           | no           | `info`                  | Pino log level                                                |
| `API_HOST`            | no           | `0.0.0.0`               | API bind address                                              |
| `API_PORT`            | no           | `4000`                  | API port                                                      |
| `CORS_ORIGIN`         | no           | `http://localhost:3000` | allowed dashboard origin                                      |
| `NEXT_PUBLIC_API_URL` | no           | `http://localhost:4000` | browser-visible API base URL                                  |
| `POSTGRES_DB`         | Compose only | `seekr`                 | container database name                                       |
| `POSTGRES_USER`       | Compose only | `seekr`                 | container database user                                       |
| `POSTGRES_PASSWORD`   | Compose only | local value             | container database password; change outside local development |

Startup fails with a concise validation error when a required service variable is missing or malformed.

## Commands

| Command             | Description                               |
| ------------------- | ----------------------------------------- |
| `pnpm dev`          | run web, API, and crawler in watch mode   |
| `pnpm dev:services` | start only PostgreSQL and Redis           |
| `pnpm db:migrate`   | apply pending PostgreSQL migrations       |
| `pnpm build`        | build every workspace in dependency order |
| `pnpm typecheck`    | run strict TypeScript checks              |
| `pnpm lint`         | lint the repository                       |
| `pnpm test`         | run Vitest once                           |
| `pnpm format:check` | verify formatting                         |

## Architecture rules

- Search algorithms live only in `packages/search-core`.
- Recommendation algorithms live only in `packages/recommendation-core`.
- Tokenization lives only in `packages/tokenizer`.
- Applications own framework and transport integration; packages remain framework-neutral.
- PostgreSQL holds durable product state. Redis is an optimization and coordination layer.
- API liveness is independent from dependency readiness.

See [Architecture](docs/architecture.md) and [Development guide](docs/development.md) for more detail.

## Next milestone

Build the lexical indexing core in small, correctness-first increments, reusing the completed tokenizer for both documents and queries:

1. in-memory inverted index and posting lists
2. document add, update, and delete semantics
3. Boolean/top-K retrieval with deterministic tests
4. TF-IDF followed by BM25 ranking benchmarks

Persistence and public document/search APIs should follow once the core contracts and correctness suite are stable.

## License

[MIT](LICENSE)

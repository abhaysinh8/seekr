# Production deployment

`docker compose up --build` builds and starts the dashboard, API, crawler worker, PostgreSQL, and Redis. All SQL migrations are mounted into PostgreSQL's initialization directory in lexical order. Named volumes retain PostgreSQL, Redis, index, and snapshot data. Copy `.env.example` to `.env`, replace passwords, configure the single allowed dashboard origin, then open `http://localhost:3000`. After project bootstrap, set a scoped `SEEKR_API_KEY` and restart the crawler service so queued crawls can ingest through the API.

The images use multi-stage builds. TypeScript compilation and Next.js compilation stay in the builder stage; runtime containers run as the unprivileged `node` user and contain production dependencies plus compiled output. `/live` reports process liveness, `/ready` probes PostgreSQL and Redis, and `/metrics` serves Prometheus text.

For upgrades, back up PostgreSQL and snapshot/index volumes, pull the desired immutable image tag, run database migrations, then replace one service at a time. Never assume downgrades are schema-safe. Test restore procedures before relying on backups.

## Honest scaling boundaries

The current release is a single-node search engine. PostgreSQL and Redis can use managed or highly available deployments, and stateless dashboard replicas are safe. The in-process live search index, background worker timer, query-suggestion state, and local segment files are not coordinated across API replicas. Running several API writers against the same data directory is unsupported. Use one active API/index writer and one crawler worker; place a reverse proxy in front for TLS and request buffering. Distributed consensus, shard replication, cross-node cache invalidation, and automatic failover are future work.

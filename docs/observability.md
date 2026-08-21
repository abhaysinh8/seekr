# Operations and observability

Seekr writes structured JSON logs in production. Every response carries `x-request-id`; send the same header from clients to correlate a request through a reverse proxy. Logs intentionally avoid API key values and document bodies.

Probes:

- `GET /live` and `GET /health`: process is accepting requests; no dependencies are touched.
- `GET /ready`: PostgreSQL and Redis can answer. It returns 503 while degraded.
- `GET /metrics`: Prometheus exposition with HTTP counts/duration sums, search and autocomplete counts, per-index document gauges, and process resident memory.

Alert on sustained readiness failures, elevated 5xx/429 rates, growing p95/p99 latency, memory approaching the container limit, and persistent zero-result growth. Scrape metrics within the trusted network; index identifiers and names appear as labels.

## Troubleshooting

If readiness fails, inspect the `dependencies` object and verify `DATABASE_URL`/`REDIS_URL` from inside the API network. If searches return no data after restart, confirm catalog migrations completed and inspect initialization logs. If memory rises, reduce active index size or split collections; the live engine is currently memory resident. For crawler failures, inspect the structured error code—domain policy, robots, DNS/private-network rejection, timeouts, content type, and response-size limits are distinct. For failed jobs, query `/v1/jobs/:jobId`; retries preserve the attempt count and terminal error.

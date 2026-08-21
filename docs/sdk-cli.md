# SDK and CLI

`@seekr/sdk` is a fetch-based, strongly typed client. Construct `new SeekrClient({ baseUrl, apiKey, timeoutMs, retries })`, then use `indexes`, `recommendations`, and `analytics`. Every operation accepts an `AbortSignal`; HTTP failures become `SeekrError` with status, code, request ID, and details. GET/DELETE requests may retry transient 429/5xx failures. Mutations retry only when an idempotency key is supplied.

```ts
const response = await seekr.indexes.search(indexId, {
  query: 'machine learning',
  limit: 10,
  highlight: true,
  explain: true,
});
```

`seekr-cli` uses only the SDK. It covers health, index management, document add/bulk/get/delete, search, autocomplete, crawl start/status, and snapshot operations. Configure with flags (`--url`, `--api-key`), then `SEEKR_URL`/`SEEKR_API_KEY`, then `~/.config/seekr/config.json`; that order is the precedence. `--json` produces compact machine-readable output. JSON bodies come from `--data` or `--file`.

# Documentation search example

This is a complete Next.js integration using only `@seekr/sdk` and public HTTP APIs. With the main Seekr API running, `pnpm --filter @seekr/example-docs-search demo` creates an isolated project, scoped key, schema with synonyms, and the original safe dataset, then launches the example at port 3001. The generated `.env.local` is gitignored and contains the one-time demo key.

Alternatively, create an index with searchable `title` and `content` fields plus a filterable/facetable `section` metadata field, set `SEEKR_URL`, `SEEKR_API_KEY`, and `SEEKR_INDEX_ID`, then run `pnpm seed <index-id> data/documents.json` and `pnpm dev`.

The API key stays in the server-side route and is never shipped to the browser.

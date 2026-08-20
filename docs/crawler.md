# Seekr crawler

The crawler is a conservative breadth-first website ingester. It has separate components for URL policy, robots rules, per-origin rate limiting, HTTP fetching, link discovery, readable-content extraction, duplicate detection, and indexing. The indexing destination is an injected `PageIndexSink`, so crawling does not know about HTTP routes or ranking internals.

## Crawl policy

- Only HTTP and HTTPS URLs are accepted.
- Fragments and credentials are removed and default ports are normalized.
- An allowlist admits an exact domain and its subdomains, never lookalike suffixes.
- Literal loopback/private addresses are denied by default. Local fixtures explicitly opt in.
- Depth, page count, and concurrency have strict upper bounds.
- `robots.txt` is cached once per origin and the `SeekrBot` group takes precedence over `*`.
- Requests use `SeekrBot/0.1`, a timeout, manual bounded redirects, exponential retry backoff, per-origin delay, and a streaming response-size limit.
- Only `text/html` and `application/xhtml+xml` are parsed.

The initial robots parser implements the common `User-agent`, `Allow`, `Disallow`, and `Crawl-delay` directives with longest-prefix precedence. Sitemap discovery and wildcard/end-anchor rules are intentionally future work.

## Content extraction

Cheerio provides deterministic server-side DOM parsing. Scripts, styles, navigation, footers, sidebars, cookie banners, ads, and other obvious chrome are removed before extraction. Seekr records title, description, headings, paragraph-preserving main content, canonical URL, language, valid JSON-LD, status, content type, and crawl time.

The normalized readable content is hashed with SHA-256. Identical hashes within one crawl are fetched but indexed only once. Stored document IDs are stable SHA-256 hashes of canonical URLs.

## Complexity

For `P` accepted pages and `L` discovered links, queue traversal and URL deduplication are expected `O(P + L)` time with `O(P + L)` crawl state. DOM extraction is linear in page markup size. Rate limiting serializes requests per origin while still allowing bounded concurrency across independent origins.

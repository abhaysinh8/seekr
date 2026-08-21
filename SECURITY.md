# Security policy

## Reporting a vulnerability

Please do not open a public issue for an unpatched vulnerability. Email the maintainers listed in the repository security contact and include the affected version, impact, reproduction, and any suggested remediation. Expect acknowledgement within three business days. We will coordinate a fix and disclosure timeline with the reporter.

## Deployment checklist

- Terminate TLS at a trusted reverse proxy and do not expose PostgreSQL or Redis publicly.
- Replace all example passwords, restrict `CORS_ORIGIN`, and create scoped, expiring API keys.
- Mount index and snapshot directories on access-controlled storage. Snapshot archives contain document content and metadata.
- Keep crawler allowlists narrow. Seekr rejects literal and DNS-resolved private, loopback, link-local, documentation, multicast, and reserved addresses at every redirect; an egress firewall remains the strongest SSRF boundary.
- Set request, crawl response, document, bulk, query, filter, and pagination limits appropriate for the host.
- Scrub secrets from reverse-proxy logs and never pass API keys in query strings.

## Implemented controls

API keys are random, stored as salted scrypt hashes, shown once, scope checked, expiration aware, and revocable. Index resources are checked against the authenticated key's project. The API applies fixed-window IP rate limits, request-size limits, strict Zod schemas, parameterized PostgreSQL queries, explicit CORS, structured errors, and baseline security headers. Highlight content is HTML escaped before configured markup is inserted. Snapshot and segment identifiers are validated and filesystem writes use staged/atomic replacement.

The crawler accepts only HTTP(S), normalizes URLs, removes credentials, enforces domain allowlists, handles redirects manually, resolves DNS on every hop, rejects private/reserved results, restricts content types, caps streamed response bytes, and applies timeouts/retries. Operators should still enforce outbound network policy because application checks cannot replace network isolation.

## Supported versions

Until 1.0, security fixes are released against the newest minor release only.

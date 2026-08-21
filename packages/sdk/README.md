# `@seekr/sdk`

The official, fetch-based TypeScript client for self-hosted Seekr installations.

```ts
import { SeekrClient } from '@seekr/sdk';

const seekr = new SeekrClient({
  baseUrl: 'http://localhost:4000',
  apiKey: process.env.SEEKR_API_KEY,
});
const response = await seekr.indexes.search(indexId, { query: 'machine learning' });
```

The client supports timeouts, `AbortSignal`, structured `SeekrError` failures, and conservative retries. Mutating requests are retried only when an idempotency key is supplied.

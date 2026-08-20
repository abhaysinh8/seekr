import { describe, expect, it } from 'vitest';

import { documentSchema } from './entities.js';

describe('documentSchema', () => {
  it('accepts arbitrary structured fields', () => {
    const document = documentSchema.parse({
      id: '35bbfc64-8e45-4da8-9c88-1a4678dcd5a8',
      indexId: 'ff117258-823b-44b7-9831-c9d054889a0a',
      externalId: 'article-42',
      fields: { title: 'Search without a hosted dependency', tags: ['search', 'typescript'] },
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
    });

    expect(document.fields.title).toBe('Search without a hosted dependency');
  });

  it('rejects empty external identifiers', () => {
    const result = documentSchema.safeParse({
      id: '35bbfc64-8e45-4da8-9c88-1a4678dcd5a8',
      indexId: 'ff117258-823b-44b7-9831-c9d054889a0a',
      externalId: '',
      fields: {},
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });
});

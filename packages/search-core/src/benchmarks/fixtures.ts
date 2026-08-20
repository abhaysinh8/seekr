import type { SearchDocument } from '../types.js';

export function createSyntheticDocuments(count: number): SearchDocument[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `benchmark-${index}`,
    fields: {
      title: index % 5 === 0 ? 'Machine learning systems' : 'Search infrastructure',
      body: `${'search '.repeat((index % 12) + 1)} machine data document ${index}`,
    },
    metadata: {
      category: `category-${index % 10}`,
      price: index,
    },
  }));
}

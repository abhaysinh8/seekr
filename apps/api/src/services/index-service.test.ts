import { describe, expect, it } from 'vitest';
import { InMemoryIndexService } from './index-service.js';

describe('index generation', () => {
  it('advances on document mutations so stale cache keys are unreachable', () => {
    const service = new InMemoryIndexService();
    service.createIndex('index');
    const created = service.getGeneration('index');
    service.addDocument('index', { id: 'one', fields: { body: 'one' } });
    expect(service.getGeneration('index')).toBe(created + 1);
    service.removeDocument('index', 'one');
    expect(service.getGeneration('index')).toBe(created + 2);
  });
});

import { describe, expect, it } from 'vitest';
import { SearchIndex } from './search-engine.js';
import { SynonymMap } from './synonyms.js';

describe('query-time synonyms', () => {
  it('supports directional and bidirectional rules without recursive expansion', () => {
    const map = new SynonymMap([
      { source: 'js', targets: ['javascript'] },
      { source: 'tv', targets: ['television'], bidirectional: true },
      { source: 'javascript', targets: ['ecmascript'] },
    ]);
    expect(map.expand('js')).toEqual(['javascript']);
    expect(map.expand('javascript')).toEqual(['ecmascript']);
    expect(map.expand('television')).toEqual(['tv']);
  });
  it('ranks exact matches above penalized expansions and explains the penalty', () => {
    const index = new SearchIndex({
      synonyms: [{ source: 'js', targets: ['javascript'] }],
      synonymPenalty: 0.5,
    });
    index.addDocuments([
      { id: 'exact', fields: { body: 'js' } },
      { id: 'expanded', fields: { body: 'javascript' } },
    ]);
    const result = index.search('js', { explain: true });
    expect(result.results.map((item) => item.documentId)).toEqual(['exact', 'expanded']);
    expect(result.results[1]?.explanation?.terms[0]).toMatchObject({
      matchedTerm: 'javascript',
      synonymPenalty: 0.5,
    });
  });
});

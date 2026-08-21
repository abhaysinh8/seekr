import { describe, expect, it } from 'vitest';
import { SearchIndex } from './search-engine.js';

describe('query spelling correction', () => {
  const index = new SearchIndex();
  index.addDocuments([
    { id: 'one', fields: { body: 'machine learning javascript javascript' } },
    { id: 'two', fields: { body: 'machine models javascript' } },
    { id: 'rare', fields: { body: 'kubernetes' } },
  ]);
  it('corrects common multiple-word misspellings with metadata', () => {
    expect(index.correctQuery('machien lerning')).toMatchObject({
      originalQuery: 'machien lerning',
      correctedQuery: 'machine learning',
      correctionApplied: true,
      corrections: [
        { originalTerm: 'machien', correctedTerm: 'machine', editDistance: 2 },
        { originalTerm: 'lerning', correctedTerm: 'learning', editDistance: 1 },
      ],
    });
    expect(index.correctQuery('javscript').correctedQuery).toBe('javascript');
  });
  it('preserves valid uncommon vocabulary and quoted phrases', () => {
    expect(index.correctQuery('kubernetes')).toMatchObject({
      correctionApplied: false,
      correctedQuery: 'kubernetes',
    });
    expect(index.correctQuery('"machien learning"')).toMatchObject({ correctionApplied: false });
  });
  it('does not force ambiguous corrections', () => {
    const ambiguous = new SearchIndex();
    ambiguous.addDocuments([
      { id: '1', fields: { body: 'cat' } },
      { id: '2', fields: { body: 'car' } },
    ]);
    expect(ambiguous.correctQuery('cap')).toMatchObject({
      correctionApplied: false,
      correctedQuery: 'cap',
    });
  });
});

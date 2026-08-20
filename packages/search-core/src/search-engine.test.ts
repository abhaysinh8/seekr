import { describe, expect, it } from 'vitest';

import { SearchIndex } from './search-engine.js';

const createFieldIndex = () =>
  new SearchIndex({
    fields: {
      title: { searchable: true, weight: 3 },
      description: { searchable: true, weight: 2 },
      body: { searchable: true, weight: 1 },
      brand: { filterable: true, facetable: true },
      category: { filterable: true, facetable: true },
      price: { filterable: true, sortable: true },
      available: { filterable: true },
    },
  });

describe('SearchIndex ranking', () => {
  it('uses BM25 by default and keeps TF-IDF selectable', () => {
    const index = new SearchIndex();
    index.addDocuments([
      { id: 'strong', fields: { body: 'machine learning machine' } },
      { id: 'weak', fields: { body: 'machine systems' } },
      { id: 'other', fields: { body: 'database systems' } },
    ]);
    expect(index.search('machine learning').results.map(({ documentId }) => documentId)).toEqual([
      'strong',
      'weak',
    ]);
    expect(index.search('machine learning', { ranking: 'tfidf' }).results[0]?.documentId).toBe(
      'strong',
    );
  });

  it('handles unknown terms, empty queries, repetition, zero documents, and removal', () => {
    const index = new SearchIndex();
    expect(index.search('anything').results).toEqual([]);
    index.addDocument({ id: 'doc', fields: { body: 'search search engine' } });
    expect(index.search('unknown').results).toEqual([]);
    expect(index.search('').results).toEqual([]);
    const repeated = index.search('search search', { debug: true }).results[0];
    const single = index.search('search').results[0];
    expect(repeated?.score).toBeGreaterThan(single?.score ?? 0);
    index.removeDocument('doc');
    expect(index.search('search').results).toEqual([]);
  });

  it('lets rare terms contribute more strongly and combines multiple terms', () => {
    const index = new SearchIndex();
    index.addDocuments([
      { id: 'both', fields: { body: 'common rare' } },
      { id: 'common-1', fields: { body: 'common' } },
      { id: 'common-2', fields: { body: 'common' } },
    ]);
    const result = index.search('common rare', { debug: true }).results[0];
    const common = result?.debug?.find(({ matchedTerm }) => matchedTerm === 'common');
    const rare = result?.debug?.find(({ matchedTerm }) => matchedTerm === 'rare');
    expect(result?.documentId).toBe('both');
    expect(rare?.idf).toBeGreaterThan(common?.idf ?? Infinity);
  });

  it('applies weights per field and supports field-restricted queries', () => {
    const index = createFieldIndex();
    index.addDocuments([
      { id: 'title-hit', fields: { title: 'machine', body: 'other' } },
      { id: 'body-hit', fields: { title: 'other', body: 'machine machine' } },
    ]);
    expect(index.search('machine').results[0]?.documentId).toBe('title-hit');
    expect(
      index.search('machine', { fields: ['body'] }).results.map(({ documentId }) => documentId),
    ).toEqual(['body-hit']);
    expect(index.search('machine').results[0]?.fieldContributions[0]).toMatchObject({
      field: 'title',
      matchedTerms: ['machine'],
    });
  });

  it('filters, sorts, facets, and supports pure filtering', () => {
    const index = createFieldIndex();
    index.addDocuments([
      {
        id: 'sony-199',
        fields: { title: 'Wireless headphones' },
        metadata: { brand: 'Sony', category: 'electronics', price: 199, available: true },
      },
      {
        id: 'bose-299',
        fields: { title: 'Noise cancelling headphones' },
        metadata: { brand: 'Bose', category: 'electronics', price: 299, available: true },
      },
      {
        id: 'sony-399',
        fields: { title: 'Premium headphones' },
        metadata: { brand: 'Sony', category: 'premium', price: 399, available: false },
      },
    ]);
    const response = index.search('headphones', {
      filters: [
        { field: 'brand', operator: 'in', value: ['Sony', 'Bose'] },
        { field: 'price', operator: 'lessThan', value: 300 },
      ],
      sort: { field: 'price', direction: 'desc' },
      facets: ['brand', 'category'],
    });
    expect(response.results.map(({ documentId }) => documentId)).toEqual(['bose-299', 'sony-199']);
    expect(response.facets).toEqual({
      brand: { Sony: 1, Bose: 1 },
      category: { electronics: 2 },
    });
    expect(
      index
        .search('', {
          filters: [{ field: 'available', operator: 'equals', value: true }],
          sort: { field: 'price', direction: 'asc' },
        })
        .results.map(({ documentId }) => documentId),
    ).toEqual(['sony-199', 'bose-299']);
  });

  it('supports every structured filter operator', () => {
    const index = createFieldIndex();
    index.addDocuments([
      {
        id: 'one',
        fields: { title: 'one' },
        metadata: { brand: 'Sony', price: 100, available: true },
      },
      { id: 'two', fields: { title: 'two' }, metadata: { brand: 'Bose', price: 200 } },
      {
        id: 'three',
        fields: { title: 'three' },
        metadata: { brand: 'JBL', price: 300, available: false },
      },
    ]);
    const filtered = (
      field: string,
      operator:
        'notEquals' | 'notIn' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'exists',
      value?: string | number | boolean | readonly string[],
    ) =>
      index
        .search('', {
          filters: [{ field, operator, ...(value === undefined ? {} : { value }) }],
          limit: 10,
        })
        .results.map(({ documentId }) => documentId)
        .sort();

    expect(filtered('brand', 'notEquals', 'Sony')).toEqual(['three', 'two']);
    expect(filtered('brand', 'notIn', ['Sony', 'JBL'])).toEqual(['two']);
    expect(filtered('price', 'greaterThan', 100)).toEqual(['three', 'two']);
    expect(filtered('price', 'greaterThanOrEqual', 200)).toEqual(['three', 'two']);
    expect(filtered('price', 'lessThanOrEqual', 200)).toEqual(['one', 'two']);
    expect(filtered('available', 'exists')).toEqual(['one', 'three']);
    expect(filtered('available', 'exists', false)).toEqual(['two']);
  });

  it('returns paginated top-K results in the same order as full ranking', () => {
    const index = new SearchIndex();
    index.addDocuments(
      Array.from({ length: 100 }, (_, number) => ({
        id: `doc-${String(number).padStart(3, '0')}`,
        fields: { body: `${'search '.repeat((number % 7) + 1)} document ${number}` },
      })),
    );
    const full = index.search('search', { limit: 100 }).results.map(({ documentId }) => documentId);
    const page = index
      .search('search', { limit: 10, offset: 20 })
      .results.map(({ documentId }) => documentId);
    expect(page).toEqual(full.slice(20, 30));
  });
});

describe('SearchIndex language features', () => {
  it('keeps autocomplete synchronized and orders by document frequency', () => {
    const index = new SearchIndex();
    index.addDocuments([
      { id: 'one', fields: { body: 'machine machinery' } },
      { id: 'two', fields: { body: 'machine machines' } },
      { id: 'three', fields: { body: 'machines' } },
    ]);
    expect(index.autocomplete('mach', { limit: 2 })).toEqual(['machine', 'machines']);
    index.removeDocument('one');
    expect(index.autocomplete('mach', { limit: 10 })).toEqual(['machines', 'machine']);
    index.removeDocument('two');
    expect(index.autocomplete('mach', { limit: 10 })).toEqual(['machines']);
  });

  it('matches conservative fuzzy terms and penalizes them', () => {
    const index = new SearchIndex();
    index.addDocuments([
      { id: 'machine', fields: { body: 'machine learning' } },
      { id: 'javascript', fields: { body: 'javascript guide' } },
      { id: 'unrelated', fields: { body: 'database systems' } },
    ]);
    expect(index.search('machien learning', { typoTolerance: true }).results[0]?.documentId).toBe(
      'machine',
    );
    const debug = index.search('javscript', { typoTolerance: true, debug: true }).results[0]
      ?.debug?.[0];
    expect(debug).toMatchObject({
      queryTerm: 'javscript',
      matchedTerm: 'javascript',
      editDistance: 1,
    });
    expect(debug?.typoPenalty).toBeLessThan(1);
    expect(index.search('zzzzzz', { typoTolerance: true }).results).toEqual([]);
  });

  it('requires quoted phrases in order and in the same field', () => {
    const index = createFieldIndex();
    index.addDocuments([
      {
        id: 'exact',
        fields: { title: 'Machine Learning Basics', body: 'machine learning machine learning' },
      },
      { id: 'reversed', fields: { title: 'Learning Machine', body: '' } },
      { id: 'separated', fields: { title: 'Machine and Learning', body: '' } },
      { id: 'split-fields', fields: { title: 'Machine', body: 'Learning' } },
      { id: 'phrase-plus', fields: { title: 'Machine Learning', body: 'algorithms' } },
    ]);
    const phrase = index.search('"machine learning"', { explain: true });
    expect(phrase.results.map(({ documentId }) => documentId).sort()).toEqual([
      'exact',
      'phrase-plus',
    ]);
    expect(
      phrase.results.find(({ documentId }) => documentId === 'exact')?.explanation?.phrases,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'body', positions: [0, 2] })]),
    );
    expect(
      index.search('"machine learning" algorithms').results.map(({ documentId }) => documentId),
    ).toContain('phrase-plus');
  });

  it('boosts nearby normal terms modestly', () => {
    const index = new SearchIndex();
    index.addDocuments([
      { id: 'near', fields: { body: 'machine learning filler filler' } },
      { id: 'far', fields: { body: 'machine filler filler learning' } },
    ]);
    const without = index.search('machine learning').results;
    const withBoost = index.search('machine learning', {
      proximityBoost: true,
      explain: true,
    }).results;
    expect(withBoost[0]?.documentId).toBe('near');
    expect(withBoost.find(({ documentId }) => documentId === 'near')?.score).toBeGreaterThan(
      without.find(({ documentId }) => documentId === 'near')?.score ?? Infinity,
    );
    expect(withBoost[0]?.explanation?.proximityBoost).toBeGreaterThan(0);
  });

  it('highlights from stored offsets, escapes HTML, and explains only on request', () => {
    const index = createFieldIndex();
    index.addDocument({
      id: 'safe',
      fields: {
        title: 'Machine Learning <script>alert(1)</script>',
        body: 'An introduction to machine learning.',
      },
    });
    const plain = index.search('machine learning').results[0];
    expect(plain?.explanation).toBeUndefined();
    expect(plain?.highlights).toBeUndefined();

    const decorated = index.search('machine learning', {
      highlights: { preTag: '<em>', postTag: '</em>' },
      explain: true,
    }).results[0];
    expect(decorated?.highlights?.title).toBe(
      '<em>Machine Learning</em> &lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(decorated?.highlights?.body).toBe('An introduction to <em>machine learning</em>.');
    expect(decorated?.explanation).toMatchObject({
      finalScore: decorated?.score,
      terms: expect.arrayContaining([
        expect.objectContaining({ matchedTerm: 'machine', fieldWeight: 3 }),
      ]),
    });
  });
});

import { describe, expect, it } from 'vitest';

import { InMemoryInvertedIndex } from './inverted-index.js';

describe('InMemoryInvertedIndex', () => {
  it('indexes one document with frequencies, positions, offsets, and arbitrary fields', () => {
    const index = new InMemoryInvertedIndex();
    index.addDocument({
      id: 'doc-1',
      fields: {
        heading: 'Machine Learning',
        content: 'machine machine algorithms machine',
      },
      metadata: { category: 'education' },
    });

    expect(index.getDocument('doc-1')?.fields.heading).toBe('Machine Learning');
    expect(index.getPostingList('machine')).toEqual([
      {
        documentId: 'doc-1',
        field: 'content',
        termFrequency: 3,
        positions: [0, 1, 3],
        offsets: [
          { startOffset: 0, endOffset: 7 },
          { startOffset: 8, endOffset: 15 },
          { startOffset: 27, endOffset: 34 },
        ],
      },
      {
        documentId: 'doc-1',
        field: 'heading',
        termFrequency: 1,
        positions: [0],
        offsets: [{ startOffset: 0, endOffset: 7 }],
      },
    ]);
    expect(index.getDocumentFrequency('machine')).toBe(1);
    expect(index.getDocumentFrequency('machine', 'content')).toBe(1);
  });

  it('indexes many documents without conflating term and document frequency', () => {
    const index = new InMemoryInvertedIndex();
    index.addDocuments([
      { id: 'one', fields: { body: 'search search' } },
      { id: 'two', fields: { body: 'search engine' } },
      { id: 'three', fields: { body: 'recommendations' } },
    ]);
    expect(index.getDocumentFrequency('search')).toBe(2);
    expect(index.getPostingList('search').map(({ termFrequency }) => termFrequency)).toEqual([
      2, 1,
    ]);
  });

  it('removes stale postings during update', () => {
    const index = new InMemoryInvertedIndex();
    index.addDocument({ id: 'doc', fields: { body: 'old vocabulary' } });
    index.updateDocument({ id: 'doc', fields: { body: 'new content' } });
    expect(index.getPostingList('old')).toEqual([]);
    expect(index.getPostingList('new')).toHaveLength(1);
    expect(index.getCollectionStatistics().vocabularySize).toBe(2);
  });

  it('removes documents and empty posting lists', () => {
    const index = new InMemoryInvertedIndex();
    index.addDocument({ id: 'doc', fields: { body: 'unique term' } });
    expect(index.removeDocument('missing')).toBe(false);
    expect(index.removeDocument('doc')).toBe(true);
    expect(index.getPostingList('unique')).toEqual([]);
    expect(index.autocomplete('uni')).toEqual([]);
  });

  it('handles empty documents and collection statistics', () => {
    const index = new InMemoryInvertedIndex();
    index.addDocuments([
      { id: 'empty', fields: { body: '' } },
      { id: 'full', fields: { body: 'machine learning models' } },
    ]);
    expect(index.getDocumentStatistics('empty')).toEqual({
      documentId: 'empty',
      length: 0,
      fieldLengths: { body: 0 },
    });
    expect(index.getCollectionStatistics()).toMatchObject({
      documentCount: 2,
      totalDocumentLength: 3,
      averageDocumentLength: 1.5,
      vocabularySize: 3,
      fieldDocumentCounts: { body: 2 },
      fieldAverageLengths: { body: 1.5 },
    });
    index.clear();
    expect(index.getCollectionStatistics().documentCount).toBe(0);
  });

  it('uses tokenizer normalization and returns nothing for nonexistent terms', () => {
    const index = new InMemoryInvertedIndex();
    index.addDocument({ id: 'doc', fields: { body: 'ＭＡＣＨＩＮＥ!' } });
    expect(index.searchTerm('machine')).toHaveLength(1);
    expect(index.searchTerm('missing')).toEqual([]);
  });

  it('honors searchable field configuration and missing fields', () => {
    const index = new InMemoryInvertedIndex({
      fields: {
        title: { searchable: true },
        category: { searchable: false, filterable: true },
      },
    });
    index.addDocuments([
      { id: 'one', fields: { title: 'Machine', hidden: 'secret' }, metadata: { category: 'a' } },
      { id: 'two', fields: {}, metadata: { category: 'b' } },
    ]);
    expect(index.getPostingList('machine')).toHaveLength(1);
    expect(index.getPostingList('secret')).toEqual([]);
  });
});

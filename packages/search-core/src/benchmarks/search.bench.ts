import { performance } from 'node:perf_hooks';

import { selectTopK } from '../heap.js';
import { SearchIndex } from '../search-engine.js';
import { createSyntheticDocuments } from './fixtures.js';

interface ScoreFixture {
  readonly documentId: string;
  readonly score: number;
}

const compareScores = (left: ScoreFixture, right: ScoreFixture): number =>
  right.score - left.score || left.documentId.localeCompare(right.documentId);

const measure = (operation: () => void): number => {
  const started = performance.now();
  operation();
  return performance.now() - started;
};

const lines = ['documents\tindex ms\tsearch ms\tfuzzy ms\tfull sort ms\theap top-k ms'];
for (const size of [1_000, 5_000, 10_000]) {
  const index = new SearchIndex({
    fields: {
      title: { searchable: true, weight: 3 },
      body: { searchable: true },
      category: { filterable: true, facetable: true },
      price: { filterable: true, sortable: true },
    },
  });
  const documents = createSyntheticDocuments(size);
  const indexMs = measure(() => index.addDocuments(documents));
  const searchMs = measure(() => void index.search('machine search', { limit: 10 }));
  const fuzzyMs = measure(
    () => void index.search('machien serch', { limit: 10, typoTolerance: true }),
  );
  const scores = documents.map(({ id }, position) => ({
    documentId: id,
    score: ((position * 2_654_435_761) >>> 0) / 2 ** 32,
  }));
  const fullSortMs = measure(() => void [...scores].sort(compareScores).slice(0, 10));
  const heapMs = measure(() => void selectTopK(scores, 10, compareScores));
  lines.push(
    [size, indexMs, searchMs, fuzzyMs, fullSortMs, heapMs]
      .map((value) => (typeof value === 'number' ? value.toFixed(2) : value))
      .join('\t'),
  );
}

process.stdout.write(`${lines.join('\n')}\n`);

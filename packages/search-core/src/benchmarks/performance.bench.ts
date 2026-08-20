import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { tokenize } from '@seekr/tokenizer';
import { SearchIndex } from '../search-engine.js';
import { FileSystemSegmentStore } from '../segments/file-system-store.js';
import { ImmutableSegmentIndex } from '../segments/immutable-segment-index.js';
import { createSyntheticDocuments } from './fixtures.js';

interface Distribution { readonly operations: number; readonly operationsPerSecond: number; readonly averageMs: number; readonly p50Ms: number; readonly p95Ms: number; readonly p99Ms: number; }
interface BenchmarkResult { readonly documents: number; readonly memoryDeltaBytes: number; readonly metrics: Readonly<Record<string, Distribution>>; }

const sizes = (process.env.SEEKR_BENCHMARK_SIZES ?? '1000,10000').split(',').map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 100_000);
if (sizes.length === 0) throw new Error('SEEKR_BENCHMARK_SIZES must contain document counts from 1 through 100000');
const outputPath = path.resolve(process.env.SEEKR_BENCHMARK_OUTPUT ?? 'benchmark-results.json');
const results: BenchmarkResult[] = [];

for (const size of sizes) {
  const documents = createSyntheticDocuments(size);
  const beforeMemory = process.memoryUsage().heapUsed;
  const index = new SearchIndex({ fields: { title: { searchable: true, weight: 3 }, body: { searchable: true }, category: { filterable: true, facetable: true }, price: { filterable: true, sortable: true } } });
  const metrics: Record<string, Distribution> = {};
  metrics.tokenization = measure(() => { for (const document of documents) tokenize(String(document.fields.body)); }, 1, size);
  metrics.indexing = measure(() => index.addDocuments(documents), 1, size);
  const iterations = size >= 50_000 ? 30 : 100;
  metrics.singleTermLookup = measure(() => void index.searchTerm('search'), iterations);
  metrics.singleTermBm25 = measure(() => void index.search('machine', { limit: 10 }), iterations);
  metrics.multiTermBm25 = measure(() => void index.search('machine search systems', { limit: 10 }), iterations);
  metrics.topK = measure(() => void index.search('search', { limit: 10 }), iterations);
  metrics.filteredSearch = measure(() => void index.search('search', { filters: [{ field: 'category', operator: 'equals', value: 'category-3' }], limit: 10 }), iterations);
  metrics.facets = measure(() => void index.search('search', { facets: ['category'], limit: 10 }), iterations);
  metrics.autocomplete = measure(() => void index.autocomplete('mach', { limit: 10 }), iterations);
  metrics.fuzzySearch = measure(() => void index.search('machien serch', { typoTolerance: true, limit: 10 }), Math.max(10, Math.floor(iterations / 2)));

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'seekr-benchmark-'));
  try {
    const configuration = { fields: { title: { searchable: true }, body: { searchable: true } } };
    const segmented = await ImmutableSegmentIndex.open(new FileSystemSegmentStore(temporaryDirectory), { configuration });
    const persistenceStarted = performance.now(); await segmented.addDocuments(documents); await segmented.flush();
    metrics.indexPersistence = summarize([performance.now() - persistenceStarted], size);
    const restorationSamples: number[] = [];
    for (let iteration = 0; iteration < 3; iteration += 1) { const started = performance.now(); await ImmutableSegmentIndex.open(new FileSystemSegmentStore(temporaryDirectory), { configuration }); restorationSamples.push(performance.now() - started); }
    metrics.indexRestoration = summarize(restorationSamples, 3);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  results.push({ documents: size, memoryDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - beforeMemory), metrics });
}

const report = { generatedAt: new Date().toISOString(), node: process.version, platform: `${process.platform}-${process.arch}`, results };
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
printReport(results, outputPath);

function measure(operation: () => void, iterations: number, logicalOperations = iterations): Distribution {
  const samples: number[] = []; const started = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) { const sampleStarted = performance.now(); operation(); samples.push(performance.now() - sampleStarted); }
  const totalMs = performance.now() - started;
  return { ...summarize(samples, logicalOperations), operationsPerSecond: totalMs === 0 ? 0 : (logicalOperations / totalMs) * 1000 };
}
function summarize(samples: readonly number[], operations: number): Distribution {
  const sorted = [...samples].sort((a, b) => a - b); const total = sorted.reduce((sum, value) => sum + value, 0);
  return { operations, operationsPerSecond: total === 0 ? 0 : (operations / total) * 1000, averageMs: sorted.length === 0 ? 0 : total / sorted.length, p50Ms: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95), p99Ms: percentile(sorted, 0.99) };
}
function percentile(sorted: readonly number[], quantile: number): number { if (sorted.length === 0) return 0; return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] ?? 0; }
function printReport(values: readonly BenchmarkResult[], destination: string): void {
  for (const result of values) {
    process.stdout.write(`\n${result.documents.toLocaleString()} documents · heap delta ${(result.memoryDeltaBytes / 1024 / 1024).toFixed(1)} MiB\n`);
    process.stdout.write('operation                 ops/s       avg ms      p50       p95       p99\n');
    for (const [name, metric] of Object.entries(result.metrics)) process.stdout.write(`${name.padEnd(24)} ${metric.operationsPerSecond.toFixed(1).padStart(10)} ${metric.averageMs.toFixed(3).padStart(11)} ${metric.p50Ms.toFixed(3).padStart(9)} ${metric.p95Ms.toFixed(3).padStart(9)} ${metric.p99Ms.toFixed(3).padStart(9)}\n`);
  }
  process.stdout.write(`\nJSON report: ${destination}\n`);
}

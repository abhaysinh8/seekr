import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

type Scenario = 'search' | 'autocomplete' | 'mixed' | 'analytics';
interface Sample {
  readonly durationMs: number;
  readonly ok: boolean;
}

const baseUrl = process.env.SEEKR_LOAD_API_URL ?? 'http://localhost:4000';
const indexId = required('SEEKR_LOAD_INDEX_ID');
const apiKey = process.env.SEEKR_LOAD_API_KEY;
const scenario = parseScenario(process.env.SEEKR_LOAD_SCENARIO ?? 'search');
const durationSeconds = boundedInteger('SEEKR_LOAD_DURATION_SECONDS', 30, 1, 3600);
const concurrency = boundedInteger('SEEKR_LOAD_CONCURRENCY', 10, 1, 500);
const outputPath = path.resolve(process.env.SEEKR_LOAD_OUTPUT ?? 'load-test-results.json');
const samples: Sample[] = [];
let sequence = 0;
const deadline = performance.now() + durationSeconds * 1000;

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (performance.now() < deadline) {
      const current = sequence;
      sequence += 1;
      if (scenario === 'search') await search(current);
      else if (scenario === 'autocomplete') await autocomplete(current);
      else if (scenario === 'mixed') await (current % 5 === 0 ? ingest(current) : search(current));
      else await analytics(current);
    }
  }),
);

const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
const failures = samples.filter((sample) => !sample.ok).length;
const report = {
  generatedAt: new Date().toISOString(),
  scenario,
  durationSeconds,
  concurrency,
  requests: samples.length,
  requestsPerSecond: samples.length / durationSeconds,
  averageLatencyMs: average(durations),
  p95LatencyMs: percentile(durations, 0.95),
  p99LatencyMs: percentile(durations, 0.99),
  errors: failures,
  errorRate: samples.length === 0 ? 0 : failures / samples.length,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\nReport: ${outputPath}\n`);

async function search(index: number) {
  const queries = [
    'search infrastructure',
    'machine learning',
    'ranking relevance',
    'database systems',
  ];
  return request(`/v1/indexes/${indexId}/search`, {
    method: 'POST',
    body: JSON.stringify({
      query: queries[index % queries.length],
      limit: 10,
      typoTolerance: index % 10 === 0,
    }),
  });
}
async function autocomplete(index: number) {
  const prefixes = ['se', 'mach', 'rank', 'data'];
  return request(`/v1/indexes/${indexId}/autocomplete`, {
    method: 'POST',
    body: JSON.stringify({ prefix: prefixes[index % prefixes.length], limit: 10 }),
  });
}
async function ingest(index: number) {
  return request(`/v1/indexes/${indexId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      id: `load-${index}`,
      fields: {
        title: `Load test document ${index}`,
        content: `deterministic search content ${index}`,
      },
    }),
  });
}
async function analytics(index: number) {
  const response = await search(index);
  if (!response.ok) return;
  const body = (await response.json()) as {
    searchId?: string;
    hits?: Array<{ documentId: string }>;
  };
  const first = body.hits?.[0];
  if (body.searchId !== undefined && first !== undefined)
    await request('/v1/events/click', {
      method: 'POST',
      body: JSON.stringify({ searchId: body.searchId, documentId: first.documentId, position: 1 }),
    });
}
async function request(url: string, init: RequestInit): Promise<Response> {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(apiKey === undefined ? {} : { authorization: `Bearer ${apiKey}` }),
      },
    });
    samples.push({ durationMs: performance.now() - started, ok: response.ok });
    return response;
  } catch {
    samples.push({ durationMs: performance.now() - started, ok: false });
    return new Response(null, { status: 599 });
  }
}
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}
function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
  return value;
}
function parseScenario(value: string): Scenario {
  if (value === 'search' || value === 'autocomplete' || value === 'mixed' || value === 'analytics')
    return value;
  throw new Error('SEEKR_LOAD_SCENARIO must be search, autocomplete, mixed, or analytics');
}
function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
function percentile(values: readonly number[], quantile: number): number {
  return values.length === 0
    ? 0
    : (values[Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)] ?? 0);
}

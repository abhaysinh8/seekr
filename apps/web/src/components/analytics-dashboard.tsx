'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from '../lib/api';
import type { IndexView } from '../lib/types';

interface Overview {
  totalSearches: number;
  uniqueQueries: number;
  averageLatencyMs: number;
  zeroResultSearches: number;
  zeroResultRate: number;
  latency: { p50: number; p95: number; p99: number };
  volume: Array<{ date: string; count: number }>;
}
interface QueryMetric {
  normalizedQuery: string;
  searchCount: number;
  averageResultCount: number;
  averageLatencyMs: number;
  zeroResultRate: number;
  impressions: number;
  clicks: number;
  ctr: number;
}
interface ClickMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  averageClickedPosition: number;
  mostClickedDocuments: Array<{ documentId: string; clicks: number }>;
}

export function AnalyticsDashboard() {
  const [indexes, setIndexes] = useState<readonly IndexView[]>([]);
  const [indexId, setIndexId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [overview, setOverview] = useState<Overview>();
  const [queries, setQueries] = useState<readonly QueryMetric[]>([]);
  const [clicks, setClicks] = useState<ClickMetrics>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    void apiRequest<{ indexes: readonly IndexView[] }>('/v1/indexes')
      .then((body) => {
        setIndexes(body.indexes);
        setIndexId(body.indexes[0]?.id ?? '');
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Could not load indexes'),
      )
      .finally(() => setLoading(false));
  }, []);
  async function loadAnalytics() {
    if (indexId.length === 0) return;
    setLoading(true);
    setError(undefined);
    const params = new URLSearchParams();
    if (start.length > 0) params.set('start', new Date(`${start}T00:00:00.000Z`).toISOString());
    if (end.length > 0) params.set('end', new Date(`${end}T23:59:59.999Z`).toISOString());
    const suffix = params.size === 0 ? '' : `?${params.toString()}`;
    try {
      const [overviewBody, queryBody, clickBody] = await Promise.all([
        apiRequest<Overview>(`/v1/indexes/${indexId}/analytics/overview${suffix}`),
        apiRequest<{ queries: readonly QueryMetric[] }>(
          `/v1/indexes/${indexId}/analytics/queries${suffix}`,
        ),
        apiRequest<ClickMetrics>(`/v1/indexes/${indexId}/analytics/clicks${suffix}`),
      ]);
      setOverview(overviewBody);
      setQueries(queryBody.queries);
      setClicks(clickBody);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Analytics request failed');
    } finally {
      setLoading(false);
    }
  }
  const maximumVolume = Math.max(1, ...(overview?.volume.map((point) => point.count) ?? [1]));
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Search quality</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Analytics</h1>
      <p className="mt-2 text-sm text-muted">
        Real query, latency, zero-result, impression, and click-through signals.
      </p>
      <section className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-panel bg-surface p-4">
        <label className="min-w-64 flex-1 text-xs text-slate-300">
          Index
          <select
            className="control mt-1.5"
            value={indexId}
            onChange={(event) => setIndexId(event.target.value)}
          >
            {indexes.map((index) => (
              <option key={index.id} value={index.id}>
                {index.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-300">
          Start
          <input
            className="control mt-1.5"
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="text-xs text-slate-300">
          End
          <input
            className="control mt-1.5"
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <button
          disabled={loading || indexId.length === 0}
          onClick={() => void loadAnalytics()}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </section>
      {error !== undefined && (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {overview === undefined ? (
        <div className="mt-6 rounded-xl border border-dashed border-panel p-14 text-center text-sm text-muted">
          Select an index and load analytics. Empty collections return zero values, never demo data.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total searches" value={overview.totalSearches.toLocaleString()} />
            <Metric label="Unique queries" value={overview.uniqueQueries.toLocaleString()} />
            <Metric label="Average latency" value={`${overview.averageLatencyMs.toFixed(2)} ms`} />
            <Metric
              label="Zero-result rate"
              value={`${(overview.zeroResultRate * 100).toFixed(1)}%`}
            />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="rounded-xl border border-panel bg-surface p-5">
              <h2 className="text-sm font-semibold text-white">Search volume</h2>
              <div className="mt-5 flex h-48 items-end gap-2">
                {overview.volume.map((point) => (
                  <div
                    key={point.date}
                    className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-[9px] text-subtle opacity-0 group-hover:opacity-100">
                      {point.count}
                    </span>
                    <div
                      className="w-full rounded-t bg-accent/70"
                      style={{ height: `${Math.max(3, (point.count / maximumVolume) * 150)}px` }}
                    />
                    <span className="max-w-full truncate font-mono text-[8px] text-subtle">
                      {point.date.slice(5)}
                    </span>
                  </div>
                ))}
                {overview.volume.length === 0 && (
                  <p className="m-auto text-xs text-muted">No searches in this range.</p>
                )}
              </div>
            </section>
            <section className="rounded-xl border border-panel bg-surface p-5">
              <h2 className="text-sm font-semibold text-white">Latency percentiles</h2>
              <div className="mt-5 space-y-4">
                <Latency label="p50" value={overview.latency.p50} />
                <Latency label="p95" value={overview.latency.p95} />
                <Latency label="p99" value={overview.latency.p99} />
              </div>
              <div className="mt-7 border-t border-panel pt-5">
                <p className="text-xs text-muted">Click-through rate</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {((clicks?.ctr ?? 0) * 100).toFixed(2)}%
                </p>
                <p className="mt-1 text-[10px] text-subtle">
                  {clicks?.clicks ?? 0} clicks / {clicks?.impressions ?? 0} impressions · avg
                  position {clicks?.averageClickedPosition.toFixed(1) ?? '0.0'}
                </p>
              </div>
            </section>
          </div>
          <section className="mt-6 overflow-x-auto rounded-xl border border-panel bg-surface">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="border-b border-panel font-mono text-[10px] uppercase tracking-wider text-subtle">
                <tr>
                  {[
                    'Query',
                    'Searches',
                    'Avg results',
                    'Avg latency',
                    'Zero result',
                    'Impressions',
                    'Clicks',
                    'CTR',
                  ].map((value) => (
                    <th key={value} className="px-4 py-3">
                      {value}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queries.map((query) => (
                  <tr key={query.normalizedQuery} className="border-b border-panel last:border-0">
                    <td className="px-4 py-3 font-mono text-slate-200">
                      {query.normalizedQuery || '(empty)'}
                    </td>
                    <td className="px-4">{query.searchCount}</td>
                    <td className="px-4">{query.averageResultCount.toFixed(1)}</td>
                    <td className="px-4">{query.averageLatencyMs.toFixed(2)} ms</td>
                    <td className="px-4">{(query.zeroResultRate * 100).toFixed(1)}%</td>
                    <td className="px-4">{query.impressions}</td>
                    <td className="px-4">{query.clicks}</td>
                    <td className="px-4 text-accent">{(query.ctr * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {queries.length === 0 && (
              <div className="p-12 text-center text-sm text-muted">No queries in this range.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-panel bg-surface p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}
function Latency({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-panel pb-3">
      <span className="font-mono text-xs text-muted">{label}</span>
      <span className="font-mono text-sm text-slate-200">{value.toFixed(2)} ms</span>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import type { IndexView } from '../lib/types';

interface Health {
  status: string;
  dependencies?: Record<string, string>;
}
interface AnalyticsOverview {
  totalSearches: number;
  averageLatencyMs: number;
  zeroResultRate: number;
}
interface CrawlJob {
  readonly id: string;
  readonly status: string;
  readonly indexed: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export function OverviewDashboard() {
  const [indexes, setIndexes] = useState<readonly IndexView[]>([]);
  const [health, setHealth] = useState<Health>();
  const [analytics, setAnalytics] = useState<AnalyticsOverview[]>([]);
  const [error, setError] = useState<string>();
  const [crawlJobs, setCrawlJobs] = useState<readonly CrawlJob[]>([]);
  useEffect(() => {
    void Promise.all([
      apiRequest<{ indexes: readonly IndexView[] }>('/v1/indexes'),
      apiRequest<Health>('/ready'),
      apiRequest<{ jobs: readonly CrawlJob[] }>('/v1/crawl').catch(() => ({ jobs: [] })),
    ])
      .then(async ([indexBody, ready, crawlBody]) => {
        setIndexes(indexBody.indexes);
        setHealth(ready);
        setCrawlJobs(crawlBody.jobs);
        const values = await Promise.all(
          indexBody.indexes.map((index) =>
            apiRequest<AnalyticsOverview>(`/v1/indexes/${index.id}/analytics/overview`).catch(
              () => undefined,
            ),
          ),
        );
        setAnalytics(values.filter((value): value is AnalyticsOverview => value !== undefined));
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Overview unavailable'),
      );
  }, []);
  const documents = indexes.reduce((total, index) => total + index.documentCount, 0);
  const queries = analytics.reduce((total, value) => total + value.totalSearches, 0);
  const averageLatency =
    analytics.length === 0
      ? 0
      : analytics.reduce((total, value) => total + value.averageLatencyMs, 0) / analytics.length;
  const zeroRate =
    analytics.length === 0
      ? 0
      : analytics.reduce((total, value) => total + value.zeroResultRate, 0) / analytics.length;
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            System overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Your search infrastructure
          </h1>
          <p className="mt-2 text-sm text-muted">
            Live index, query, and service signals. No seeded dashboard values.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-xs ${health?.status === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}
        >
          {health?.status === 'ok' ? 'All systems ready' : 'Checking services'}
        </span>
      </div>
      {error && (
        <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}. Add an API key in API Keys if authentication is enabled.
        </p>
      )}
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Indexes"
          value={indexes.length.toLocaleString()}
          detail={`${indexes.filter((index) => index.status === 'ready').length} ready`}
          loading={health === undefined && error === undefined}
        />
        <Metric
          label="Documents"
          value={documents.toLocaleString()}
          detail="across all indexes"
          loading={health === undefined && error === undefined}
        />
        <Metric
          label="Searches · 30d"
          value={queries.toLocaleString()}
          detail={`${averageLatency.toFixed(1)} ms average`}
          loading={health === undefined && error === undefined}
        />
        <Metric
          label="Zero results"
          value={`${(zeroRate * 100).toFixed(1)}%`}
          detail="unweighted index average"
          loading={health === undefined && error === undefined}
        />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-panel bg-surface">
          <div className="flex items-center justify-between border-b border-panel p-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Indexes</h2>
              <p className="mt-1 text-xs text-muted">Capacity and indexing state</p>
            </div>
            <Link href="/indexes" className="text-xs text-accent">
              Manage indexes →
            </Link>
          </div>
          {indexes.length === 0 ? (
            <Empty text="Create an index to begin ingesting searchable documents." />
          ) : (
            <div>
              {indexes.slice(0, 6).map((index) => (
                <Link
                  href={`/indexes/${index.id}`}
                  key={index.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-5 border-b border-panel px-5 py-4 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">{index.name}</p>
                    <p className="mt-1 font-mono text-[10px] text-subtle">{index.id}</p>
                  </div>
                  <span className="text-xs text-muted">
                    {index.documentCount.toLocaleString()} docs
                  </span>
                  <span className="size-2 rounded-full bg-accent" />
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-xl border border-panel bg-surface p-5">
          <h2 className="text-sm font-semibold text-white">Service readiness</h2>
          <div className="mt-5 space-y-3">
            {Object.entries(health?.dependencies ?? {}).map(([name, status]) => (
              <div
                className="flex items-center justify-between rounded-lg border border-panel bg-canvas p-3"
                key={name}
              >
                <span className="text-xs capitalize text-slate-300">{name}</span>
                <span className={status === 'up' ? 'text-xs text-accent' : 'text-xs text-red-300'}>
                  {status}
                </span>
              </div>
            ))}
            {health === undefined && (
              <p className="text-xs text-muted">Waiting for the readiness probe…</p>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              className="rounded-lg border border-panel bg-canvas p-3 text-center text-xs text-slate-300"
              href="/search-playground"
            >
              Test search
            </Link>
            <Link
              className="rounded-lg bg-accent p-3 text-center text-xs font-semibold text-slate-950"
              href="/indexes"
            >
              Add data
            </Link>
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-panel bg-surface p-5">
        <h2 className="text-sm font-semibold text-white">Recent indexing activity</h2>
        {indexes.some((index) => index.lastIndexedAt) || crawlJobs.length > 0 ? (
          <div className="mt-4 space-y-2">
            {crawlJobs.slice(0, 3).map((job) => (
              <div
                key={job.id}
                className="flex justify-between rounded-lg bg-canvas px-4 py-3 text-xs"
              >
                <span className="text-slate-300">
                  Crawl {job.status} · {job.indexed} indexed
                </span>
                <time className="text-muted">
                  {new Date(job.completedAt ?? job.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
            {indexes
              .filter((index) => index.lastIndexedAt)
              .sort((a, b) => String(b.lastIndexedAt).localeCompare(String(a.lastIndexedAt)))
              .slice(0, 5)
              .map((index) => (
                <div
                  key={index.id}
                  className="flex justify-between rounded-lg bg-canvas px-4 py-3 text-xs"
                >
                  <span className="text-slate-300">{index.name} indexed</span>
                  <time className="text-muted">
                    {new Date(index.lastIndexedAt as string).toLocaleString()}
                  </time>
                </div>
              ))}
          </div>
        ) : (
          <Empty text="Indexing activity appears here after documents are added." />
        )}
      </section>
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  loading = false,
}: {
  label: string;
  value: string;
  detail: string;
  loading?: boolean;
}) {
  return (
    <article className="rounded-xl border border-panel bg-surface p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
      {loading ? (
        <div aria-label={`Loading ${label}`} className="mt-3 animate-pulse">
          <div className="h-9 w-24 rounded bg-elevated" />
          <div className="mt-2 h-3 w-32 rounded bg-elevated" />
        </div>
      ) : (
        <>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-xs text-subtle">{detail}</p>
        </>
      )}
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="m-5 rounded-lg border border-dashed border-panel p-8 text-center text-xs text-muted">
      {text}
    </p>
  );
}

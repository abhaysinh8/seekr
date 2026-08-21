'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import type { IndexView } from '../lib/types';

interface Source {
  id: string;
  projectId: string;
  indexId: string;
  name: string;
  startingUrl: string;
  createdAt: string;
}
interface Job {
  id: string;
  sourceId: string;
  status: string;
  discovered: number;
  fetched: number;
  indexed: number;
  skipped: number;
  failed: number;
  createdAt: string;
}
export function CrawlerDashboard() {
  const [indexes, setIndexes] = useState<readonly IndexView[]>([]);
  const [sources, setSources] = useState<readonly Source[]>([]);
  const [jobs, setJobs] = useState<readonly Job[]>([]);
  const [name, setName] = useState('');
  const [startingUrl, setStartingUrl] = useState('');
  const [indexId, setIndexId] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [indexBody, sourceBody, jobBody] = await Promise.all([
      apiRequest<{ indexes: readonly IndexView[] }>('/v1/indexes'),
      apiRequest<{ sources: readonly Source[] }>('/v1/sources'),
      apiRequest<{ jobs: readonly Job[] }>('/v1/crawl'),
    ]);
    setIndexes(indexBody.indexes);
    setIndexId((current) => current || indexBody.indexes[0]?.id || '');
    setSources(sourceBody.sources);
    setJobs(jobBody.jobs);
  }
  useEffect(() => {
    // Data arrives asynchronously; refresh is also reused by create/start actions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Crawler data unavailable'),
    );
  }, []);
  async function createSource() {
    const index = indexes.find((candidate) => candidate.id === indexId);
    if (!index) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest('/v1/sources', {
        method: 'POST',
        body: JSON.stringify({ projectId: index.projectId, indexId, name, startingUrl }),
      });
      setName('');
      setStartingUrl('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create source');
    } finally {
      setBusy(false);
    }
  }
  async function crawl(sourceId: string) {
    setBusy(true);
    try {
      await apiRequest(`/v1/sources/${sourceId}/crawl`, { method: 'POST' });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not queue crawl');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Ingestion</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Crawler</h1>
      <p className="mt-2 text-sm text-muted">
        Create allowlisted web sources and observe durable crawl progress.
      </p>
      {error && (
        <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}
      <section className="mt-6 grid gap-3 rounded-xl border border-panel bg-surface p-5 md:grid-cols-[1fr_1.5fr_1fr_auto]">
        <input
          className="control"
          placeholder="Source name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="control"
          placeholder="https://docs.example.com"
          value={startingUrl}
          onChange={(event) => setStartingUrl(event.target.value)}
        />
        <select
          className="control"
          value={indexId}
          onChange={(event) => setIndexId(event.target.value)}
        >
          {indexes.map((index) => (
            <option key={index.id} value={index.id}>
              {index.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !name || !startingUrl || !indexId}
          onClick={() => void createSource()}
          className="rounded-lg bg-accent px-4 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          Add source
        </button>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-panel bg-surface p-5">
          <h2 className="text-sm font-semibold text-white">Sources</h2>
          {sources.length === 0 ? (
            <p className="mt-5 text-xs text-muted">No crawl sources yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="rounded-lg border border-panel bg-canvas p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-200">{source.name}</p>
                      <p className="mt-1 break-all text-xs text-muted">{source.startingUrl}</p>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => void crawl(source.id)}
                      className="h-fit rounded-md border border-accent/40 px-3 py-2 text-xs text-accent"
                    >
                      Crawl now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-xl border border-panel bg-surface p-5">
          <h2 className="text-sm font-semibold text-white">Recent jobs</h2>
          {jobs.length === 0 ? (
            <p className="mt-5 text-xs text-muted">Queued and completed jobs appear here.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-lg bg-canvas p-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{job.status}</span>
                    <span className="text-muted">
                      {job.indexed} indexed · {job.failed} failed
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded bg-elevated">
                    <div
                      className="h-full bg-accent"
                      style={{
                        width: `${job.discovered === 0 ? 0 : Math.min(100, ((job.fetched + job.failed + job.skipped) / job.discovered) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

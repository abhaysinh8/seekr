'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import type { IndexView } from '../lib/types';

interface RecommendationView {
  readonly itemId: string;
  readonly score: number;
  readonly reasons?: {
    readonly collaborative: number;
    readonly content: number;
    readonly popularity: number;
    readonly recency: number;
  };
}
type Mode = 'item' | 'user' | 'popular';

export function RecommendationPlayground() {
  const [indexes, setIndexes] = useState<readonly IndexView[]>([]);
  const [indexId, setIndexId] = useState('');
  const [mode, setMode] = useState<Mode>('user');
  const [identifier, setIdentifier] = useState('');
  const [limit, setLimit] = useState(10);
  const [explain, setExplain] = useState(true);
  const [recommendations, setRecommendations] = useState<readonly RecommendationView[]>();
  const [interactionUser, setInteractionUser] = useState('');
  const [interactionItem, setInteractionItem] = useState('');
  const [interactionType, setInteractionType] = useState('click');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void apiRequest<{ indexes: readonly IndexView[] }>('/v1/indexes')
      .then((body) => {
        setIndexes(body.indexes);
        setIndexId(body.indexes[0]?.id ?? '');
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Could not load indexes'),
      );
  }, []);

  async function recommend() {
    setLoading(true);
    setError(undefined);
    try {
      const suffix = `indexId=${encodeURIComponent(indexId)}&limit=${limit}&explain=${explain}`;
      const path =
        mode === 'popular'
          ? `/v1/recommend/popular?${suffix}`
          : mode === 'item'
            ? `/v1/recommend/items/${encodeURIComponent(identifier)}?${suffix}`
            : `/v1/recommend/users/${encodeURIComponent(identifier)}?${suffix}`;
      const body = await apiRequest<{ recommendations: readonly RecommendationView[] }>(path);
      setRecommendations(body.recommendations);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Recommendation failed');
    } finally {
      setLoading(false);
    }
  }

  async function recordInteraction(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      await apiRequest('/v1/interactions', {
        method: 'POST',
        body: JSON.stringify({
          indexId,
          userId: interactionUser,
          itemId: interactionItem,
          type: interactionType,
        }),
      });
      setNotice('Interaction recorded. Collaborative neighbors will refresh on the next request.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not record interaction');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Discovery</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Recommendation Playground</h1>
      <p className="mt-2 text-sm text-muted">
        Explore content, collaborative, popularity, and hybrid signals computed inside Seekr.
      </p>
      {error !== undefined && <Message tone="error">{error}</Message>}
      {notice !== undefined && <Message tone="success">{notice}</Message>}
      <div className="mt-7 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-panel bg-surface p-5">
            <h2 className="text-sm font-semibold text-white">Recommendation request</h2>
            <label className="mt-4 block text-xs text-slate-300">
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
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(['user', 'item', 'popular'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-lg border px-3 py-2 text-xs capitalize ${mode === value ? 'border-accent/50 bg-accent/10 text-accent' : 'border-panel text-muted'}`}
                >
                  {value}
                </button>
              ))}
            </div>
            {mode !== 'popular' && (
              <label className="mt-4 block text-xs text-slate-300">
                {mode === 'user' ? 'User ID' : 'Item ID'}
                <input
                  className="control mt-1.5 font-mono"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </label>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-300">
                Limit
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="control mt-1.5"
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                />
              </label>
              <label className="mt-6 flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  className="accent-emerald-400"
                  checked={explain}
                  onChange={(event) => setExplain(event.target.checked)}
                />
                Explain hybrid scores
              </label>
            </div>
            <button
              disabled={
                loading || indexId.length === 0 || (mode !== 'popular' && identifier.length === 0)
              }
              onClick={() => void recommend()}
              className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {loading ? 'Computing…' : 'Recommend'}
            </button>
          </section>
          <form
            onSubmit={(event) => void recordInteraction(event)}
            className="rounded-xl border border-panel bg-surface p-5"
          >
            <h2 className="text-sm font-semibold text-white">Record interaction</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Use a real user and indexed item to enrich collaborative signals.
            </p>
            <label className="mt-4 block text-xs text-slate-300">
              User ID
              <input
                className="control mt-1.5 font-mono"
                value={interactionUser}
                onChange={(event) => setInteractionUser(event.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-xs text-slate-300">
              Item ID
              <input
                className="control mt-1.5 font-mono"
                value={interactionItem}
                onChange={(event) => setInteractionItem(event.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-xs text-slate-300">
              Type
              <select
                className="control mt-1.5"
                value={interactionType}
                onChange={(event) => setInteractionType(event.target.value)}
              >
                {['view', 'click', 'bookmark', 'like', 'purchase'].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <button className="mt-4 w-full rounded-lg border border-panel bg-elevated px-4 py-2 text-xs font-medium text-white">
              Record
            </button>
          </form>
        </div>
        <section className="min-w-0">
          {recommendations === undefined ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {recommendations.length === 0 && (
                <Empty message="No candidates are available. Add content or interactions to this index." />
              )}
              {recommendations.map((item, rank) => (
                <article
                  key={item.itemId}
                  className="rounded-xl border border-panel bg-surface p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-accent">
                        Rank {rank + 1}
                      </p>
                      <h2 className="mt-1 font-mono text-sm text-white">{item.itemId}</h2>
                    </div>
                    <span className="rounded-lg border border-panel bg-canvas px-3 py-2 font-mono text-sm text-accent">
                      {item.score.toFixed(6)}
                    </span>
                  </div>
                  {item.reasons !== undefined && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(item.reasons).map(([reason, score]) => (
                        <div key={reason} className="rounded-lg border border-panel bg-canvas p-3">
                          <p className="font-mono text-[9px] uppercase text-subtle">{reason}</p>
                          <p className="mt-2 font-mono text-sm text-slate-200">
                            {score.toFixed(4)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Empty({
  message = 'Choose a mode and request recommendations. Results come only from indexed documents and recorded interactions.',
}: {
  message?: string;
}) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-panel bg-surface/40 p-12 text-center text-sm leading-6 text-muted">
      {message}
    </div>
  );
}
function Message({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div
      className={`mt-5 rounded-lg border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-accent/30 bg-accent/10 text-emerald-200'}`}
    >
      {children}
    </div>
  );
}

'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import type { IndexView } from '../lib/types';

export function DocumentsOverview() {
  const [indexes, setIndexes] = useState<readonly IndexView[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void apiRequest<{ indexes: readonly IndexView[] }>('/v1/indexes')
      .then((body) => setIndexes(body.indexes))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Could not load documents'),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Content catalog</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Documents</h1>
      <p className="mt-2 text-sm text-muted">
        Open an index to browse, add, bulk ingest, update, or delete its actual documents.
      </p>
      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </p>
      )}
      {loading ? (
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-surface" />
      ) : indexes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-panel p-14 text-center text-sm text-muted">
          Create an index before ingesting documents.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {indexes.map((index) => (
            <Link
              href={`/indexes/${index.id}`}
              key={index.id}
              className="rounded-xl border border-panel bg-surface p-5 hover:border-accent/40"
            >
              <div className="flex justify-between">
                <h2 className="text-sm font-semibold text-white">{index.name}</h2>
                <span className="text-xs text-accent">{index.status}</span>
              </div>
              <p className="mt-5 text-3xl font-semibold text-white">
                {index.documentCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">
                documents · {index.termCount.toLocaleString()} terms
              </p>
              <p className="mt-5 text-xs text-accent">Manage documents →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

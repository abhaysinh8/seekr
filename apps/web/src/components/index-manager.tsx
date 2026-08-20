'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiRequest } from '../lib/api';
import type { IndexView } from '../lib/types';

const defaultSchema = JSON.stringify(
  {
    fields: {
      title: { type: 'text', searchable: true, weight: 3 },
      content: { type: 'text', searchable: true, weight: 1 },
      category: { type: 'string', filterable: true, facetable: true },
    },
  },
  null,
  2,
);

export function IndexManager() {
  const [indexes, setIndexes] = useState<readonly IndexView[]>([]);
  const [projectId, setProjectId] = useState('');
  const [indexName, setIndexName] = useState('');
  const [schema, setSchema] = useState(defaultSchema);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = () =>
    apiRequest<{ indexes: readonly IndexView[] }>('/v1/indexes').then((body) =>
      setIndexes(body.indexes),
    );
  useEffect(() => {
    void load()
      .catch(showError)
      .finally(() => setLoading(false));
  }, []);

  function showError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'Request failed');
  }

  async function createProject(form: FormData) {
    setSaving(true);
    setError(undefined);
    try {
      const body = await apiRequest<{ project: { id: string } }>('/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          slug: form.get('slug'),
          ownerEmail: form.get('email'),
        }),
      });
      setProjectId(body.project.id);
      setNotice('Project created. Its ID is now selected below.');
    } catch (reason) {
      showError(reason);
    } finally {
      setSaving(false);
    }
  }

  async function createIndex(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await apiRequest('/v1/indexes', {
        method: 'POST',
        body: JSON.stringify({ projectId, name: indexName, schema: JSON.parse(schema) as unknown }),
      });
      setIndexName('');
      setNotice('Index created successfully.');
      await load();
    } catch (reason) {
      showError(reason);
    } finally {
      setSaving(false);
    }
  }

  async function deleteIndex(index: IndexView) {
    if (!window.confirm(`Delete ${index.name} and all of its documents? This cannot be undone.`))
      return;
    try {
      await apiRequest(`/v1/indexes/${index.id}`, { method: 'DELETE' });
      setNotice('Index deleted.');
      await load();
    } catch (reason) {
      showError(reason);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Collections</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Indexes</h1>
          <p className="mt-2 text-sm text-muted">
            Define schemas, ingest documents, and inspect real collection statistics.
          </p>
        </div>
        <button
          onClick={() =>
            document.getElementById('create-index')?.scrollIntoView({ behavior: 'smooth' })
          }
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Create index
        </button>
      </div>
      {error !== undefined && <Alert tone="error">{error}</Alert>}
      {notice !== undefined && <Alert tone="success">{notice}</Alert>}
      <section className="mt-7 overflow-hidden rounded-xl border border-panel bg-surface">
        <div className="grid grid-cols-[minmax(180px,1fr)_100px_100px_100px_160px_80px] gap-4 border-b border-panel px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-subtle">
          <span>Name</span>
          <span>Documents</span>
          <span>Terms</span>
          <span>Status</span>
          <span>Last indexed</span>
          <span />
        </div>
        {loading && <State>Loading indexes…</State>}
        {!loading && indexes.length === 0 && (
          <State>No indexes exist yet. Create the first one below.</State>
        )}
        {indexes.map((index) => (
          <div
            key={index.id}
            className="grid grid-cols-[minmax(180px,1fr)_100px_100px_100px_160px_80px] items-center gap-4 border-b border-panel px-5 py-4 last:border-0"
          >
            <div>
              <Link
                href={`/indexes/${index.id}`}
                className="text-sm font-medium text-white hover:text-accent"
              >
                {index.name}
              </Link>
              <p className="mt-1 font-mono text-[10px] text-subtle">{index.id}</p>
            </div>
            <span className="font-mono text-xs text-slate-300">
              {index.documentCount.toLocaleString()}
            </span>
            <span className="font-mono text-xs text-slate-300">
              {index.termCount.toLocaleString()}
            </span>
            <span className="w-fit rounded-full bg-accent/10 px-2 py-1 text-[10px] text-accent">
              {index.status}
            </span>
            <span className="text-xs text-muted">
              {index.lastIndexedAt === null
                ? 'Never'
                : new Date(index.lastIndexedAt).toLocaleString()}
            </span>
            <button
              onClick={() => void deleteIndex(index)}
              className="text-xs text-red-300 hover:text-red-200"
            >
              Delete
            </button>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]" id="create-index">
        <form
          action={(form) => void createProject(form)}
          className="rounded-xl border border-panel bg-surface p-5"
        >
          <h2 className="text-sm font-semibold text-white">Create a project</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            A project owns indexes and API keys. Existing users can paste a project ID in the next
            panel.
          </p>
          <FormInput name="name" label="Project name" required />
          <FormInput name="slug" label="Slug" placeholder="my-project" required />
          <FormInput name="email" label="Owner email" type="email" required />
          <button
            disabled={saving}
            className="rounded-lg border border-panel bg-elevated px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Create project
          </button>
        </form>
        <form
          onSubmit={(event) => void createIndex(event)}
          className="rounded-xl border border-panel bg-surface p-5"
        >
          <h2 className="text-sm font-semibold text-white">Create an index</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-slate-300">
              Project ID
              <input
                className="control mt-1.5 font-mono"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                required
              />
            </label>
            <label className="text-xs text-slate-300">
              Index name
              <input
                className="control mt-1.5"
                value={indexName}
                onChange={(event) => setIndexName(event.target.value)}
                required
              />
            </label>
          </div>
          <label className="mt-4 block text-xs text-slate-300">
            Schema JSON
            <textarea
              className="control mt-1.5 min-h-64 font-mono text-[11px] leading-5"
              value={schema}
              onChange={(event) => setSchema(event.target.value)}
            />
          </label>
          <button
            disabled={saving}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create index'}
          </button>
        </form>
      </div>
    </div>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props;
  return (
    <label className="mt-4 block text-xs text-slate-300">
      {label}
      <input {...input} className="control mt-1.5" />
    </label>
  );
}
function State({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-12 text-center text-sm text-muted">{children}</div>;
}
function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div
      className={`mt-5 rounded-lg border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-accent/30 bg-accent/10 text-emerald-200'}`}
    >
      {children}
    </div>
  );
}

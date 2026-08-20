'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiRequest } from '../lib/api';
import type { IndexView } from '../lib/types';

interface DocumentView {
  readonly id: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
}
type Tab = 'Overview' | 'Documents' | 'Schema' | 'Search' | 'Analytics' | 'Settings';
const tabs: readonly Tab[] = ['Overview', 'Documents', 'Schema', 'Search', 'Analytics', 'Settings'];

export function IndexDetail({ indexId }: { indexId: string }) {
  const [index, setIndex] = useState<IndexView>();
  const [documents, setDocuments] = useState<readonly DocumentView[]>([]);
  const [documentTotal, setDocumentTotal] = useState(0);
  const [tab, setTab] = useState<Tab>('Overview');
  const [documentJson, setDocumentJson] = useState('{\n  "id": "doc-1",\n  "fields": {}\n}');
  const [schemaJson, setSchemaJson] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [loading, setLoading] = useState(true);

  async function load() {
    const [indexBody, documentBody] = await Promise.all([
      apiRequest<{ index: IndexView }>(`/v1/indexes/${indexId}`),
      apiRequest<{ documents: readonly DocumentView[]; total: number }>(
        `/v1/indexes/${indexId}/documents?limit=100&offset=0`,
      ),
    ]);
    setIndex(indexBody.index);
    setDocuments(documentBody.documents);
    setDocumentTotal(documentBody.total);
    setSchemaJson(JSON.stringify(indexBody.index.schema, null, 2));
  }
  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<{ index: IndexView }>(`/v1/indexes/${indexId}`),
      apiRequest<{ documents: readonly DocumentView[]; total: number }>(
        `/v1/indexes/${indexId}/documents?limit=100&offset=0`,
      ),
    ])
      .then(([indexBody, documentBody]) => {
        if (!active) return;
        setIndex(indexBody.index);
        setDocuments(documentBody.documents);
        setDocumentTotal(documentBody.total);
        setSchemaJson(JSON.stringify(indexBody.index.schema, null, 2));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Request failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [indexId]);
  function showError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'Request failed');
  }

  async function importDocuments() {
    setError(undefined);
    try {
      const parsed = JSON.parse(documentJson) as unknown;
      const documentsInput = Array.isArray(parsed) ? parsed : [parsed];
      await apiRequest(`/v1/indexes/${indexId}/documents/bulk`, {
        method: 'POST',
        body: JSON.stringify({ documents: documentsInput }),
      });
      setNotice(
        `${documentsInput.length} document${documentsInput.length === 1 ? '' : 's'} indexed.`,
      );
      await load();
    } catch (reason) {
      showError(reason);
    }
  }
  async function removeDocument(documentId: string) {
    try {
      await apiRequest(`/v1/indexes/${indexId}/documents/${encodeURIComponent(documentId)}`, {
        method: 'DELETE',
      });
      setNotice('Document deleted.');
      await load();
    } catch (reason) {
      showError(reason);
    }
  }
  async function updateSchema() {
    if (!window.confirm('Changing schema rebuilds postings for every current document. Continue?'))
      return;
    try {
      const result = await apiRequest<{ reindexedDocuments: number }>(
        `/v1/indexes/${indexId}/schema`,
        { method: 'PUT', body: JSON.stringify({ schema: JSON.parse(schemaJson) as unknown }) },
      );
      setNotice(`Schema updated; ${result.reindexedDocuments} documents reindexed.`);
      await load();
    } catch (reason) {
      showError(reason);
    }
  }
  async function reindex() {
    try {
      const result = await apiRequest<{ reindexedDocuments: number }>(
        `/v1/indexes/${indexId}/reindex`,
        { method: 'POST' },
      );
      setNotice(`${result.reindexedDocuments} documents reindexed.`);
      await load();
    } catch (reason) {
      showError(reason);
    }
  }

  if (loading) return <PageState>Loading index…</PageState>;
  if (index === undefined) return <PageState>{error ?? 'Index not found.'}</PageState>;
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <Link href="/indexes" className="text-xs text-muted hover:text-white">
        ← All indexes
      </Link>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-white">{index.name}</h1>
            <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] text-accent">
              {index.status}
            </span>
          </div>
          <p className="mt-2 font-mono text-xs text-subtle">{index.id}</p>
        </div>
        <button
          onClick={() => void reindex()}
          className="rounded-lg border border-panel bg-surface px-4 py-2 text-xs font-medium text-white hover:bg-elevated"
        >
          Reindex
        </button>
      </div>
      {error !== undefined && <Banner tone="error">{error}</Banner>}
      {notice !== undefined && <Banner tone="success">{notice}</Banner>}
      <nav className="mt-7 flex gap-1 overflow-x-auto border-b border-panel">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`border-b-2 px-4 py-3 text-xs font-medium ${tab === item ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="pt-6">
        {tab === 'Overview' && <Overview index={index} />}
        {tab === 'Documents' && (
          <Documents
            documents={documents}
            total={documentTotal}
            json={documentJson}
            setJson={setDocumentJson}
            onImport={() => void importDocuments()}
            onDelete={(id) => void removeDocument(id)}
          />
        )}
        {tab === 'Schema' && (
          <SchemaEditor
            value={schemaJson}
            onChange={setSchemaJson}
            onSave={() => void updateSchema()}
          />
        )}
        {tab === 'Search' && (
          <Panel title="Test this index">
            <p className="text-sm text-muted">
              Open the Search Playground and select{' '}
              <strong className="text-slate-200">{index.name}</strong> to inspect ranked results.
            </p>
            <Link
              href="/search-playground"
              className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Open playground
            </Link>
          </Panel>
        )}
        {tab === 'Analytics' && (
          <Panel title="Search analytics">
            <p className="text-sm text-muted">
              No analytics summary is available until this index receives search traffic. This panel
              never generates sample metrics.
            </p>
          </Panel>
        )}
        {tab === 'Settings' && (
          <Panel title="Index settings">
            <dl className="grid gap-4 text-xs sm:grid-cols-2">
              <Datum label="Project ID" value={index.projectId} />
              <Datum label="Created" value={new Date(index.createdAt).toLocaleString()} />
            </dl>
            <p className="mt-6 text-xs text-red-200">
              Delete operations are available from the index list and require confirmation.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Overview({ index }: { index: IndexView }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Documents" value={index.documentCount.toLocaleString()} />
      <Metric label="Vocabulary terms" value={index.termCount.toLocaleString()} />
      <Metric label="Schema fields" value={Object.keys(index.schema.fields).length.toString()} />
      <Metric
        label="Last indexed"
        value={
          index.lastIndexedAt === null ? 'Never' : new Date(index.lastIndexedAt).toLocaleString()
        }
      />
    </div>
  );
}
function Documents({
  documents,
  total,
  json,
  setJson,
  onImport,
  onDelete,
}: {
  documents: readonly DocumentView[];
  total: number;
  json: string;
  setJson: (value: string) => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-xl border border-panel bg-surface">
        <div className="border-b border-panel px-5 py-4 text-sm font-medium text-white">
          Documents <span className="ml-2 font-mono text-xs text-muted">{total}</span>
        </div>
        {documents.length === 0 && (
          <div className="p-12 text-center text-sm text-muted">No documents have been indexed.</div>
        )}
        {documents.map((document) => (
          <details key={document.id} className="border-b border-panel px-5 py-4 last:border-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span className="font-mono text-xs text-slate-200">{document.id}</span>
              <button
                onClick={(event) => {
                  event.preventDefault();
                  onDelete(document.id);
                }}
                className="text-xs text-red-300"
              >
                Delete
              </button>
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-canvas p-3 text-xs leading-5 text-slate-300">
              {JSON.stringify(document, null, 2)}
            </pre>
          </details>
        ))}
      </section>
      <Panel title="Add or bulk import JSON">
        <p className="mb-3 text-xs leading-5 text-muted">
          Paste one document object or an array of up to 1,000. Fields are validated against the
          schema.
        </p>
        <textarea
          value={json}
          onChange={(event) => setJson(event.target.value)}
          className="control min-h-80 font-mono text-[11px] leading-5"
        />
        <button
          onClick={onImport}
          className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Index JSON
        </button>
      </Panel>
    </div>
  );
}
function SchemaEditor({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <Panel title="Schema configuration">
      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-200">
        Changing searchable flags, field weights, or field types requires reindexing. Seekr
        validates every stored document and rebuilds this index synchronously.
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="control min-h-[420px] font-mono text-xs leading-5"
      />
      <button
        onClick={onSave}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950"
      >
        Validate and update
      </button>
    </Panel>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-panel bg-surface p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
    </article>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-panel bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-subtle">{label}</dt>
      <dd className="mt-1 font-mono text-slate-300">{value}</dd>
    </div>
  );
}
function Banner({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div
      className={`mt-5 rounded-lg border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-accent/30 bg-accent/10 text-emerald-200'}`}
    >
      {children}
    </div>
  );
}
function PageState({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[500px] place-items-center text-sm text-muted">{children}</div>;
}

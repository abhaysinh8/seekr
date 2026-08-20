'use client';

import { useState } from 'react';

import { apiRequest, setSessionApiKey } from '../lib/api';

const scopes = [
  'search',
  'documents:read',
  'documents:write',
  'indexes:read',
  'indexes:write',
  'analytics:read',
] as const;
interface ApiKeyView {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly scopes: readonly string[];
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
}

export function ApiKeyManager() {
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<readonly string[]>(['search']);
  const [keys, setKeys] = useState<readonly ApiKeyView[]>([]);
  const [revealedKey, setRevealedKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  function showError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'Request failed');
  }
  async function load() {
    const body = await apiRequest<{ keys: readonly ApiKeyView[] }>(
      `/v1/api-keys?projectId=${projectId}`,
    );
    setKeys(body.keys);
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      const body = await apiRequest<{ rawKey: string; key: ApiKeyView }>('/v1/api-keys', {
        method: 'POST',
        body: JSON.stringify({ projectId, name, scopes: selectedScopes }),
      });
      setRevealedKey(body.rawKey);
      setName('');
      setNotice('Key created. Copy it now; Seekr cannot display it again.');
      setKeys((current) => [body.key, ...current]);
    } catch (reason) {
      showError(reason);
    }
  }
  async function revoke(id: string) {
    try {
      await apiRequest(`/v1/api-keys/${id}`, { method: 'DELETE' });
      setNotice('Key revoked.');
      await load();
    } catch (reason) {
      showError(reason);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Access control</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">API Keys</h1>
      <p className="mt-2 text-sm text-muted">
        Issue scoped credentials. Secrets are salted and hashed, and the complete key is returned
        once.
      </p>
      {error !== undefined && <Message tone="error">{error}</Message>}
      {notice !== undefined && <Message tone="success">{notice}</Message>}
      {revealedKey !== undefined && (
        <section className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-amber-100">Save this key now</h2>
              <p className="mt-1 text-xs text-amber-200/70">
                It will not appear in the list after you leave this view.
              </p>
            </div>
            <button onClick={() => setRevealedKey(undefined)} className="text-xs text-amber-200">
              Dismiss
            </button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-canvas p-4 font-mono text-xs text-white">
            {revealedKey}
          </pre>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void navigator.clipboard.writeText(revealedKey)}
              className="rounded-lg bg-amber-200 px-3 py-2 text-xs font-semibold text-amber-950"
            >
              Copy key
            </button>
            <button
              onClick={() => {
                setSessionApiKey(revealedKey);
                setNotice(
                  'This key will authenticate dashboard requests for the current browser session.',
                );
              }}
              className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs text-amber-100"
            >
              Use for this session
            </button>
          </div>
        </section>
      )}
      <div className="mt-7 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form
          onSubmit={(event) => void create(event)}
          className="h-fit rounded-xl border border-panel bg-surface p-5"
        >
          <h2 className="text-sm font-semibold text-white">Create key</h2>
          <label className="mt-4 block text-xs text-slate-300">
            Project ID
            <input
              className="control mt-1.5 font-mono"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              required
            />
          </label>
          <label className="mt-4 block text-xs text-slate-300">
            Key name
            <input
              className="control mt-1.5"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <fieldset className="mt-4">
            <legend className="text-xs text-slate-300">Scopes</legend>
            <div className="mt-2 space-y-2">
              {scopes.map((scope) => (
                <label
                  key={scope}
                  className="flex items-center gap-2 rounded-lg border border-panel bg-canvas px-3 py-2 font-mono text-[11px] text-muted"
                >
                  <input
                    type="checkbox"
                    className="accent-emerald-400"
                    checked={selectedScopes.includes(scope)}
                    onChange={() =>
                      setSelectedScopes(
                        selectedScopes.includes(scope)
                          ? selectedScopes.filter((value) => value !== scope)
                          : [...selectedScopes, scope],
                      )
                    }
                  />
                  {scope}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950">
            Create key
          </button>
        </form>
        <section className="overflow-hidden rounded-xl border border-panel bg-surface">
          <div className="flex items-center justify-between border-b border-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Project keys</h2>
            <button
              onClick={() => void load().catch(showError)}
              disabled={projectId.length === 0}
              className="rounded border border-panel px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
            >
              Load keys
            </button>
          </div>
          {keys.length === 0 && (
            <div className="p-12 text-center text-sm text-muted">
              Enter a project ID and load its keys. Authentication is required after bootstrap.
            </div>
          )}
          {keys.map((key) => (
            <div key={key.id} className="border-b border-panel p-5 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">{key.name}</p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    skr_{key.prefix}_••••••••••••
                  </p>
                </div>
                <button
                  disabled={key.revokedAt !== null}
                  onClick={() => void revoke(key.id)}
                  className="text-xs text-red-300 disabled:text-subtle"
                >
                  {key.revokedAt === null ? 'Revoke' : 'Revoked'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {key.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded bg-elevated px-2 py-1 font-mono text-[10px] text-muted"
                  >
                    {scope}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-subtle">
                Created {new Date(key.createdAt).toLocaleString()} · Last used{' '}
                {key.lastUsedAt === null ? 'never' : new Date(key.lastUsedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      </div>
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

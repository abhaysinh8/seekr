'use client';
import { useState } from 'react';
import { publicEnvironment } from '../config/environment';
import { setSessionApiKey } from '../lib/api';

export function ConnectionSettings() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Local dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Settings</h1>
      <section className="mt-7 rounded-xl border border-panel bg-surface p-6">
        <h2 className="text-sm font-semibold text-white">API connection</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          The dashboard connects to <code>{publicEnvironment.NEXT_PUBLIC_API_URL}</code>. API keys
          are kept only in this browser tab&apos;s session storage and are never persisted by the
          dashboard server.
        </p>
        <label className="mt-5 block text-xs text-slate-300">
          Scoped API key
          <input
            type="password"
            autoComplete="off"
            className="control mt-2"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setSaved(false);
            }}
            placeholder="skr_…"
          />
        </label>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => {
              setSessionApiKey(key.trim() || null);
              setSaved(true);
            }}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            Save for this session
          </button>
          <button
            onClick={() => {
              setKey('');
              setSessionApiKey(null);
              setSaved(true);
            }}
            className="rounded-lg border border-panel px-4 py-2.5 text-sm text-muted"
          >
            Clear
          </button>
        </div>
        {saved && <p className="mt-3 text-xs text-accent">Session connection updated.</p>}
      </section>
    </div>
  );
}

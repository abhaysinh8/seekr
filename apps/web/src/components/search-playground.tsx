'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiRequest, apiUrl, trackSearchClick } from '../lib/api';
import type { IndexView, SearchHitView, SearchResponseView } from '../lib/types';

type FilterInput = { field: string; operator: string; value?: unknown };

export function SearchPlayground() {
  const [indexes, setIndexes] = useState<readonly IndexView[]>([]);
  const [indexId, setIndexId] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [fields, setFields] = useState<readonly string[]>([]);
  const [filtersText, setFiltersText] = useState('[]');
  const [facetsText, setFacetsText] = useState('');
  const [typoTolerance, setTypoTolerance] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [explain, setExplain] = useState(false);
  const [result, setResult] = useState<SearchResponseView>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void apiRequest<{ indexes: readonly IndexView[] }>('/v1/indexes')
      .then(({ indexes: loaded }) => {
        setIndexes(loaded);
        setIndexId(loaded[0]?.id ?? '');
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Could not load indexes'),
      )
      .finally(() => setLoading(false));
  }, []);

  const selectedIndex = indexes.find((index) => index.id === indexId);
  const searchableFields = useMemo(
    () =>
      Object.entries(selectedIndex?.schema.fields ?? {})
        .filter(([, field]) => field.searchable)
        .map(([name]) => name),
    [selectedIndex],
  );
  const requestBody = useMemo(() => {
    let filters: FilterInput[] = [];
    try {
      filters = JSON.parse(filtersText) as FilterInput[];
    } catch {
      /* Shown on submit. */
    }
    return {
      query,
      limit,
      offset,
      ...(fields.length > 0 ? { fields } : {}),
      filters,
      facets: facetsText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      typoTolerance,
      highlight,
      explain,
      proximityBoost: true,
    };
  }, [query, limit, offset, fields, filtersText, facetsText, typoTolerance, highlight, explain]);

  async function executeSearch() {
    if (indexId.length === 0) return;
    setSearching(true);
    setError(undefined);
    try {
      JSON.parse(filtersText) as unknown;
      const response = await apiRequest<SearchResponseView>(`/v1/indexes/${indexId}/search`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      setResult(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  const curl = `curl -X POST '${apiUrl(`/v1/indexes/${indexId}/search`)}' -H 'Content-Type: application/json' --data '${JSON.stringify(requestBody)}'`;

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8 lg:px-8 lg:py-10">
      <div className="mb-7">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Developer tools</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Search Playground</h1>
        <p className="mt-2 text-sm text-muted">
          Send real queries to Seekr and inspect how every score was produced.
        </p>
      </div>

      {error !== undefined && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="h-fit rounded-xl border border-panel bg-surface p-5">
          <Field label="Index">
            <select
              className="control"
              disabled={loading}
              value={indexId}
              onChange={(event) => {
                setIndexId(event.target.value);
                setFields([]);
              }}
            >
              <option value="">{loading ? 'Loading indexes…' : 'Select an index'}</option>
              {indexes.map((index) => (
                <option key={index.id} value={index.id}>
                  {index.name}
                </option>
              ))}
            </select>
          </Field>
          {indexes.length === 0 && !loading && (
            <p className="mb-4 text-xs leading-5 text-amber-300">
              Create an index and add documents before using the playground.
            </p>
          )}
          <Field label="Query">
            <textarea
              className="control min-h-24 resize-y font-mono"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={'machine learning or "machine learning"'}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Limit">
              <input
                className="control"
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              />
            </Field>
            <Field label="Offset">
              <input
                className="control"
                type="number"
                min={0}
                max={10000}
                value={offset}
                onChange={(event) => setOffset(Number(event.target.value))}
              />
            </Field>
          </div>
          <Field label="Target fields">
            <div className="flex flex-wrap gap-2">
              {searchableFields.map((field) => (
                <ToggleChip
                  key={field}
                  label={field}
                  active={fields.includes(field)}
                  onClick={() =>
                    setFields(
                      fields.includes(field)
                        ? fields.filter((value) => value !== field)
                        : [...fields, field],
                    )
                  }
                />
              ))}
              {searchableFields.length === 0 && (
                <span className="text-xs text-subtle">No searchable fields</span>
              )}
            </div>
          </Field>
          <Field label="Filters (JSON array)">
            <textarea
              className="control min-h-20 resize-y font-mono text-xs"
              value={filtersText}
              onChange={(event) => setFiltersText(event.target.value)}
            />
          </Field>
          <Field label="Facets (comma separated)">
            <input
              className="control font-mono"
              value={facetsText}
              onChange={(event) => setFacetsText(event.target.value)}
              placeholder="brand, category"
            />
          </Field>
          <div className="mb-5 grid grid-cols-3 gap-2">
            <Check label="Typos" checked={typoTolerance} onChange={setTypoTolerance} />
            <Check label="Highlight" checked={highlight} onChange={setHighlight} />
            <Check label="Explain" checked={explain} onChange={setExplain} />
          </div>
          <button
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={searching || indexId.length === 0}
            onClick={() => void executeSearch()}
          >
            {searching ? 'Searching…' : 'Run search'}
          </button>
          <details className="mt-4 rounded-lg border border-panel bg-canvas p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-300">
              JSON request & cURL
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] leading-5 text-muted">
              {JSON.stringify(requestBody, null, 2)}
            </pre>
            <button
              className="mt-3 rounded border border-panel px-2.5 py-1.5 text-xs text-slate-300 hover:bg-elevated"
              onClick={() => void navigator.clipboard.writeText(curl)}
            >
              Copy as cURL
            </button>
          </details>
        </section>

        <section className="min-w-0">
          {result === undefined ? (
            <EmptyResults />
          ) : (
            <ResultList result={result} explain={explain} />
          )}
        </section>
      </div>
    </div>
  );
}

function ResultList({ result, explain }: { result: SearchResponseView; explain: boolean }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-panel bg-surface px-5 py-4">
        <strong className="text-sm text-white">{result.total.toLocaleString()} results</strong>
        <span className="text-xs text-muted">{result.processingTimeMs.toFixed(2)} ms</span>
        <span className="font-mono text-[10px] text-subtle">request {result.requestId}</span>
      </div>
      {Object.keys(result.facets).length > 0 && (
        <div className="mb-4 rounded-xl border border-panel bg-surface p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Facets</p>
          <pre className="overflow-x-auto text-xs text-slate-300">
            {JSON.stringify(result.facets, null, 2)}
          </pre>
        </div>
      )}
      <div className="space-y-3">
        {result.hits.map((hit, index) => (
          <ResultCard
            key={hit.documentId}
            hit={hit}
            rank={result.offset + index + 1}
            explain={explain}
            searchId={result.searchId}
          />
        ))}
        {result.hits.length === 0 && (
          <div className="rounded-xl border border-dashed border-panel p-12 text-center text-sm text-muted">
            No documents matched this request.
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  hit,
  rank,
  explain,
  searchId,
}: {
  hit: SearchHitView;
  rank: number;
  explain: boolean;
  searchId: string;
}) {
  const sourceCandidate = hit.document?.metadata?.sourceUrl ?? hit.document?.fields.url;
  const sourceUrl =
    typeof sourceCandidate === 'string' && /^https?:\/\//iu.test(sourceCandidate)
      ? sourceCandidate
      : undefined;
  return (
    <article className="rounded-xl border border-panel bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
            Rank {rank}
          </span>
          <h2 className="mt-1 font-mono text-sm text-white">{hit.documentId}</h2>
        </div>
        <div className="rounded-md border border-panel bg-canvas px-3 py-2 text-right">
          <p className="text-[10px] text-subtle">SCORE</p>
          <p className="font-mono text-sm text-accent">{hit.score.toFixed(6)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {hit.matchedTerms.map((term) => (
          <span
            key={term}
            className="rounded bg-accent/10 px-2 py-1 font-mono text-[10px] text-accent"
          >
            {term}
          </span>
        ))}
        {hit.matchedFields.map((field) => (
          <span
            key={field}
            className="rounded bg-elevated px-2 py-1 font-mono text-[10px] text-muted"
          >
            {field}
          </span>
        ))}
      </div>
      {typeof sourceUrl === 'string' && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => void trackSearchClick(searchId, hit.documentId, rank)}
          className="mt-4 inline-flex text-xs font-medium text-accent hover:underline"
        >
          Open result ↗
        </a>
      )}
      {hit.highlights !== undefined && (
        <div className="mt-4 space-y-2">
          {Object.entries(hit.highlights).map(([field, html]) => (
            <div key={field} className="rounded-lg border border-panel bg-canvas p-3">
              <p className="mb-1 font-mono text-[10px] text-subtle">{field}</p>
              <p
                className="text-sm leading-6 text-slate-300 [&_mark]:rounded [&_mark]:bg-accent/20 [&_mark]:px-0.5 [&_mark]:text-white"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          ))}
        </div>
      )}
      {hit.document !== undefined && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted">Document fields</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 text-xs leading-5 text-slate-300">
            {JSON.stringify(hit.document, null, 2)}
          </pre>
        </details>
      )}
      {explain && hit.explanation !== undefined && (
        <details className="mt-4 rounded-lg border border-panel bg-canvas p-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-200">
            Score explanation
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left font-mono text-[10px]">
              <thead className="text-subtle">
                <tr>
                  {[
                    'term',
                    'field',
                    'tf',
                    'df',
                    'idf',
                    'doc len',
                    'avg len',
                    'BM25',
                    'weight',
                    'typo',
                    'proximity',
                    'contribution',
                  ].map((label) => (
                    <th className="pb-2 pr-4" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hit.explanation.terms.map((term, index) => (
                  <tr
                    className="border-t border-panel text-slate-300"
                    key={`${term.queryTerm}-${term.field}-${index}`}
                  >
                    <td className="py-2 pr-4">
                      {term.queryTerm}
                      {term.queryTerm !== term.matchedTerm ? ` → ${term.matchedTerm}` : ''}
                    </td>
                    <td className="pr-4">{term.field}</td>
                    <td>{term.tf}</td>
                    <td>{term.df}</td>
                    <td>{term.idf.toFixed(3)}</td>
                    <td>{term.documentLength}</td>
                    <td>{term.averageDocumentLength.toFixed(1)}</td>
                    <td>{term.bm25Score?.toFixed(4) ?? '—'}</td>
                    <td>{term.fieldWeight}</td>
                    <td>{term.typoPenalty}</td>
                    <td>{term.proximityBoost}</td>
                    <td>{term.contribution.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-panel bg-canvas px-3 py-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-emerald-400"
      />
      {label}
    </label>
  );
}
function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 font-mono text-[10px] ${active ? 'border-accent/50 bg-accent/10 text-accent' : 'border-panel text-muted'}`}
    >
      {label}
    </button>
  );
}
function EmptyResults() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-panel bg-surface/40 p-10 text-center">
      <div>
        <p className="text-sm font-medium text-slate-200">Ready for a real query</p>
        <p className="mt-2 max-w-sm text-xs leading-5 text-muted">
          Choose an index, configure retrieval, and run a search. No sample results are generated.
        </p>
      </div>
    </div>
  );
}

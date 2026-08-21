'use client';
import { useEffect, useState } from 'react';

interface Hit {
  documentId: string;
  highlights?: Record<string, string>;
  document?: { fields?: Record<string, unknown>; metadata?: Record<string, unknown> };
}
interface Result {
  hits: Hit[];
  total: number;
  processingTimeMs: number;
  facets?: Record<string, Record<string, number>>;
  correction?: { correctionApplied?: boolean; correctedQuery?: string };
}
export function DocsSearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result>();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length < 2) return setSuggestions([]);
      void fetch(`/api/search?mode=autocomplete&q=${encodeURIComponent(query)}`).then(
        async (response) => {
          if (!response.ok) return;
          const data = (await response.json()) as {
            suggestions: Array<string | { term?: string }>;
          };
          setSuggestions(
            data.suggestions
              .map((entry) => (typeof entry === 'string' ? entry : (entry.term ?? '')))
              .filter(Boolean),
          );
        },
      );
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);
  async function search(value = query, nextPage = 0, nextSection = section) {
    if (!value.trim()) return;
    setLoading(true);
    setSuggestions([]);
    try {
      const parameters = new URLSearchParams({ q: value, page: String(nextPage) });
      if (nextSection) parameters.set('section', nextSection);
      const response = await fetch(`/api/search?${parameters.toString()}`);
      if (!response.ok) throw new Error('Search unavailable');
      setResult((await response.json()) as Result);
      setPage(nextPage);
      setSection(nextSection);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="search-shell">
      <div className="search-row">
        <span>⌕</span>
        <input
          aria-label="Search documentation"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void search();
          }}
          placeholder="Search guides, APIs, concepts…"
        />
        <kbd>↵</kbd>
      </div>
      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((item) => (
            <button
              key={item}
              onClick={() => {
                setQuery(item);
                void search(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {loading && <p className="status">Searching your local Seekr index…</p>}
      {result && !loading && (
        <section className="results">
          <div className="result-meta">
            <strong>{result.total} results</strong>
            <span>{result.processingTimeMs.toFixed(1)} ms</span>
          </div>
          {result.correction?.correctionApplied && (
            <p className="status">
              Showing results for <strong>{result.correction.correctedQuery}</strong>
            </p>
          )}
          <div className="facet-row">
            <button
              className={section === '' ? 'active' : ''}
              onClick={() => void search(query, 0, '')}
            >
              All
            </button>
            {Object.entries(result.facets?.section ?? {}).map(([name, count]) => (
              <button
                className={section === name ? 'active' : ''}
                key={name}
                onClick={() => void search(query, 0, name)}
              >
                {name} <span>{count}</span>
              </button>
            ))}
          </div>
          {result.hits.map((hit) => {
            const fields = hit.document?.fields ?? {};
            const title = display(fields.title, hit.documentId);
            const excerpt = display(fields.content ?? fields.description, '');
            return (
              <article key={hit.documentId}>
                <p className="path">{display(hit.document?.metadata?.section, 'Documentation')}</p>
                <h2
                  dangerouslySetInnerHTML={{ __html: hit.highlights?.title ?? escapeHtml(title) }}
                />
                <p
                  dangerouslySetInnerHTML={{
                    __html: hit.highlights?.content ?? escapeHtml(excerpt.slice(0, 240)),
                  }}
                />
              </article>
            );
          })}
          <div className="pagination">
            <button disabled={page === 0} onClick={() => void search(query, page - 1)}>
              ← Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              disabled={(page + 1) * 8 >= result.total}
              onClick={() => void search(query, page + 1)}
            >
              Next →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function display(value: unknown, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : fallback;
}

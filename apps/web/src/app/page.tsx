import { publicEnvironment } from '../config/environment';

const foundations = [
  { detail: 'Fastify · strict schemas', label: 'API runtime', status: 'Ready' },
  { detail: 'PostgreSQL · initial schema', label: 'Primary storage', status: 'Ready' },
  { detail: 'Redis · connection adapter', label: 'Cache layer', status: 'Ready' },
  { detail: 'Reserved for milestone 2', label: 'Search engine', status: 'Pending' },
] as const;

const pipeline = ['Ingest', 'Parse', 'Tokenize', 'Index', 'Rank', 'Retrieve'] as const;

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.18em] text-accent">
            System overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Search infrastructure, under your control.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            The Seekr foundation is configured. Start the local data services, verify readiness,
            then build the first indexing pipeline.
          </p>
        </div>
        <span className="w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300">
          Bootstrap milestone
        </span>
      </div>

      <section aria-labelledby="foundation-heading">
        <h2 className="sr-only" id="foundation-heading">
          Foundation status
        </h2>
        <div className="grid overflow-hidden rounded-xl border border-panel bg-panel gap-px sm:grid-cols-2 xl:grid-cols-4">
          {foundations.map((foundation) => (
            <article className="bg-surface p-5" key={foundation.label}>
              <div className="mb-5 flex items-center justify-between">
                <span
                  className={`size-2 rounded-full ${foundation.status === 'Ready' ? 'bg-accent' : 'bg-amber-400'}`}
                />
                <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">
                  {foundation.status}
                </span>
              </div>
              <h3 className="text-sm font-medium text-slate-100">{foundation.label}</h3>
              <p className="mt-1 text-xs text-muted">{foundation.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section
          className="rounded-xl border border-panel bg-surface p-6"
          aria-labelledby="pipeline-heading"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100" id="pipeline-heading">
                Search pipeline
              </h2>
              <p className="mt-1 text-xs text-muted">
                Package boundaries are in place; implementations are next.
              </p>
            </div>
            <span className="rounded-md border border-panel bg-canvas px-2 py-1 font-mono text-[10px] text-muted">
              v0.1.0
            </span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-3">
            {pipeline.map((step, index) => (
              <li
                className="flex items-center gap-3 rounded-lg border border-panel bg-canvas px-3 py-3"
                key={step}
              >
                <span className="grid size-6 place-items-center rounded bg-elevated font-mono text-[10px] text-accent">
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-slate-300">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="rounded-xl border border-panel bg-surface p-6"
          aria-labelledby="connect-heading"
        >
          <h2 className="text-sm font-semibold text-slate-100" id="connect-heading">
            Connect locally
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            The liveness endpoint does not depend on PostgreSQL or Redis. Readiness verifies both.
          </p>
          <div className="mt-5 space-y-3 font-mono text-xs">
            <div className="rounded-lg border border-panel bg-canvas p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-subtle">API base URL</p>
              <p className="truncate text-slate-300">{publicEnvironment.NEXT_PUBLIC_API_URL}</p>
            </div>
            <div className="rounded-lg border border-panel bg-canvas p-3 text-slate-300">
              <span className="text-accent">GET</span> /health
            </div>
            <div className="rounded-lg border border-panel bg-canvas p-3 text-slate-300">
              <span className="text-accent">GET</span> /ready
            </div>
          </div>
        </section>
      </div>

      <section
        className="mt-6 rounded-xl border border-panel bg-surface p-6"
        aria-labelledby="next-heading"
      >
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              Next milestone
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white" id="next-heading">
              Build the lexical indexing core
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Implement deterministic tokenization, an in-memory inverted index and posting lists,
              then establish correctness tests before adding TF-IDF or BM25 ranking.
            </p>
          </div>
          <div className="rounded-lg border border-panel bg-canvas px-4 py-3 font-mono text-xs text-slate-300">
            packages/search-core
          </div>
        </div>
      </section>
    </div>
  );
}

import { DocsSearch } from '../components/docs-search';

export default function Page() {
  return (
    <main>
      <header>
        <a className="brand" href="/">
          seekr<span>/docs</span>
        </a>
        <nav>SDK example · Self-hosted search</nav>
      </header>
      <section className="hero">
        <p className="eyebrow">DEVELOPER DOCUMENTATION</p>
        <h1>
          Find the answer.
          <br />
          Stay in flow.
        </h1>
        <p>
          Search an actual Seekr index with autocomplete, typo tolerance, highlights, and faceted
          results.
        </p>
        <DocsSearch />
      </section>
      <footer>
        Powered entirely by the public <code>@seekr/sdk</code> API.
      </footer>
    </main>
  );
}

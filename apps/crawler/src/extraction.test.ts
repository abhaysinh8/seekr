import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { extractPageContent } from './extraction.js';

const realisticPage = `<!doctype html>
<html lang="en-US">
  <head>
    <title>Fallback title</title>
    <meta property="og:title" content="Building a Search Engine">
    <meta name="description" content="A practical guide to information retrieval.">
    <link rel="canonical" href="/guides/search#overview">
    <script type="application/ld+json">{"@type":"Article","author":"Seekr"}</script>
    <style>.hidden { display: none }</style>
  </head>
  <body>
    <nav>Documentation Pricing Log in</nav>
    <div class="cookie-banner">Accept cookies</div>
    <main>
      <h1>Build your own search engine</h1>
      <p>Search starts with careful tokenization.</p>
      <h2>Indexing</h2>
      <p>An inverted index maps terms to documents.</p>
      <aside>Buy our course</aside>
    </main>
    <footer>Copyright</footer>
    <script>alert('not content')</script>
  </body>
</html>`;

describe('readable content extraction', () => {
  it('extracts metadata and content while removing page chrome', () => {
    const page = extractPageContent(realisticPage, 'https://seekr.test/original');

    expect(page).toMatchObject({
      title: 'Building a Search Engine',
      metaDescription: 'A practical guide to information retrieval.',
      mainHeading: 'Build your own search engine',
      sectionHeadings: ['Indexing'],
      canonicalUrl: 'https://seekr.test/guides/search',
      language: 'en-us',
      content:
        'Search starts with careful tokenization.\n\nAn inverted index maps terms to documents.',
    });
    expect(page.content).not.toMatch(/cookie|copyright|course|alert/iu);
    expect(page.structuredData).toEqual([{ '@type': 'Article', author: 'Seekr' }]);
    expect(page.contentHash).toBe(
      createHash('sha256').update(page.content.normalize('NFKC')).digest('hex'),
    );
  });

  it('produces the same content hash for duplicate normalized content', () => {
    const first = extractPageContent('<main><p>Same   content</p></main>', 'https://seekr.test/a');
    const second = extractPageContent(
      '<article><p> Same content </p></article>',
      'https://seekr.test/b',
    );
    expect(first.contentHash).toBe(second.contentHash);
  });

  it('tolerates malformed structured metadata', () => {
    const page = extractPageContent(
      '<script type="application/ld+json">{broken</script><main>Readable fallback</main>',
      'https://seekr.test',
    );
    expect(page.content).toBe('Readable fallback');
    expect(page.structuredData).toEqual([]);
  });
});

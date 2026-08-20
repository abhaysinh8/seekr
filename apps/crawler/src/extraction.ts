import { createHash } from 'node:crypto';

import { load } from 'cheerio';

import type { ExtractedPage } from './types.js';
import { normalizeUrl } from './url.js';

const REMOVED_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'template',
  'nav',
  'footer',
  'aside',
  'iframe',
  'canvas',
  'svg',
  'form',
  'dialog',
  '[aria-hidden="true"]',
  '[hidden]',
].join(',');

const CHROME_SELECTORS = [
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="advert" i]',
  '[id*="advert" i]',
  '[class~="ad"]',
  '[id~="ad"]',
  '[class*="sidebar" i]',
  '[id*="sidebar" i]',
  '[class*="menu" i]',
  '[id*="menu" i]',
  '[class*="breadcrumb" i]',
].join(',');

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/[\t\f\v ]+/gu, ' ')
    .replace(/\s*\n\s*/gu, '\n')
    .trim();
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function compactBlocks(blocks: readonly string[]): string[] {
  const output: string[] = [];
  for (const block of blocks) {
    const normalized = normalizeInlineText(block);
    if (normalized.length > 0 && output.at(-1) !== normalized) output.push(normalized);
  }
  return output;
}

function readStructuredData(html: string): unknown[] {
  const $ = load(html);
  const values: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text().trim();
    if (raw.length === 0 || raw.length > 256_000) return;
    try {
      values.push(JSON.parse(raw) as unknown);
    } catch {
      // Malformed page metadata must not fail an otherwise usable crawl.
    }
  });
  return values;
}

export function extractPageContent(html: string, sourceUrl: string): ExtractedPage {
  const structuredData = readStructuredData(html);
  const $ = load(html);
  const title = normalizeInlineText(
    $('meta[property="og:title"]').attr('content') ?? $('title').first().text(),
  );
  const metaDescription = normalizeInlineText(
    $('meta[name="description"]').attr('content') ??
      $('meta[property="og:description"]').attr('content') ??
      '',
  );
  const language = normalizeInlineText($('html').attr('lang') ?? '').toLowerCase();
  const canonicalCandidate = $('link[rel="canonical"]').attr('href');
  const canonicalUrl = normalizeUrl(canonicalCandidate ?? sourceUrl, sourceUrl) ?? sourceUrl;

  $(REMOVED_ELEMENTS).remove();
  $(CHROME_SELECTORS).remove();

  const main = $('main, article, [role="main"]').first();
  const root = main.length > 0 ? main : $('body');
  const mainHeading = normalizeInlineText(root.find('h1').first().text());
  const sectionHeadings = compactBlocks(
    root
      .find('h2, h3, h4, h5, h6')
      .toArray()
      .map((element) => $(element).text()),
  );
  const contentBlocks = compactBlocks(
    root
      .find('p, li, blockquote, pre')
      .toArray()
      .map((element) => $(element).text()),
  );
  const fallbackContent = normalizeWhitespace(root.text());
  const content = contentBlocks.length > 0 ? contentBlocks.join('\n\n') : fallbackContent;
  const contentHash = createHash('sha256').update(content.normalize('NFKC')).digest('hex');

  return {
    title,
    sectionHeadings,
    content,
    canonicalUrl,
    structuredData,
    contentHash,
    ...(metaDescription.length > 0 ? { metaDescription } : {}),
    ...(mainHeading.length > 0 ? { mainHeading } : {}),
    ...(language.length > 0 ? { language } : {}),
  };
}

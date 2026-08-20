import { load } from 'cheerio';

import { normalizeUrl } from './url.js';

export function discoverPageLinks(html: string, pageUrl: string): string[] {
  const $ = load(html);
  const links = new Set<string>();
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (href === undefined) return;
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized !== undefined) links.add(normalized);
  });
  return [...links];
}

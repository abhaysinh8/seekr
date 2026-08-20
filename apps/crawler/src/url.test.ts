import { describe, expect, it } from 'vitest';

import { isAllowedDomain, isPrivateNetworkUrl, normalizeUrl } from './url.js';

describe('crawler URL policy', () => {
  it('normalizes URLs and removes fragments and credentials', () => {
    expect(normalizeUrl('../Guide#part', 'HTTPS://User:secret@EXAMPLE.COM/docs/page')).toBe(
      'https://example.com/Guide',
    );
  });

  it('only allows a domain and its subdomains', () => {
    const domains = new Set(['example.com']);
    expect(isAllowedDomain('https://docs.example.com/page', domains)).toBe(true);
    expect(isAllowedDomain('https://example.com.attacker.test/page', domains)).toBe(false);
  });

  it('recognizes literal private network targets', () => {
    expect(isPrivateNetworkUrl('http://127.0.0.1/admin')).toBe(true);
    expect(isPrivateNetworkUrl('http://192.168.1.4/admin')).toBe(true);
    expect(isPrivateNetworkUrl('http://[::1]/admin')).toBe(true);
    expect(isPrivateNetworkUrl('https://example.com')).toBe(false);
  });
});

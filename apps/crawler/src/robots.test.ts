import { describe, expect, it, vi } from 'vitest';

import { RobotsPolicy, RobotsTxtCache } from './robots.js';

describe('robots.txt policy', () => {
  it('uses the most specific matching rule and crawler-specific group', () => {
    const policy = new RobotsPolicy(`
User-agent: *
Disallow: /private

User-agent: SeekrBot
Disallow: /drafts
Allow: /drafts/published
Crawl-delay: 1.5
`);
    expect(policy.isAllowed('https://example.com/drafts/hidden')).toBe(false);
    expect(policy.isAllowed('https://example.com/drafts/published/one')).toBe(true);
    expect(policy.isAllowed('https://example.com/private')).toBe(true);
    expect(policy.crawlDelayMs()).toBe(1500);
  });

  it('loads each origin once', async () => {
    const load = vi.fn().mockResolvedValue('User-agent: *\nDisallow:');
    const cache = new RobotsTxtCache({ load });
    await Promise.all([
      cache.getPolicy('https://example.com/one'),
      cache.getPolicy('https://example.com/two'),
    ]);
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith('https://example.com/robots.txt', undefined);
  });
});

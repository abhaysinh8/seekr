import { describe, expect, it } from 'vitest';

import { defaultMaximumEditDistance, levenshteinDistance } from './levenshtein.js';

describe('levenshteinDistance', () => {
  it('calculates insertions, deletions, and substitutions', () => {
    expect(levenshteinDistance('machine', 'machien')).toBe(2);
    expect(levenshteinDistance('javascript', 'javscript')).toBe(1);
    expect(levenshteinDistance('search', 'search')).toBe(0);
  });

  it('supports Unicode code points and bounded early exit', () => {
    expect(levenshteinDistance('café', 'cafe')).toBe(1);
    expect(levenshteinDistance('search', 'database', 2)).toBeGreaterThan(2);
  });

  it('chooses conservative default thresholds', () => {
    expect(defaultMaximumEditDistance('java')).toBe(1);
    expect(defaultMaximumEditDistance('machine')).toBe(2);
  });
});

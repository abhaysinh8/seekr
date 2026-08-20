import { describe, expect, it } from 'vitest';

import { Trie } from './trie.js';

describe('Trie', () => {
  it('inserts, finds, prefixes, and removes terms', () => {
    const trie = new Trie();
    trie.insert('machine');
    trie.insert('machines');
    trie.insert('machinery');
    trie.insert('machine');
    expect(trie.contains('machine')).toBe(true);
    expect(trie.startsWith('mach')).toBe(true);
    expect(trie.suggest('mach', 2)).toEqual(['machine', 'machinery']);
    expect(trie.remove('machine')).toBe(true);
    expect(trie.contains('machine')).toBe(false);
    expect(trie.contains('machines')).toBe(true);
  });

  it('supports Unicode and missing prefixes', () => {
    const trie = new Trie();
    trie.insert('café');
    trie.insert('caffè');
    expect(trie.suggest('caf', 10)).toEqual(['café', 'caffè']);
    expect(trie.suggest('xyz')).toEqual([]);
  });

  it('orders suggestions by a supplied signal', () => {
    const trie = new Trie();
    for (const term of ['machine', 'machines', 'machinery']) trie.insert(term);
    const frequencies: Record<string, number> = { machine: 5, machines: 8, machinery: 2 };
    expect(trie.suggest('mach', 3, (term) => frequencies[term] ?? 0)).toEqual([
      'machines',
      'machine',
      'machinery',
    ]);
  });
});

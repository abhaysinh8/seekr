import { describe, expect, it } from 'vitest';

import { MinHeap, selectTopK } from './heap.js';

describe('MinHeap', () => {
  it('supports push, peek, pop, and size', () => {
    const heap = new MinHeap<number>((left, right) => left - right);
    heap.push(5);
    heap.push(1);
    heap.push(3);
    expect(heap.size).toBe(3);
    expect(heap.peek()).toBe(1);
    expect([heap.pop(), heap.pop(), heap.pop()]).toEqual([1, 3, 5]);
    expect(heap.pop()).toBeUndefined();
  });

  it('selects exactly the same top K as a full sort', () => {
    const values = [12, 3, 99, 17, 42, 1, 8, 75];
    const comparator = (left: number, right: number) => right - left;
    expect(selectTopK(values, 4, comparator)).toEqual([...values].sort(comparator).slice(0, 4));
  });
});

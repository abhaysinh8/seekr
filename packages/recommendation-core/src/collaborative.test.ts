import { describe, expect, it } from 'vitest';
import { ItemItemCollaborativeRecommender } from './collaborative.js';
import { InteractionStore } from './interactions.js';

function matrix() {
  const store = new InteractionStore();
  for (const [userId, itemId] of [
    ['u1', 'a'],
    ['u1', 'b'],
    ['u2', 'a'],
    ['u2', 'b'],
    ['u2', 'c'],
    ['target', 'a'],
  ] as const)
    store.recordInteraction({ userId, itemId, type: 'view', weight: 1 });
  return store;
}
describe('item-item collaborative filtering', () => {
  it('precomputes sparse cosine neighbors from a verifiable interaction matrix', () => {
    const neighbors = new ItemItemCollaborativeRecommender(matrix()).getSimilarItems('a');
    expect(neighbors[0]).toMatchObject({ itemId: 'b' });
    expect(neighbors[0]?.score).toBeCloseTo(2 / Math.sqrt(6));
    expect(neighbors[1]?.itemId).toBe('c');
  });
  it('combines similarity, excludes seen items, and works with one interaction', () => {
    const results = new ItemItemCollaborativeRecommender(matrix()).recommendForUser('target');
    expect(results.map((item) => item.itemId)).toEqual(['b', 'c']);
    expect(results.every((item) => item.itemId !== 'a')).toBe(true);
  });
  it('falls back for new users and invalidates cached neighbors on writes', () => {
    const store = matrix();
    const recommender = new ItemItemCollaborativeRecommender(store);
    expect(recommender.recommendForUser('new')[0]?.itemId).toBe('a');
    recommender.getSimilarItems('a');
    recommender.recordInteraction({ userId: 'u3', itemId: 'a', type: 'view' });
    recommender.recordInteraction({ userId: 'u3', itemId: 'd', type: 'view' });
    expect(recommender.getSimilarItems('a').some((item) => item.itemId === 'd')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { ContentBasedRecommender } from './content-based.js';
import { InteractionStore } from './interactions.js';

const items = [
  { id: 'search-1', fields: { text: 'inverted index search ranking' } },
  { id: 'search-2', fields: { text: 'search engine ranking relevance' } },
  { id: 'cooking-1', fields: { text: 'pasta tomato cooking recipe' } },
  { id: 'cooking-2', fields: { text: 'tomato recipe kitchen' } },
] as const;

describe('content-based recommendations', () => {
  it('builds normalized TF-IDF vectors and recommends similar items', () => {
    const recommender = new ContentBasedRecommender(items, new InteractionStore());
    const vector = recommender.getVector('search-1');
    expect(vector).toBeDefined();
    expect(
      Math.sqrt([...(vector?.values() ?? [])].reduce((sum, value) => sum + value * value, 0)),
    ).toBeCloseTo(1);
    expect(recommender.recommendItems('search-1')[0]?.itemId).toBe('search-2');
    expect(recommender.recommendItems('search-1').some((item) => item.itemId === 'search-1')).toBe(
      false,
    );
  });
  it('creates interaction-weighted user profiles and excludes seen items', () => {
    const interactions = new InteractionStore();
    interactions.recordInteraction({ userId: 'u', itemId: 'search-1', type: 'like' });
    interactions.recordInteraction({ userId: 'u', itemId: 'cooking-1', type: 'view' });
    const results = new ContentBasedRecommender(items, interactions).recommendForUser('u');
    expect(results[0]?.itemId).toBe('search-2');
    expect(results.every((item) => item.itemId !== 'search-1' && item.itemId !== 'cooking-1')).toBe(
      true,
    );
  });
  it('uses popularity as a cold-start fallback', () => {
    const interactions = new InteractionStore();
    interactions.recordInteraction({ userId: 'other', itemId: 'cooking-2', type: 'purchase' });
    expect(new ContentBasedRecommender(items, interactions).recommendForUser('new-user')).toEqual([
      { itemId: 'cooking-2', score: 5 },
    ]);
  });
});

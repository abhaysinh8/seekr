import { describe, expect, it } from 'vitest';
import { ItemItemCollaborativeRecommender } from './collaborative.js';
import { ContentBasedRecommender } from './content-based.js';
import { HybridRecommender } from './hybrid.js';
import { InteractionStore } from './interactions.js';

describe('hybrid recommendations', () => {
  it('normalizes and combines signals with explanations', () => {
    const interactions = new InteractionStore();
    for (const [userId, itemId] of [
      ['u1', 'a'],
      ['u1', 'b'],
      ['u2', 'a'],
      ['u2', 'b'],
      ['target', 'a'],
    ] as const)
      interactions.recordInteraction({ userId, itemId, type: 'click' });
    const items = [
      { id: 'a', fields: { text: 'search engine' }, createdAt: new Date('2026-01-01') },
      { id: 'b', fields: { text: 'search ranking' }, createdAt: new Date('2026-01-10') },
      { id: 'c', fields: { text: 'cooking recipe' }, createdAt: new Date('2026-01-15') },
    ];
    const content = new ContentBasedRecommender(items, interactions);
    const hybrid = new HybridRecommender(
      interactions,
      content,
      new ItemItemCollaborativeRecommender(interactions),
    );
    const result = hybrid.recommendForUser('target', {
      explain: true,
      now: new Date('2026-01-16'),
      recencyWeight: 0.1,
    });
    expect(result[0]?.itemId).toBe('b');
    expect(result[0]).toMatchObject({ reasons: { collaborative: 1, content: 1, popularity: 1 } });
  });
  it('uses popularity for a new user', () => {
    const interactions = new InteractionStore();
    interactions.recordInteraction({ userId: 'u', itemId: 'popular', type: 'purchase' });
    const content = new ContentBasedRecommender(
      [
        { id: 'popular', fields: { text: 'one' } },
        { id: 'other', fields: { text: 'two' } },
      ],
      interactions,
    );
    const result = new HybridRecommender(
      interactions,
      content,
      new ItemItemCollaborativeRecommender(interactions),
    ).recommendForUser('new');
    expect(result[0]?.itemId).toBe('popular');
  });
});

import { describe, expect, it } from 'vitest';
import { InteractionStore } from './interactions.js';

describe('interaction store and popularity', () => {
  it('records weighted generic interactions and reports statistics', () => {
    const store = new InteractionStore({ click: 2.5 });
    store.recordInteraction({
      userId: 'u1',
      itemId: 'a',
      type: 'view',
      occurredAt: new Date('2026-01-01'),
    });
    store.recordInteraction({
      userId: 'u1',
      itemId: 'a',
      type: 'click',
      occurredAt: new Date('2026-01-02'),
    });
    store.recordInteraction({
      userId: 'u2',
      itemId: 'b',
      type: 'purchase',
      occurredAt: new Date('2026-01-03'),
    });
    expect(store.getPopularItems()).toEqual([
      { itemId: 'b', score: 5 },
      { itemId: 'a', score: 3.5 },
    ]);
    expect(store.getInteractionStatistics()).toMatchObject({
      totalInteractions: 3,
      uniqueUsers: 2,
      uniqueItems: 2,
      byType: { click: { count: 1, weightedTotal: 2.5 }, purchase: { count: 1, weightedTotal: 5 } },
    });
  });
  it('supports inclusive popularity time windows', () => {
    const store = new InteractionStore();
    store.recordInteraction({
      userId: 'u1',
      itemId: 'old',
      type: 'purchase',
      occurredAt: new Date('2025-01-01'),
    });
    store.recordInteraction({
      userId: 'u2',
      itemId: 'current',
      type: 'click',
      occurredAt: new Date('2026-01-15'),
    });
    expect(
      store.getPopularItems({ start: new Date('2026-01-01'), end: new Date('2026-02-01') }),
    ).toEqual([{ itemId: 'current', score: 2 }]);
  });
});

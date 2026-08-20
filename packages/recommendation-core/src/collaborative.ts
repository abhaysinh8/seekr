import { aggregateUserItemStrengths, compareRecommendations } from './interactions.js';
import type { InteractionStore } from './interactions.js';
import type { InteractionInput, Recommendation } from './types.js';

export class ItemItemCollaborativeRecommender {
  readonly #neighbors = new Map<string, Recommendation[]>();
  #dirty = true;

  constructor(private readonly interactions: InteractionStore) {}

  recordInteraction(input: InteractionInput): void {
    this.interactions.recordInteraction(input);
    this.#dirty = true;
  }

  rebuild(): void {
    const norms = new Map<string, number>();
    const pairDots = new Map<string, number>();
    for (const userId of this.interactions.getUsers()) {
      const strengths = [...aggregateUserItemStrengths(this.interactions, userId)].sort(
        ([left], [right]) => left.localeCompare(right),
      );
      for (const [itemId, strength] of strengths)
        norms.set(itemId, (norms.get(itemId) ?? 0) + strength * strength);
      for (let leftIndex = 0; leftIndex < strengths.length; leftIndex += 1) {
        const left = strengths[leftIndex];
        if (left === undefined) continue;
        for (let rightIndex = leftIndex + 1; rightIndex < strengths.length; rightIndex += 1) {
          const right = strengths[rightIndex];
          if (right === undefined) continue;
          const key = pairKey(left[0], right[0]);
          pairDots.set(key, (pairDots.get(key) ?? 0) + left[1] * right[1]);
        }
      }
    }
    this.#neighbors.clear();
    for (const [key, dot] of pairDots) {
      const [left, right] = key.split('\u0000');
      if (left === undefined || right === undefined) continue;
      const denominator = Math.sqrt((norms.get(left) ?? 0) * (norms.get(right) ?? 0));
      const similarity = denominator === 0 ? 0 : dot / denominator;
      if (similarity <= 0) continue;
      addNeighbor(this.#neighbors, left, { itemId: right, score: similarity });
      addNeighbor(this.#neighbors, right, { itemId: left, score: similarity });
    }
    for (const neighbors of this.#neighbors.values()) neighbors.sort(compareRecommendations);
    this.#dirty = false;
  }

  getSimilarItems(itemId: string, limit = 10): readonly Recommendation[] {
    if (this.#dirty) this.rebuild();
    return (this.#neighbors.get(itemId) ?? []).slice(0, limit);
  }

  recommendForUser(
    userId: string,
    limit = 10,
    fallbackToPopularity = true,
  ): readonly Recommendation[] {
    if (this.#dirty) this.rebuild();
    const strengths = aggregateUserItemStrengths(this.interactions, userId);
    if (strengths.size === 0)
      return fallbackToPopularity ? this.interactions.getPopularItems({ limit }) : [];
    const candidates = new Map<string, number>();
    for (const [itemId, strength] of strengths) {
      for (const neighbor of this.#neighbors.get(itemId) ?? []) {
        if (!strengths.has(neighbor.itemId))
          candidates.set(
            neighbor.itemId,
            (candidates.get(neighbor.itemId) ?? 0) + neighbor.score * strength,
          );
      }
    }
    const recommendations = [...candidates]
      .map(([itemId, score]) => ({ itemId, score }))
      .sort(compareRecommendations)
      .slice(0, limit);
    return recommendations.length === 0 && fallbackToPopularity
      ? this.interactions.getPopularItems({ limit }).filter((item) => !strengths.has(item.itemId))
      : recommendations;
  }
}

function pairKey(left: string, right: string): string {
  return `${left}\u0000${right}`;
}
function addNeighbor(
  map: Map<string, Recommendation[]>,
  itemId: string,
  neighbor: Recommendation,
): void {
  const values = map.get(itemId);
  if (values === undefined) map.set(itemId, [neighbor]);
  else values.push(neighbor);
}

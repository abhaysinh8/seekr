import { tokenize, type TokenizeOptions } from '@seekr/tokenizer';

import { aggregateUserItemStrengths, compareRecommendations } from './interactions.js';
import type { InteractionStore } from './interactions.js';
import { cosineSimilarity, normalizeSparseVector } from './sparse-vector.js';
import type { ContentItem, Recommendation, SparseVector } from './types.js';

export class ContentBasedRecommender {
  readonly #items = new Map<string, ContentItem>();
  readonly #vectors = new Map<string, Map<string, number>>();
  readonly #tokenizerOptions: TokenizeOptions;

  constructor(
    items: readonly ContentItem[],
    private readonly interactions: InteractionStore,
    tokenizerOptions: TokenizeOptions = { stopWordRemoval: true },
  ) {
    this.#tokenizerOptions = tokenizerOptions;
    this.buildIndex(items);
  }

  buildIndex(items: readonly ContentItem[]): void {
    this.#items.clear();
    this.#vectors.clear();
    const counts = new Map<string, Map<string, number>>();
    const documentFrequency = new Map<string, number>();
    for (const item of items) {
      if (this.#items.has(item.id)) throw new Error(`Duplicate item ID: ${item.id}`);
      this.#items.set(item.id, item);
      const terms = tokenize(Object.values(item.fields).flat().join(' '), this.#tokenizerOptions);
      const frequencies = new Map<string, number>();
      for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
      counts.set(item.id, frequencies);
      for (const term of frequencies.keys())
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    for (const [itemId, frequencies] of counts) {
      const total = [...frequencies.values()].reduce((sum, count) => sum + count, 0);
      const vector = new Map<string, number>();
      for (const [term, count] of frequencies) {
        const tf = total === 0 ? 0 : count / total;
        const idf = Math.log((items.length + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
        vector.set(term, tf * idf);
      }
      this.#vectors.set(itemId, normalizeSparseVector(vector));
    }
  }

  getVector(itemId: string): SparseVector | undefined {
    return this.#vectors.get(itemId);
  }

  recommendItems(itemId: string, limit = 10): readonly Recommendation[] {
    const source = this.#vectors.get(itemId);
    if (source === undefined) return [];
    return [...this.#vectors]
      .filter(([candidateId]) => candidateId !== itemId)
      .map(([candidateId, vector]) => ({
        itemId: candidateId,
        score: cosineSimilarity(source, vector),
      }))
      .filter((result) => result.score > 0)
      .sort(compareRecommendations)
      .slice(0, limit);
  }

  recommendForUser(
    userId: string,
    limit = 10,
    fallbackToPopularity = true,
  ): readonly Recommendation[] {
    const strengths = aggregateUserItemStrengths(this.interactions, userId);
    if (strengths.size === 0)
      return fallbackToPopularity ? this.interactions.getPopularItems({ limit }) : [];
    const profile = new Map<string, number>();
    for (const [itemId, strength] of strengths) {
      for (const [feature, value] of this.#vectors.get(itemId) ?? [])
        profile.set(feature, (profile.get(feature) ?? 0) + value * strength);
    }
    const normalized = normalizeSparseVector(profile);
    const recommendations = [...this.#vectors]
      .filter(([itemId]) => !strengths.has(itemId))
      .map(([itemId, vector]) => ({ itemId, score: cosineSimilarity(normalized, vector) }))
      .filter((result) => result.score > 0)
      .sort(compareRecommendations)
      .slice(0, limit);
    return recommendations.length === 0 && fallbackToPopularity
      ? this.interactions.getPopularItems({ limit }).filter((item) => !strengths.has(item.itemId))
      : recommendations;
  }

  getItem(itemId: string): ContentItem | undefined {
    return this.#items.get(itemId);
  }
  getItems(): readonly ContentItem[] {
    return [...this.#items.values()];
  }
}

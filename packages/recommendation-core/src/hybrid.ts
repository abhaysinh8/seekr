import type { ContentBasedRecommender } from './content-based.js';
import type { ItemItemCollaborativeRecommender } from './collaborative.js';
import { aggregateUserItemStrengths, compareRecommendations } from './interactions.js';
import type { InteractionStore } from './interactions.js';
import type { ExplainedRecommendation, Recommendation } from './types.js';

export interface HybridWeights {
  readonly contentWeight?: number;
  readonly collaborativeWeight?: number;
  readonly popularityWeight?: number;
  readonly recencyWeight?: number;
}
export interface HybridRecommendationOptions extends HybridWeights {
  readonly limit?: number;
  readonly explain?: boolean;
  readonly recencyHalfLifeMs?: number;
  readonly now?: Date;
}

export class HybridRecommender {
  constructor(
    private readonly interactions: InteractionStore,
    private readonly content: ContentBasedRecommender,
    private readonly collaborative: ItemItemCollaborativeRecommender,
  ) {}

  recommendItems(itemId: string, limit = 10): readonly Recommendation[] {
    return this.content.recommendItems(itemId, limit);
  }

  recommendForUser(
    userId: string,
    options: HybridRecommendationOptions = {},
  ): readonly (Recommendation | ExplainedRecommendation)[] {
    const limit = options.limit ?? 10;
    const weights = {
      content: options.contentWeight ?? 0.35,
      collaborative: options.collaborativeWeight ?? 0.5,
      popularity: options.popularityWeight ?? 0.15,
      recency: options.recencyWeight ?? 0,
    };
    for (const [name, weight] of Object.entries(weights))
      if (!Number.isFinite(weight) || weight < 0)
        throw new RangeError(`${name} weight must be non-negative`);
    const interacted = aggregateUserItemStrengths(this.interactions, userId);
    const content = normalize(
      this.content.recommendForUser(userId, Number.MAX_SAFE_INTEGER, false),
    );
    const collaborative = normalize(
      this.collaborative.recommendForUser(userId, Number.MAX_SAFE_INTEGER, false),
    );
    const popularity = normalize(
      this.interactions
        .getPopularItems({ limit: Number.MAX_SAFE_INTEGER })
        .filter((item) => !interacted.has(item.itemId)),
    );
    const recency = this.recencyScores(
      options.now ?? new Date(),
      options.recencyHalfLifeMs ?? 30 * 24 * 60 * 60_000,
      interacted,
    );
    const candidates = new Set([
      ...content.keys(),
      ...collaborative.keys(),
      ...popularity.keys(),
      ...recency.keys(),
    ]);
    return [...candidates]
      .map((itemId) => {
        const reasons = {
          content: content.get(itemId) ?? 0,
          collaborative: collaborative.get(itemId) ?? 0,
          popularity: popularity.get(itemId) ?? 0,
          recency: recency.get(itemId) ?? 0,
        };
        const score =
          reasons.content * weights.content +
          reasons.collaborative * weights.collaborative +
          reasons.popularity * weights.popularity +
          reasons.recency * weights.recency;
        return options.explain === true ? { itemId, score, reasons } : { itemId, score };
      })
      .filter((item) => item.score > 0)
      .sort(compareRecommendations)
      .slice(0, limit);
  }

  private recencyScores(
    now: Date,
    halfLifeMs: number,
    interacted: ReadonlyMap<string, number>,
  ): Map<string, number> {
    if (halfLifeMs <= 0) return new Map();
    const scores = new Map<string, number>();
    for (const item of this.content.getItems()) {
      if (item.createdAt === undefined || interacted.has(item.id)) continue;
      const age = Math.max(0, now.getTime() - item.createdAt.getTime());
      scores.set(item.id, 2 ** (-age / halfLifeMs));
    }
    return scores;
  }
}

function normalize(recommendations: readonly Recommendation[]): Map<string, number> {
  const maximum = Math.max(0, ...recommendations.map((item) => item.score));
  return new Map(
    recommendations.map((item) => [item.itemId, maximum === 0 ? 0 : item.score / maximum]),
  );
}

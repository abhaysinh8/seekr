import {
  DEFAULT_INTERACTION_WEIGHTS,
  type Interaction,
  type InteractionInput,
  type InteractionType,
  type InteractionWeights,
  type Recommendation,
} from './types.js';

export interface PopularityOptions {
  readonly limit?: number;
  readonly start?: Date;
  readonly end?: Date;
}

export class InteractionStore {
  readonly #weights: InteractionWeights;
  readonly #interactions: Interaction[] = [];
  readonly #byUser = new Map<string, Interaction[]>();
  readonly #byItem = new Map<string, Interaction[]>();

  constructor(weights: Partial<InteractionWeights> = {}) {
    this.#weights = { ...DEFAULT_INTERACTION_WEIGHTS, ...weights };
    for (const [type, weight] of Object.entries(this.#weights)) {
      if (!Number.isFinite(weight) || weight < 0)
        throw new RangeError(`${type} weight must be non-negative`);
    }
  }

  recordInteraction(input: InteractionInput): Interaction {
    if (input.userId.length === 0 || input.itemId.length === 0)
      throw new Error('userId and itemId are required');
    if (input.weight !== undefined && (!Number.isFinite(input.weight) || input.weight < 0)) {
      throw new RangeError('Interaction weight must be non-negative');
    }
    const interaction: Interaction = {
      ...input,
      occurredAt: input.occurredAt ?? new Date(),
      effectiveWeight: input.weight ?? this.#weights[input.type],
    };
    this.#interactions.push(interaction);
    addToMap(this.#byUser, input.userId, interaction);
    addToMap(this.#byItem, input.itemId, interaction);
    return interaction;
  }

  getUserInteractions(userId: string): readonly Interaction[] {
    return this.#byUser.get(userId) ?? [];
  }

  getItemInteractions(itemId: string): readonly Interaction[] {
    return this.#byItem.get(itemId) ?? [];
  }

  getUsers(): readonly string[] {
    return [...this.#byUser.keys()];
  }
  getItems(): readonly string[] {
    return [...this.#byItem.keys()];
  }

  getPopularItems(options: PopularityOptions = {}): readonly Recommendation[] {
    const limit = options.limit ?? 10;
    const start = options.start?.getTime() ?? Number.NEGATIVE_INFINITY;
    const end = options.end?.getTime() ?? Number.POSITIVE_INFINITY;
    const scores = new Map<string, number>();
    for (const interaction of this.#interactions) {
      const timestamp = interaction.occurredAt.getTime();
      if (timestamp < start || timestamp > end) continue;
      scores.set(
        interaction.itemId,
        (scores.get(interaction.itemId) ?? 0) + interaction.effectiveWeight,
      );
    }
    return [...scores]
      .map(([itemId, score]) => ({ itemId, score }))
      .sort(compareRecommendations)
      .slice(0, limit);
  }

  getInteractionStatistics() {
    const byType = Object.fromEntries(
      (Object.keys(DEFAULT_INTERACTION_WEIGHTS) as InteractionType[]).map((type) => [
        type,
        { count: 0, weightedTotal: 0 },
      ]),
    ) as Record<InteractionType, { count: number; weightedTotal: number }>;
    for (const interaction of this.#interactions) {
      byType[interaction.type].count += 1;
      byType[interaction.type].weightedTotal += interaction.effectiveWeight;
    }
    const timestamps = this.#interactions.map((interaction) => interaction.occurredAt.getTime());
    return {
      totalInteractions: this.#interactions.length,
      uniqueUsers: this.#byUser.size,
      uniqueItems: this.#byItem.size,
      byType,
      firstInteractionAt: timestamps.length === 0 ? null : new Date(Math.min(...timestamps)),
      lastInteractionAt: timestamps.length === 0 ? null : new Date(Math.max(...timestamps)),
    };
  }
}

function addToMap(map: Map<string, Interaction[]>, key: string, interaction: Interaction): void {
  const values = map.get(key);
  if (values === undefined) map.set(key, [interaction]);
  else values.push(interaction);
}

export function aggregateUserItemStrengths(
  store: InteractionStore,
  userId: string,
): Map<string, number> {
  const strengths = new Map<string, number>();
  for (const interaction of store.getUserInteractions(userId)) {
    strengths.set(
      interaction.itemId,
      (strengths.get(interaction.itemId) ?? 0) + interaction.effectiveWeight,
    );
  }
  return strengths;
}

export function compareRecommendations(left: Recommendation, right: Recommendation): number {
  return right.score - left.score || left.itemId.localeCompare(right.itemId);
}

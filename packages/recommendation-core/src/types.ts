export type InteractionType = 'view' | 'click' | 'bookmark' | 'like' | 'purchase';
export type InteractionWeights = Readonly<Record<InteractionType, number>>;

export const DEFAULT_INTERACTION_WEIGHTS: InteractionWeights = {
  view: 1,
  click: 2,
  bookmark: 3,
  like: 4,
  purchase: 5,
};

export interface InteractionInput {
  readonly userId: string;
  readonly itemId: string;
  readonly type: InteractionType;
  readonly occurredAt?: Date;
  readonly weight?: number;
}

export interface Interaction extends Omit<InteractionInput, 'occurredAt'> {
  readonly occurredAt: Date;
  readonly effectiveWeight: number;
}

export interface Recommendation {
  readonly itemId: string;
  readonly score: number;
}

export interface ExplainedRecommendation extends Recommendation {
  readonly reasons: {
    readonly collaborative: number;
    readonly content: number;
    readonly popularity: number;
    readonly recency: number;
  };
}

export interface ContentItem {
  readonly id: string;
  readonly fields: Readonly<Record<string, string | readonly string[]>>;
  readonly createdAt?: Date;
}

export type SparseVector = ReadonlyMap<string, number>;

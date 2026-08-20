export type RecommendationTarget =
  | { readonly kind: 'item'; readonly itemId: string }
  | { readonly kind: 'user'; readonly userId: string };

export interface Recommendation {
  readonly itemId: string;
  readonly score: number;
}

/** Boundary for algorithms that will be implemented wholly inside this package. */
export interface RecommendationEngine {
  recommend(target: RecommendationTarget, limit: number): Promise<readonly Recommendation[]>;
}

export { ItemItemCollaborativeRecommender } from './collaborative.js';
export { ContentBasedRecommender } from './content-based.js';
export {
  HybridRecommender,
  type HybridRecommendationOptions,
  type HybridWeights,
} from './hybrid.js';
export {
  aggregateUserItemStrengths,
  compareRecommendations,
  InteractionStore,
  type PopularityOptions,
} from './interactions.js';
export {
  cosineSimilarity,
  normalizeSparseVector,
  sparseDotProduct,
  sparseMagnitude,
} from './sparse-vector.js';
export { DEFAULT_INTERACTION_WEIGHTS } from './types.js';
export type * from './types.js';

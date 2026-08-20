import { z } from 'zod';
import { entityIdSchema } from './entities.js';

export const recordInteractionRequestSchema = z.object({
  indexId: entityIdSchema,
  userId: z.string().trim().min(1).max(255),
  itemId: z.string().trim().min(1).max(255),
  type: z.enum(['view', 'click', 'bookmark', 'like', 'purchase']),
  weight: z.number().finite().min(0).max(100).optional(),
  occurredAt: z.string().datetime().optional(),
});
export const recommendationItemParametersSchema = z.object({
  itemId: z.string().trim().min(1).max(255),
});
export const recommendationUserParametersSchema = z.object({
  userId: z.string().trim().min(1).max(255),
});
export const recommendationQuerySchema = z.object({
  indexId: entityIdSchema,
  limit: z.coerce.number().int().min(1).max(100).default(10),
  explain: z.stringbool().default(false),
});
export type RecordInteractionApiRequest = z.infer<typeof recordInteractionRequestSchema>;
export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;

import { z } from 'zod';

import { entityIdSchema } from './entities.js';

export const analyticsRangeQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const clickEventRequestSchema = z.object({
  searchId: entityIdSchema,
  documentId: z.string().trim().min(1).max(255),
  position: z.number().int().min(1).max(10_000),
});

export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;
export type ClickEventApiRequest = z.infer<typeof clickEventRequestSchema>;

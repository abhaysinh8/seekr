import { z } from 'zod';

export const dependencyStatusSchema = z.enum(['up', 'down']);

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  version: z.string(),
  timestamp: z.string().datetime(),
  dependencies: z
    .object({
      postgres: dependencyStatusSchema,
      redis: dependencyStatusSchema,
    })
    .optional(),
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

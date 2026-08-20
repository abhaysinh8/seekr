import { z } from 'zod';

export const entityIdSchema = z.string().uuid();

export const projectSchema = z.object({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const indexSchema = z.object({
  id: entityIdSchema,
  projectId: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const documentSchema = z.object({
  id: entityIdSchema,
  indexId: entityIdSchema,
  externalId: z.string().trim().min(1).max(255),
  fields: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;
export type Index = z.infer<typeof indexSchema>;
export type Document = z.infer<typeof documentSchema>;

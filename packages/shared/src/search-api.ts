import { z } from 'zod';

const scalarValueSchema = z.union([z.string(), z.number().finite(), z.boolean()]);
const fieldValueSchema = z.union([
  scalarValueSchema,
  z.array(scalarValueSchema).max(100),
  z.null(),
]);

export const searchFilterSchema = z
  .object({
    field: z.string().trim().min(1).max(128),
    operator: z.enum([
      'equals',
      'notEquals',
      'in',
      'notIn',
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
      'exists',
    ]),
    value: fieldValueSchema.optional(),
  })
  .strict();

const highlightOptionsSchema = z
  .object({
    fields: z.array(z.string().trim().min(1).max(128)).max(32).optional(),
    preTag: z
      .string()
      .max(50)
      .regex(/^<[a-z][a-z0-9-]*>$/iu)
      .optional(),
    postTag: z
      .string()
      .max(50)
      .regex(/^<\/[a-z][a-z0-9-]*>$/iu)
      .optional(),
  })
  .strict();

const typoToleranceOptionsSchema = z
  .object({
    maxDistance: z.number().int().min(0).max(3).optional(),
    prefixLength: z.number().int().min(0).max(8).optional(),
  })
  .strict();

export const searchRequestSchema = z
  .object({
    query: z.string().max(2_048),
    sessionId: z.string().trim().min(1).max(128).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).max(10_000).default(0),
    fields: z.array(z.string().trim().min(1).max(128)).max(32).optional(),
    filters: z.array(searchFilterSchema).max(20).default([]),
    facets: z.array(z.string().trim().min(1).max(128)).max(20).default([]),
    ranking: z.enum(['bm25', 'tfidf']).default('bm25'),
    typoTolerance: z.union([z.boolean(), typoToleranceOptionsSchema]).default(false),
    spellCorrection: z.boolean().default(false),
    highlight: z.union([z.boolean(), highlightOptionsSchema]).default(false),
    explain: z.boolean().default(false),
    proximityBoost: z.boolean().default(false),
    maxProximityDistance: z.number().int().min(1).max(100).optional(),
    sort: z
      .object({
        field: z.string().trim().min(1).max(128),
        direction: z.enum(['asc', 'desc']),
      })
      .strict()
      .optional(),
    k1: z.number().finite().min(0).max(10).optional(),
    b: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

export const autocompleteRequestSchema = z
  .object({
    prefix: z.string().trim().min(1).max(256),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .strict();

export const indexIdParametersSchema = z.object({ indexId: z.string().uuid() }).strict();

export type SearchApiRequest = z.infer<typeof searchRequestSchema>;
export type AutocompleteApiRequest = z.infer<typeof autocompleteRequestSchema>;
export type IndexIdParameters = z.infer<typeof indexIdParametersSchema>;

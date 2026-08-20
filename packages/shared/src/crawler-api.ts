import { z } from 'zod';

import { entityIdSchema } from './entities.js';

const httpUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'URL must use HTTP or HTTPS',
  });

const domainSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/iu);

export const crawlConfigurationSchema = z.object({
  allowedDomains: z.array(domainSchema).max(20).optional(),
  maxDepth: z.number().int().min(0).max(20).default(3),
  maxPages: z.number().int().min(1).max(10_000).default(100),
  concurrency: z.number().int().min(1).max(20).default(2),
  crawlDelayMs: z.number().int().min(0).max(60_000).default(500),
  requestTimeoutMs: z.number().int().min(500).max(120_000).default(10_000),
  maxRetries: z.number().int().min(0).max(5).default(2),
  maxResponseBytes: z
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(2 * 1024 * 1024),
  maxRedirects: z.number().int().min(0).max(10).default(5),
});

export const createCrawlSourceSchema = z.object({
  projectId: entityIdSchema,
  indexId: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  startingUrl: httpUrlSchema,
  configuration: crawlConfigurationSchema.default({
    maxDepth: 3,
    maxPages: 100,
    concurrency: 2,
    crawlDelayMs: 500,
    requestTimeoutMs: 10_000,
    maxRetries: 2,
    maxResponseBytes: 2 * 1024 * 1024,
    maxRedirects: 5,
  }),
});

export const sourceIdParametersSchema = z.object({ sourceId: entityIdSchema });
export const crawlJobIdParametersSchema = z.object({ jobId: entityIdSchema });
export const listCrawlSourcesQuerySchema = z.object({ projectId: entityIdSchema.optional() });

export type CrawlConfigurationApi = z.infer<typeof crawlConfigurationSchema>;
export type CreateCrawlSourceApiRequest = z.infer<typeof createCrawlSourceSchema>;
export type SourceIdParameters = z.infer<typeof sourceIdParametersSchema>;
export type CrawlJobIdParameters = z.infer<typeof crawlJobIdParametersSchema>;
export type ListCrawlSourcesQuery = z.infer<typeof listCrawlSourcesQuerySchema>;

import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']).default('development');
const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info');

const baseServiceEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema,
  LOG_LEVEL: logLevelSchema,
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  REDIS_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
      message: 'REDIS_URL must use redis:// or rediss://',
    }),
});

const apiEnvironmentSchema = baseServiceEnvironmentSchema.extend({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  SEEKR_REQUEST_BODY_LIMIT: z.coerce
    .number()
    .int()
    .min(16_384)
    .max(10 * 1024 * 1024)
    .default(1024 * 1024),
  SEEKR_RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(100_000).default(120),
  SEEKR_INDEX_PATH: z.string().min(1).default('./data/index'),
  SEEKR_SNAPSHOT_PATH: z.string().min(1).default('./data/snapshots'),
});

const crawlerEnvironmentSchema = baseServiceEnvironmentSchema.extend({
  SEEKR_API_URL: z.string().url().default('http://localhost:4000'),
  SEEKR_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  SEEKR_CRAWL_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
});

function parseEnvironment<T>(schema: z.ZodType<T>, environment: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type CrawlerEnvironment = z.infer<typeof crawlerEnvironmentSchema>;

export function loadApiEnvironment(environment: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  return parseEnvironment(apiEnvironmentSchema, environment);
}

export function loadCrawlerEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): CrawlerEnvironment {
  return parseEnvironment(crawlerEnvironmentSchema, environment);
}

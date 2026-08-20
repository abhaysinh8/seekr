import { z } from 'zod';

import { entityIdSchema } from './entities.js';

export const apiKeyScopeSchema = z.enum([
  'search',
  'documents:read',
  'documents:write',
  'indexes:read',
  'indexes:write',
  'analytics:read',
]);
export const createApiKeyRequestSchema = z.object({
  projectId: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  scopes: z.array(apiKeyScopeSchema).min(1).max(6),
  expiresAt: z.string().datetime().optional(),
});
export const apiKeyIdParametersSchema = z.object({ apiKeyId: entityIdSchema });
export const listApiKeysQuerySchema = z.object({ projectId: entityIdSchema });

export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;
export type CreateApiKeyApiRequest = z.infer<typeof createApiKeyRequestSchema>;

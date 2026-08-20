import type { FastifyPluginCallback } from 'fastify';

import {
  apiKeyIdParametersSchema,
  createApiKeyRequestSchema,
  listApiKeysQuerySchema,
} from '@seekr/shared';

import { HttpError } from '../errors/http-error.js';
import type { ApiKeyService } from '../services/api-key-service.js';
import { parseRequest } from './validation.js';

interface ApiKeyRouteOptions {
  readonly apiKeys: ApiKeyService;
}

export const apiKeyRoutes: FastifyPluginCallback<ApiKeyRouteOptions> = (app, options, done) => {
  app.post('/v1/api-keys', async (request, reply) => {
    const input = parseRequest(createApiKeyRequestSchema, request.body, 'API key');
    if (request.auth === null) {
      if ((await options.apiKeys.countForProject(input.projectId)) > 0) {
        throw new HttpError(
          401,
          'AUTHENTICATION_REQUIRED',
          'Authenticate to create additional API keys',
        );
      }
    } else {
      assertProject(request.auth.projectId, input.projectId);
      if (!request.auth.scopes.has('indexes:write'))
        throw new HttpError(403, 'INSUFFICIENT_SCOPE', 'Creating API keys requires indexes:write');
    }
    const created = await options.apiKeys.create(input);
    return reply.status(201).send({ ...created, requestId: request.id });
  });

  app.get('/v1/api-keys', async (request) => {
    const { projectId } = parseRequest(listApiKeysQuerySchema, request.query, 'API key query');
    if (request.auth === null)
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    assertProject(request.auth.projectId, projectId);
    return { keys: await options.apiKeys.list(projectId), requestId: request.id };
  });

  app.delete('/v1/api-keys/:apiKeyId', async (request, reply) => {
    const { apiKeyId } = parseRequest(apiKeyIdParametersSchema, request.params, 'path parameters');
    if (request.auth === null)
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    const key = await options.apiKeys.revoke(apiKeyId, request.auth.projectId);
    return reply.status(200).send({ key, requestId: request.id });
  });

  done();
};

function assertProject(actual: string, expected: string): void {
  if (actual !== expected)
    throw new HttpError(
      403,
      'PROJECT_ACCESS_DENIED',
      'The API key does not belong to this project',
    );
}

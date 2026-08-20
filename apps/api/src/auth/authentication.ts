import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ApiKeyScope } from '@seekr/shared';

import { HttpError } from '../errors/http-error.js';
import type { ApiKeyService, AuthenticatedApiKey } from '../services/api-key-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthenticatedApiKey | null;
  }
}

export function createAuthenticationHook(apiKeys: ApiKeyService) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const route = request.routeOptions.url ?? request.url;
    const scope = requiredScope(request.method, route);
    const optional = request.method === 'POST' && route === '/v1/api-keys';
    if (scope === undefined && !optional) return;

    const authorization = request.headers.authorization;
    if (authorization === undefined && optional) return;
    if (authorization === undefined || !authorization.startsWith('Bearer ')) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'A valid Bearer API key is required');
    }
    const authenticated = await apiKeys.authenticate(authorization.slice('Bearer '.length));
    if (authenticated === undefined)
      throw new HttpError(401, 'INVALID_API_KEY', 'The API key is invalid, expired, or revoked');
    request.auth = authenticated;
    if (scope !== undefined && !authenticated.scopes.has(scope)) {
      throw new HttpError(403, 'INSUFFICIENT_SCOPE', `This operation requires the ${scope} scope`);
    }
  };
}

function requiredScope(method: string, route: string): ApiKeyScope | undefined {
  if (!route.startsWith('/v1/')) return undefined;
  if (route === '/v1/projects' && method === 'POST') return undefined;
  if (route === '/v1/api-keys' && method === 'POST') return undefined;
  if (route.includes('/analytics')) return 'analytics:read';
  if (route.endsWith('/search') || route.endsWith('/autocomplete')) return 'search';
  if (route === '/v1/events/click') return 'search';
  if (route.startsWith('/v1/recommend')) return 'search';
  if (route === '/v1/interactions') return 'documents:write';
  if (route.includes('/documents')) return method === 'GET' ? 'documents:read' : 'documents:write';
  if (route.startsWith('/v1/indexes')) return method === 'GET' ? 'indexes:read' : 'indexes:write';
  if (route.startsWith('/v1/api-keys')) return method === 'GET' ? 'indexes:read' : 'indexes:write';
  if (route.startsWith('/v1/sources') || route.startsWith('/v1/crawl')) {
    return method === 'GET' ? 'documents:read' : 'documents:write';
  }
  return undefined;
}

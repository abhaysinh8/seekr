import type { FastifyPluginCallback } from 'fastify';

import {
  analyticsRangeQuerySchema,
  clickEventRequestSchema,
  managedIndexIdParametersSchema,
} from '@seekr/shared';

import type { AnalyticsService } from '../services/analytics-service.js';
import type { QuerySuggestionService } from '../services/query-suggestion-service.js';
import { parseRequest } from './validation.js';

interface AnalyticsRouteOptions {
  readonly analytics: AnalyticsService;
  readonly suggestions: QuerySuggestionService;
}

export const analyticsRoutes: FastifyPluginCallback<AnalyticsRouteOptions> = (
  app,
  options,
  done,
) => {
  app.get('/v1/indexes/:indexId/analytics/overview', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const query = parseRequest(analyticsRangeQuerySchema, request.query, 'analytics query');
    return { ...(await options.analytics.overview(indexId, query)), requestId: request.id };
  });
  app.get('/v1/indexes/:indexId/analytics/queries', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const query = parseRequest(analyticsRangeQuerySchema, request.query, 'analytics query');
    return { ...(await options.analytics.queries(indexId, query)), requestId: request.id };
  });
  app.get('/v1/indexes/:indexId/analytics/no-results', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const query = parseRequest(analyticsRangeQuerySchema, request.query, 'analytics query');
    return { ...(await options.analytics.noResults(indexId, query)), requestId: request.id };
  });
  app.get('/v1/indexes/:indexId/analytics/latency', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const query = parseRequest(analyticsRangeQuerySchema, request.query, 'analytics query');
    return { ...(await options.analytics.latency(indexId, query)), requestId: request.id };
  });
  app.get('/v1/indexes/:indexId/analytics/clicks', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const query = parseRequest(analyticsRangeQuerySchema, request.query, 'analytics query');
    return { ...(await options.analytics.clicks(indexId, query)), requestId: request.id };
  });
  app.post('/v1/events/click', async (request, reply) => {
    const event = parseRequest(clickEventRequestSchema, request.body, 'click event');
    await options.analytics.recordClick(event);
    options.suggestions.recordClick(event.searchId);
    return reply.status(202).send({ accepted: true, requestId: request.id });
  });
  done();
};

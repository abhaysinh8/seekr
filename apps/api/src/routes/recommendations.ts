import type { FastifyPluginCallback } from 'fastify';
import {
  recommendationItemParametersSchema,
  recommendationQuerySchema,
  recommendationUserParametersSchema,
  recordInteractionRequestSchema,
} from '@seekr/shared';
import type { RecommendationService } from '../services/recommendation-service.js';
import { parseRequest } from './validation.js';

interface RecommendationRouteOptions {
  readonly recommendations: RecommendationService;
}

export const recommendationRoutes: FastifyPluginCallback<RecommendationRouteOptions> = (
  app,
  options,
  done,
) => {
  app.post('/v1/interactions', async (request, reply) => {
    const interaction = parseRequest(recordInteractionRequestSchema, request.body, 'interaction');
    await options.recommendations.recordInteraction(interaction);
    return reply.status(202).send({ accepted: true, requestId: request.id });
  });
  app.get('/v1/recommend/items/:itemId', (request) => {
    const { itemId } = parseRequest(
      recommendationItemParametersSchema,
      request.params,
      'path parameters',
    );
    const query = parseRequest(recommendationQuerySchema, request.query, 'recommendation query');
    return {
      itemId,
      recommendations: options.recommendations.recommendItems(query.indexId, itemId, query.limit),
      requestId: request.id,
    };
  });
  app.get('/v1/recommend/users/:userId', (request) => {
    const { userId } = parseRequest(
      recommendationUserParametersSchema,
      request.params,
      'path parameters',
    );
    const query = parseRequest(recommendationQuerySchema, request.query, 'recommendation query');
    return {
      userId,
      recommendations: options.recommendations.recommendForUser(
        query.indexId,
        userId,
        query.limit,
        query.explain,
      ),
      requestId: request.id,
    };
  });
  app.get('/v1/recommend/popular', (request) => {
    const query = parseRequest(recommendationQuerySchema, request.query, 'recommendation query');
    return {
      recommendations: options.recommendations.getPopularItems(query.indexId, query.limit),
      requestId: request.id,
    };
  });
  app.get('/v1/recommend/statistics', (request) => {
    const query = parseRequest(recommendationQuerySchema, request.query, 'recommendation query');
    return {
      statistics: options.recommendations.getStatistics(query.indexId),
      requestId: request.id,
    };
  });
  done();
};

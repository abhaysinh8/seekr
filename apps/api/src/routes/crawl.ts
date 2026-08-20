import type { FastifyPluginCallback } from 'fastify';

import {
  crawlJobIdParametersSchema,
  createCrawlSourceSchema,
  listCrawlSourcesQuerySchema,
  sourceIdParametersSchema,
} from '@seekr/shared';

import { HttpError } from '../errors/http-error.js';
import type { CrawlRepository } from '../services/crawl-repository.js';
import { parseRequest } from './validation.js';

interface CrawlRouteOptions {
  readonly crawls: CrawlRepository;
}

export const crawlRoutes: FastifyPluginCallback<CrawlRouteOptions> = (app, options, done) => {
  app.post('/v1/sources', async (request, reply) => {
    const input = parseRequest(createCrawlSourceSchema, request.body, 'crawl source');
    const source = await options.crawls.createSource(input);
    return reply.status(201).send({ source, requestId: request.id });
  });

  app.get('/v1/sources', async (request) => {
    const { projectId } = parseRequest(
      listCrawlSourcesQuerySchema,
      request.query,
      'crawl source query',
    );
    const sources = await options.crawls.listSources(projectId);
    return { sources, requestId: request.id };
  });

  app.get('/v1/sources/:sourceId', async (request) => {
    const { sourceId } = parseRequest(sourceIdParametersSchema, request.params, 'path parameters');
    const source = await options.crawls.getSource(sourceId);
    if (source === undefined) throw notFound('Crawl source', sourceId);
    return { source, requestId: request.id };
  });

  app.delete('/v1/sources/:sourceId', async (request, reply) => {
    const { sourceId } = parseRequest(sourceIdParametersSchema, request.params, 'path parameters');
    if (!(await options.crawls.deleteSource(sourceId))) throw notFound('Crawl source', sourceId);
    return reply.status(204).send();
  });

  app.post('/v1/sources/:sourceId/crawl', async (request, reply) => {
    const { sourceId } = parseRequest(sourceIdParametersSchema, request.params, 'path parameters');
    if ((await options.crawls.getSource(sourceId)) === undefined)
      throw notFound('Crawl source', sourceId);
    const job = await options.crawls.createJob(sourceId);
    return reply.status(202).send({ job, requestId: request.id });
  });

  app.get('/v1/crawl/:jobId', async (request) => {
    const { jobId } = parseRequest(crawlJobIdParametersSchema, request.params, 'path parameters');
    const job = await options.crawls.getJob(jobId);
    if (job === undefined) throw notFound('Crawl job', jobId);
    return { job, requestId: request.id };
  });

  done();
};

function notFound(entity: string, id: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', `${entity} ${id} was not found`);
}

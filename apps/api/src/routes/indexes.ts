import type { FastifyPluginCallback } from 'fastify';

import {
  addDocumentRequestSchema,
  bulkDocumentsRequestSchema,
  createIndexRequestSchema,
  createProjectRequestSchema,
  documentParametersSchema,
  listDocumentsQuerySchema,
  listIndexesQuerySchema,
  managedIndexIdParametersSchema,
  updateIndexSchemaRequestSchema,
  updateSynonymsRequestSchema,
} from '@seekr/shared';

import type { IndexManagementService } from '../services/index-management.js';
import type { BackgroundJobService } from '../services/background-jobs.js';
import { parseRequest } from './validation.js';

interface IndexRouteOptions {
  readonly management: IndexManagementService;
  readonly jobs?: BackgroundJobService;
}

export const indexRoutes: FastifyPluginCallback<IndexRouteOptions> = (app, options, done) => {
  app.post('/v1/projects', async (request, reply) => {
    const input = parseRequest(createProjectRequestSchema, request.body, 'project');
    const project = await options.management.createProject(input);
    return reply.status(201).send({ project, requestId: request.id });
  });

  app.post('/v1/indexes', async (request, reply) => {
    const input = parseRequest(createIndexRequestSchema, request.body, 'index');
    const index = await options.management.createIndex(input);
    return reply.status(201).send({ index, requestId: request.id });
  });

  app.get('/v1/indexes', async (request) => {
    const { projectId } = parseRequest(listIndexesQuerySchema, request.query, 'index query');
    const indexes = await options.management.listIndexes(request.auth?.projectId ?? projectId);
    return { indexes, requestId: request.id };
  });

  app.get('/v1/indexes/:indexId', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    return { index: await options.management.getIndex(indexId), requestId: request.id };
  });

  app.delete('/v1/indexes/:indexId', async (request, reply) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    await options.management.deleteIndex(indexId);
    return reply.status(204).send();
  });

  app.put('/v1/indexes/:indexId/schema', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const { schema } = parseRequest(updateIndexSchemaRequestSchema, request.body, 'index schema');
    return { ...(await options.management.updateSchema(indexId, schema)), requestId: request.id };
  });

  app.get('/v1/indexes/:indexId/synonyms', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const index = await options.management.getIndex(indexId);
    return {
      synonyms: index.schema.synonyms,
      synonymPenalty: index.schema.synonymPenalty,
      requestId: request.id,
    };
  });

  app.put('/v1/indexes/:indexId/synonyms', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const input = parseRequest(updateSynonymsRequestSchema, request.body, 'synonym configuration');
    return {
      ...(await options.management.updateSynonyms(indexId, input.synonyms, input.synonymPenalty)),
      requestId: request.id,
    };
  });

  app.post('/v1/indexes/:indexId/reindex', async (request, reply) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    if (options.jobs !== undefined) {
      const job = await options.jobs.enqueue(
        'reindex',
        { indexId },
        idempotencyOptions(request.headers['idempotency-key']),
      );
      return reply.status(202).send({ job, requestId: request.id });
    }
    const result = await options.management.reindex(indexId);
    return reply.status(202).send({ ...result, requestId: request.id });
  });

  app.get('/v1/indexes/:indexId/documents', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const { limit, offset } = parseRequest(
      listDocumentsQuerySchema,
      request.query,
      'document query',
    );
    return {
      ...(await options.management.listDocuments(indexId, limit, offset)),
      requestId: request.id,
    };
  });

  app.post('/v1/indexes/:indexId/documents', async (request, reply) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const document = parseRequest(addDocumentRequestSchema, request.body, 'document');
    const result = await options.management.addDocuments(indexId, [document]);
    return reply.status(201).send({ ...result, requestId: request.id });
  });

  app.get('/v1/indexes/:indexId/documents/:documentId', async (request) => {
    const { indexId, documentId } = parseRequest(
      documentParametersSchema,
      request.params,
      'path parameters',
    );
    return {
      document: await options.management.getDocument(indexId, documentId),
      requestId: request.id,
    };
  });

  app.post('/v1/indexes/:indexId/documents/bulk', async (request, reply) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    const { documents } = parseRequest(bulkDocumentsRequestSchema, request.body, 'bulk documents');
    if (options.jobs !== undefined && documents.length >= 100) {
      const job = await options.jobs.enqueue(
        'bulk_ingestion',
        { indexId, documents },
        idempotencyOptions(request.headers['idempotency-key']),
      );
      return reply.status(202).send({ job, requestId: request.id });
    }
    const result = await options.management.addDocuments(indexId, documents);
    return reply.status(201).send({ ...result, requestId: request.id });
  });

  app.delete('/v1/indexes/:indexId/documents/:documentId', async (request, reply) => {
    const { indexId, documentId } = parseRequest(
      documentParametersSchema,
      request.params,
      'path parameters',
    );
    await options.management.deleteDocument(indexId, documentId);
    return reply.status(204).send();
  });

  done();
};

function idempotencyOptions(value: string | string[] | undefined): { idempotencyKey?: string } {
  return typeof value === 'string' && value.length > 0
    ? { idempotencyKey: value.slice(0, 200) }
    : {};
}

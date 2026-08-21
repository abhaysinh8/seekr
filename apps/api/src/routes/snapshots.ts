import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { managedIndexIdParametersSchema } from '@seekr/shared';
import { HttpError } from '../errors/http-error.js';
import type { IndexSnapshotService } from '../services/snapshot-service.js';
import { parseRequest } from './validation.js';

const snapshotParameters = managedIndexIdParametersSchema.extend({
  snapshotId: z.string().regex(/^snapshot-[A-Za-z0-9-]+$/u),
});

export const snapshotRoutes: FastifyPluginCallback<{ snapshots: IndexSnapshotService }> = (
  app,
  options,
  done,
) => {
  app.post('/v1/indexes/:indexId/snapshots', async (request, reply) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    return reply
      .status(201)
      .send({ snapshot: await options.snapshots.create(indexId), requestId: request.id });
  });
  app.get('/v1/indexes/:indexId/snapshots', async (request) => {
    const { indexId } = parseRequest(
      managedIndexIdParametersSchema,
      request.params,
      'path parameters',
    );
    return { snapshots: await options.snapshots.list(indexId), requestId: request.id };
  });
  app.post('/v1/indexes/:indexId/snapshots/:snapshotId/restore', async (request, reply) => {
    const { indexId, snapshotId } = parseRequest(
      snapshotParameters,
      request.params,
      'path parameters',
    );
    return reply
      .status(202)
      .send({ ...(await options.snapshots.restore(indexId, snapshotId)), requestId: request.id });
  });
  app.delete('/v1/indexes/:indexId/snapshots/:snapshotId', async (request, reply) => {
    const { indexId, snapshotId } = parseRequest(
      snapshotParameters,
      request.params,
      'path parameters',
    );
    if (!(await options.snapshots.delete(indexId, snapshotId)))
      throw new HttpError(404, 'NOT_FOUND', `Snapshot ${snapshotId} was not found`);
    return reply.status(204).send();
  });
  done();
};

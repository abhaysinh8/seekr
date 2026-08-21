import type { FastifyPluginCallback } from 'fastify';
import { jobIdParametersSchema } from '@seekr/shared';
import { HttpError } from '../errors/http-error.js';
import type { BackgroundJobService } from '../services/background-jobs.js';
import type { IndexManagementService } from '../services/index-management.js';
import { parseRequest } from './validation.js';

export const jobRoutes: FastifyPluginCallback<{
  readonly jobs: BackgroundJobService;
  readonly indexes: IndexManagementService;
}> = (app, options, done) => {
  app.get('/v1/jobs/:jobId', async (request) => {
    const { jobId } = parseRequest(jobIdParametersSchema, request.params, 'path parameters');
    const job = await options.jobs.get(jobId);
    if (job === undefined) throw new HttpError(404, 'NOT_FOUND', `Job ${jobId} was not found`);
    await assertJobProject(job.payload, request.auth?.projectId, options.indexes);
    return { job, requestId: request.id };
  });
  app.delete('/v1/jobs/:jobId', async (request, reply) => {
    const { jobId } = parseRequest(jobIdParametersSchema, request.params, 'path parameters');
    const job = await options.jobs.get(jobId);
    if (job === undefined) throw new HttpError(404, 'NOT_FOUND', `Job ${jobId} was not found`);
    await assertJobProject(job.payload, request.auth?.projectId, options.indexes);
    if (!(await options.jobs.cancel(jobId))) {
      throw new HttpError(409, 'JOB_NOT_CANCELLABLE', `Job ${jobId} is not queued or running`);
    }
    return reply.status(202).send({ cancelled: true, requestId: request.id });
  });
  done();
};

async function assertJobProject(
  payload: Readonly<Record<string, unknown>>,
  authenticatedProjectId: string | undefined,
  indexes: IndexManagementService,
): Promise<void> {
  if (authenticatedProjectId === undefined || typeof payload.indexId !== 'string') return;
  if ((await indexes.getProjectId(payload.indexId)) !== authenticatedProjectId)
    throw new HttpError(403, 'PROJECT_ACCESS_DENIED', 'The API key cannot access this job');
}

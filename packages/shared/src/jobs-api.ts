import { z } from 'zod';
import { entityIdSchema } from './entities.js';

export const jobIdParametersSchema = z.object({ jobId: entityIdSchema });
export type BackgroundJobType =
  'bulk_ingestion' | 'crawl' | 'reindex' | 'segment_merge' | 'index_optimization' | 'snapshot';
export type BackgroundJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

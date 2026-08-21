import type { BackgroundJobType } from '@seekr/shared';
import type { BackgroundJobRecord, JobPayload, JobRepository } from './job-repository.js';

export interface JobContext {
  readonly job: BackgroundJobRecord;
  reportProgress(progress: number): Promise<void>;
}
export type JobHandler = (payload: JobPayload, context: JobContext) => Promise<void>;

export class BackgroundJobService {
  readonly #handlers = new Map<BackgroundJobType, JobHandler>();
  constructor(private readonly repository: JobRepository) {}
  register(type: BackgroundJobType, handler: JobHandler): void {
    this.#handlers.set(type, handler);
  }
  enqueue(
    type: BackgroundJobType,
    payload: JobPayload,
    options: { maxAttempts?: number; idempotencyKey?: string } = {},
  ) {
    return this.repository.enqueue(type, payload, options.maxAttempts ?? 3, options.idempotencyKey);
  }
  get(id: string) {
    return this.repository.get(id);
  }
  cancel(id: string) {
    return this.repository.cancel(id);
  }
  async runOnce(): Promise<boolean> {
    const job = await this.repository.claimNext();
    if (job === undefined) return false;
    const handler = this.#handlers.get(job.type);
    if (handler === undefined) {
      await this.repository.failOrRetry(job.id, `No handler registered for ${job.type}`);
      return true;
    }
    try {
      await handler(job.payload, {
        job,
        reportProgress: (progress) =>
          this.repository.setProgress(job.id, validateProgress(progress)),
      });
      await this.repository.complete(job.id);
    } catch (error) {
      await this.repository.failOrRetry(
        job.id,
        error instanceof Error ? error.message : 'Unknown job failure',
      );
    }
    return true;
  }
}

function validateProgress(progress: number): number {
  if (!Number.isInteger(progress) || progress < 0 || progress > 100)
    throw new RangeError('Job progress must be an integer from 0 through 100');
  return progress;
}

import { describe, expect, it, vi } from 'vitest';
import { BackgroundJobService } from './background-jobs.js';
import { InMemoryJobRepository } from './job-repository.js';

describe('durable background job state machine', () => {
  it('runs handlers, reports progress, and completes', async () => {
    const repository = new InMemoryJobRepository(() => new Date('2026-01-01T00:00:00Z'));
    const jobs = new BackgroundJobService(repository);
    jobs.register('reindex', async (_payload, context) => {
      await context.reportProgress(50);
    });
    const job = await jobs.enqueue('reindex', { indexId: 'index' });
    expect(job.status).toBe('queued');
    expect(await jobs.runOnce()).toBe(true);
    expect(await jobs.get(job.id)).toMatchObject({
      status: 'completed',
      progress: 100,
      attempts: 1,
    });
  });
  it('retries failures up to max attempts and preserves the error', async () => {
    const jobs = new BackgroundJobService(new InMemoryJobRepository());
    const handler = vi.fn().mockRejectedValue(new Error('temporary failure'));
    jobs.register('snapshot', handler);
    const job = await jobs.enqueue('snapshot', {}, { maxAttempts: 2 });
    await jobs.runOnce();
    expect(await jobs.get(job.id)).toMatchObject({
      status: 'queued',
      attempts: 1,
      errorMessage: 'temporary failure',
    });
    await jobs.runOnce();
    expect(await jobs.get(job.id)).toMatchObject({
      status: 'failed',
      attempts: 2,
      errorMessage: 'temporary failure',
    });
  });
  it('deduplicates idempotent enqueue requests and cancels queued work', async () => {
    const jobs = new BackgroundJobService(new InMemoryJobRepository());
    const first = await jobs.enqueue('bulk_ingestion', { batch: 1 }, { idempotencyKey: 'same' });
    const second = await jobs.enqueue('bulk_ingestion', { batch: 2 }, { idempotencyKey: 'same' });
    expect(second.id).toBe(first.id);
    expect(await jobs.cancel(first.id)).toBe(true);
    expect(await jobs.get(first.id)).toMatchObject({ status: 'cancelled' });
  });
});

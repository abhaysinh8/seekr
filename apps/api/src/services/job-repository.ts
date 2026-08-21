import { randomUUID } from 'node:crypto';
import type { JSONValue } from 'postgres';
import type { BackgroundJobStatus, BackgroundJobType } from '@seekr/shared';
import type { Database } from '../database/client.js';

export type JobPayload = Readonly<Record<string, JSONValue>>;
export interface BackgroundJobRecord {
  readonly id: string;
  readonly type: BackgroundJobType;
  readonly status: BackgroundJobStatus;
  readonly payload: JobPayload;
  readonly progress: number;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly idempotencyKey: string | null;
  readonly errorMessage: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}
export interface JobRepository {
  enqueue(
    type: BackgroundJobType,
    payload: JobPayload,
    maxAttempts: number,
    idempotencyKey?: string,
  ): Promise<BackgroundJobRecord>;
  get(id: string): Promise<BackgroundJobRecord | undefined>;
  claimNext(): Promise<BackgroundJobRecord | undefined>;
  setProgress(id: string, progress: number): Promise<void>;
  complete(id: string): Promise<void>;
  failOrRetry(id: string, error: string): Promise<void>;
  cancel(id: string): Promise<boolean>;
}

interface JobRow extends Omit<BackgroundJobRecord, 'createdAt' | 'startedAt' | 'completedAt'> {
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export class PostgresJobRepository implements JobRepository {
  constructor(private readonly database: Database) {}
  async enqueue(
    type: BackgroundJobType,
    payload: JobPayload,
    maxAttempts: number,
    idempotencyKey?: string,
  ): Promise<BackgroundJobRecord> {
    if (idempotencyKey !== undefined) {
      const existing = await this.database.sql<
        JobRow[]
      >`select * from background_jobs where idempotency_key = ${idempotencyKey} limit 1`;
      if (existing[0] !== undefined) return mapRow(existing[0]);
    }
    const rows = await this.database.sql<JobRow[]>`
      insert into background_jobs (type, payload, max_attempts, idempotency_key)
      values (${type}, ${this.database.sql.json(payload)}, ${maxAttempts}, ${idempotencyKey ?? null})
      returning *
    `;
    return mapRow(requiredRow(rows));
  }
  async get(id: string): Promise<BackgroundJobRecord | undefined> {
    const rows = await this.database.sql<
      JobRow[]
    >`select * from background_jobs where id = ${id} limit 1`;
    return rows[0] === undefined ? undefined : mapRow(rows[0]);
  }
  async claimNext(): Promise<BackgroundJobRecord | undefined> {
    const rows = await this.database.sql<JobRow[]>`
      update background_jobs set status = 'running', started_at = coalesce(started_at, now()),
        attempts = attempts + 1, error_message = null
      where id = (select id from background_jobs where status = 'queued' order by created_at for update skip locked limit 1)
      returning *
    `;
    return rows[0] === undefined ? undefined : mapRow(rows[0]);
  }
  async setProgress(id: string, progress: number): Promise<void> {
    await this.database
      .sql`update background_jobs set progress = ${progress} where id = ${id} and status = 'running'`;
  }
  async complete(id: string): Promise<void> {
    await this.database
      .sql`update background_jobs set status = 'completed', progress = 100, completed_at = now() where id = ${id} and status = 'running'`;
  }
  async failOrRetry(id: string, error: string): Promise<void> {
    await this.database
      .sql`update background_jobs set status = case when attempts < max_attempts then 'queued' else 'failed' end, error_message = ${error}, completed_at = case when attempts < max_attempts then null else now() end where id = ${id} and status = 'running'`;
  }
  async cancel(id: string): Promise<boolean> {
    const rows = await this.database.sql<
      { id: string }[]
    >`update background_jobs set status = 'cancelled', completed_at = now() where id = ${id} and status in ('queued', 'running') returning id`;
    return rows.length > 0;
  }
}

export class InMemoryJobRepository implements JobRepository {
  readonly #jobs = new Map<string, BackgroundJobRecord>();
  constructor(private readonly now: () => Date = () => new Date()) {}
  enqueue(
    type: BackgroundJobType,
    payload: JobPayload,
    maxAttempts: number,
    idempotencyKey?: string,
  ): Promise<BackgroundJobRecord> {
    const existing =
      idempotencyKey === undefined
        ? undefined
        : [...this.#jobs.values()].find((job) => job.idempotencyKey === idempotencyKey);
    if (existing !== undefined) return Promise.resolve(existing);
    const job: BackgroundJobRecord = {
      id: randomUUID(),
      type,
      status: 'queued',
      payload,
      progress: 0,
      attempts: 0,
      maxAttempts,
      idempotencyKey: idempotencyKey ?? null,
      errorMessage: null,
      createdAt: this.now().toISOString(),
      startedAt: null,
      completedAt: null,
    };
    this.#jobs.set(job.id, job);
    return Promise.resolve(job);
  }
  get(id: string): Promise<BackgroundJobRecord | undefined> {
    return Promise.resolve(this.#jobs.get(id));
  }
  claimNext(): Promise<BackgroundJobRecord | undefined> {
    const job = [...this.#jobs.values()].find((value) => value.status === 'queued');
    if (job === undefined) return Promise.resolve(undefined);
    const claimed = {
      ...job,
      status: 'running' as const,
      attempts: job.attempts + 1,
      startedAt: job.startedAt ?? this.now().toISOString(),
      errorMessage: null,
    };
    this.#jobs.set(job.id, claimed);
    return Promise.resolve(claimed);
  }
  setProgress(id: string, progress: number): Promise<void> {
    this.#update(id, (job) => ({ ...job, progress }));
    return Promise.resolve();
  }
  complete(id: string): Promise<void> {
    this.#update(id, (job) => ({
      ...job,
      status: 'completed',
      progress: 100,
      completedAt: this.now().toISOString(),
    }));
    return Promise.resolve();
  }
  failOrRetry(id: string, error: string): Promise<void> {
    this.#update(id, (job) => ({
      ...job,
      status: job.attempts < job.maxAttempts ? 'queued' : 'failed',
      errorMessage: error,
      completedAt: job.attempts < job.maxAttempts ? null : this.now().toISOString(),
    }));
    return Promise.resolve();
  }
  cancel(id: string): Promise<boolean> {
    const job = this.#jobs.get(id);
    if (job === undefined || !['queued', 'running'].includes(job.status))
      return Promise.resolve(false);
    this.#jobs.set(id, { ...job, status: 'cancelled', completedAt: this.now().toISOString() });
    return Promise.resolve(true);
  }
  #update(id: string, update: (job: BackgroundJobRecord) => BackgroundJobRecord): void {
    const job = this.#jobs.get(id);
    if (job !== undefined) this.#jobs.set(id, update(job));
  }
}

function mapRow(row: JobRow): BackgroundJobRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
function requiredRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('Database insert did not return a row');
  return row;
}

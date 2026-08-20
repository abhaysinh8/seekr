import { randomUUID } from 'node:crypto';

import type { CrawlConfigurationApi, CreateCrawlSourceApiRequest } from '@seekr/shared';

import type { Database } from '../database/client.js';

export interface CrawlSourceRecord {
  readonly id: string;
  readonly projectId: string;
  readonly indexId: string;
  readonly name: string;
  readonly startingUrl: string;
  readonly configuration: CrawlConfigurationApi;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CrawlJobRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly discovered: number;
  readonly fetched: number;
  readonly indexed: number;
  readonly skipped: number;
  readonly failed: number;
  readonly errorMessage: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

export interface CrawlRepository {
  createSource(input: CreateCrawlSourceApiRequest): Promise<CrawlSourceRecord>;
  listSources(projectId?: string): Promise<readonly CrawlSourceRecord[]>;
  getSource(id: string): Promise<CrawlSourceRecord | undefined>;
  deleteSource(id: string): Promise<boolean>;
  createJob(sourceId: string): Promise<CrawlJobRecord>;
  getJob(id: string): Promise<CrawlJobRecord | undefined>;
}

interface CrawlSourceRow extends Omit<CrawlSourceRecord, 'createdAt' | 'updatedAt'> {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface CrawlJobRow extends Omit<CrawlJobRecord, 'createdAt' | 'startedAt' | 'completedAt'> {
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export class PostgresCrawlRepository implements CrawlRepository {
  constructor(private readonly database: Database) {}

  async createSource(input: CreateCrawlSourceApiRequest): Promise<CrawlSourceRecord> {
    const rows = await this.database.sql<CrawlSourceRow[]>`
      insert into crawl_sources (project_id, index_id, name, start_url, configuration)
      values (
        ${input.projectId},
        ${input.indexId},
        ${input.name},
        ${input.startingUrl},
        ${this.database.sql.json(input.configuration)}
      )
      returning id, project_id, index_id, name, start_url as starting_url, configuration,
        created_at, updated_at
    `;
    return mapSource(requiredRow(rows));
  }

  async listSources(projectId?: string): Promise<readonly CrawlSourceRecord[]> {
    const rows =
      projectId === undefined
        ? await this.database.sql<CrawlSourceRow[]>`
            select id, project_id, index_id, name, start_url as starting_url, configuration,
              created_at, updated_at
            from crawl_sources order by created_at desc
          `
        : await this.database.sql<CrawlSourceRow[]>`
            select id, project_id, index_id, name, start_url as starting_url, configuration,
              created_at, updated_at
            from crawl_sources where project_id = ${projectId} order by created_at desc
          `;
    return rows.map(mapSource);
  }

  async getSource(id: string): Promise<CrawlSourceRecord | undefined> {
    const rows = await this.database.sql<CrawlSourceRow[]>`
      select id, project_id, index_id, name, start_url as starting_url, configuration,
        created_at, updated_at
      from crawl_sources where id = ${id} limit 1
    `;
    return rows[0] === undefined ? undefined : mapSource(rows[0]);
  }

  async deleteSource(id: string): Promise<boolean> {
    const rows = await this.database.sql<{ id: string }[]>`
      delete from crawl_sources where id = ${id} returning id
    `;
    return rows.length > 0;
  }

  async createJob(sourceId: string): Promise<CrawlJobRecord> {
    const rows = await this.database.sql<CrawlJobRow[]>`
      insert into crawl_jobs (source_id, status) values (${sourceId}, 'queued')
      returning id, source_id, status, discovered, fetched, indexed, skipped, failed,
        error_message, started_at, completed_at, created_at
    `;
    return mapJob(requiredRow(rows));
  }

  async getJob(id: string): Promise<CrawlJobRecord | undefined> {
    const rows = await this.database.sql<CrawlJobRow[]>`
      select id, source_id, status, discovered, fetched, indexed, skipped, failed,
        error_message, started_at, completed_at, created_at
      from crawl_jobs where id = ${id} limit 1
    `;
    return rows[0] === undefined ? undefined : mapJob(rows[0]);
  }
}

export class InMemoryCrawlRepository implements CrawlRepository {
  readonly #sources = new Map<string, CrawlSourceRecord>();
  readonly #jobs = new Map<string, CrawlJobRecord>();
  readonly #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  createSource(input: CreateCrawlSourceApiRequest): Promise<CrawlSourceRecord> {
    const timestamp = this.#now().toISOString();
    const source: CrawlSourceRecord = {
      id: randomUUID(),
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.#sources.set(source.id, source);
    return Promise.resolve(source);
  }

  listSources(projectId?: string): Promise<readonly CrawlSourceRecord[]> {
    return Promise.resolve(
      [...this.#sources.values()]
        .filter((source) => projectId === undefined || source.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  getSource(id: string): Promise<CrawlSourceRecord | undefined> {
    return Promise.resolve(this.#sources.get(id));
  }

  deleteSource(id: string): Promise<boolean> {
    const deleted = this.#sources.delete(id);
    if (deleted) {
      for (const [jobId, job] of this.#jobs) if (job.sourceId === id) this.#jobs.delete(jobId);
    }
    return Promise.resolve(deleted);
  }

  createJob(sourceId: string): Promise<CrawlJobRecord> {
    const job: CrawlJobRecord = {
      id: randomUUID(),
      sourceId,
      status: 'queued',
      discovered: 0,
      fetched: 0,
      indexed: 0,
      skipped: 0,
      failed: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: this.#now().toISOString(),
    };
    this.#jobs.set(job.id, job);
    return Promise.resolve(job);
  }

  getJob(id: string): Promise<CrawlJobRecord | undefined> {
    return Promise.resolve(this.#jobs.get(id));
  }
}

function mapSource(row: CrawlSourceRow): CrawlSourceRecord {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function mapJob(row: CrawlJobRow): CrawlJobRecord {
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

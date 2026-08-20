import { randomUUID } from 'node:crypto';

import type { ApiKeyScope } from '@seekr/shared';

import type { Database } from '../database/client.js';

export interface ApiKeyRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly prefix: string;
  readonly hashedSecret: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
}

export interface NewApiKeyRecord {
  readonly projectId: string;
  readonly name: string;
  readonly prefix: string;
  readonly hashedSecret: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly expiresAt?: string;
}

export interface ApiKeyRepository {
  create(input: NewApiKeyRecord): Promise<ApiKeyRecord>;
  list(projectId: string): Promise<readonly ApiKeyRecord[]>;
  findActiveByPrefix(prefix: string): Promise<readonly ApiKeyRecord[]>;
  revoke(id: string, projectId: string): Promise<ApiKeyRecord | undefined>;
  updateLastUsed(id: string, timestamp: string): Promise<void>;
  countForProject(projectId: string): Promise<number>;
}

interface ApiKeyRow extends Omit<
  ApiKeyRecord,
  'createdAt' | 'lastUsedAt' | 'expiresAt' | 'revokedAt'
> {
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
}

export class PostgresApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly database: Database) {}

  async create(input: NewApiKeyRecord): Promise<ApiKeyRecord> {
    const rows = await this.database.sql<ApiKeyRow[]>`
      insert into api_keys (project_id, name, key_prefix, key_hash, scopes, expires_at)
      values (${input.projectId}, ${input.name}, ${input.prefix}, ${input.hashedSecret},
        ${input.scopes}, ${input.expiresAt ?? null})
      returning id, project_id, name, key_prefix as prefix, key_hash as hashed_secret,
        scopes, created_at, last_used_at, expires_at, revoked_at
    `;
    return mapRow(requiredRow(rows));
  }

  async list(projectId: string): Promise<readonly ApiKeyRecord[]> {
    const rows = await this.database.sql<ApiKeyRow[]>`
      select id, project_id, name, key_prefix as prefix, key_hash as hashed_secret,
        scopes, created_at, last_used_at, expires_at, revoked_at
      from api_keys where project_id = ${projectId} order by created_at desc
    `;
    return rows.map(mapRow);
  }

  async findActiveByPrefix(prefix: string): Promise<readonly ApiKeyRecord[]> {
    const rows = await this.database.sql<ApiKeyRow[]>`
      select id, project_id, name, key_prefix as prefix, key_hash as hashed_secret,
        scopes, created_at, last_used_at, expires_at, revoked_at
      from api_keys where key_prefix = ${prefix} and revoked_at is null
    `;
    return rows.map(mapRow);
  }

  async revoke(id: string, projectId: string): Promise<ApiKeyRecord | undefined> {
    const rows = await this.database.sql<ApiKeyRow[]>`
      update api_keys set revoked_at = coalesce(revoked_at, now())
      where id = ${id} and project_id = ${projectId}
      returning id, project_id, name, key_prefix as prefix, key_hash as hashed_secret,
        scopes, created_at, last_used_at, expires_at, revoked_at
    `;
    return rows[0] === undefined ? undefined : mapRow(rows[0]);
  }

  async updateLastUsed(id: string, timestamp: string): Promise<void> {
    await this.database.sql`update api_keys set last_used_at = ${timestamp} where id = ${id}`;
  }

  async countForProject(projectId: string): Promise<number> {
    const rows = await this.database.sql<{ count: number }[]>`
      select count(*)::integer as count from api_keys where project_id = ${projectId}
    `;
    return rows[0]?.count ?? 0;
  }
}

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  readonly #records = new Map<string, ApiKeyRecord>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  create(input: NewApiKeyRecord): Promise<ApiKeyRecord> {
    const record: ApiKeyRecord = {
      id: randomUUID(),
      ...input,
      expiresAt: input.expiresAt ?? null,
      createdAt: this.now().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };
    this.#records.set(record.id, record);
    return Promise.resolve(record);
  }
  list(projectId: string): Promise<readonly ApiKeyRecord[]> {
    return Promise.resolve(
      [...this.#records.values()].filter((key) => key.projectId === projectId),
    );
  }
  findActiveByPrefix(prefix: string): Promise<readonly ApiKeyRecord[]> {
    return Promise.resolve(
      [...this.#records.values()].filter((key) => key.prefix === prefix && key.revokedAt === null),
    );
  }
  revoke(id: string, projectId: string): Promise<ApiKeyRecord | undefined> {
    const key = this.#records.get(id);
    if (key === undefined || key.projectId !== projectId) return Promise.resolve(undefined);
    const revoked = { ...key, revokedAt: key.revokedAt ?? this.now().toISOString() };
    this.#records.set(id, revoked);
    return Promise.resolve(revoked);
  }
  updateLastUsed(id: string, timestamp: string): Promise<void> {
    const key = this.#records.get(id);
    if (key !== undefined) this.#records.set(id, { ...key, lastUsedAt: timestamp });
    return Promise.resolve();
  }
  countForProject(projectId: string): Promise<number> {
    return Promise.resolve(
      [...this.#records.values()].filter((key) => key.projectId === projectId).length,
    );
  }
}

function mapRow(row: ApiKeyRow): ApiKeyRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}
function requiredRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('Database insert did not return a row');
  return row;
}

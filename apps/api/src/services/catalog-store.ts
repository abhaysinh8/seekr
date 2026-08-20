import { randomUUID } from 'node:crypto';

import type {
  AddDocumentApiRequest,
  CreateIndexApiRequest,
  CreateProjectApiRequest,
  IndexSchemaConfigurationApi,
} from '@seekr/shared';

import type { Database } from '../database/client.js';

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ManagedIndexRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly schema: IndexSchemaConfigurationApi;
  readonly status: 'ready' | 'indexing' | 'error';
  readonly lastIndexedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ManagedDocumentRecord extends AddDocumentApiRequest {
  readonly indexId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogStore {
  createProject(input: CreateProjectApiRequest): Promise<ProjectRecord>;
  createIndex(input: CreateIndexApiRequest): Promise<ManagedIndexRecord>;
  listIndexes(projectId?: string): Promise<readonly ManagedIndexRecord[]>;
  getIndex(id: string): Promise<ManagedIndexRecord | undefined>;
  deleteIndex(id: string): Promise<boolean>;
  updateIndexSchema(
    id: string,
    schema: IndexSchemaConfigurationApi,
  ): Promise<ManagedIndexRecord | undefined>;
  listDocuments(
    indexId: string,
    limit?: number,
    offset?: number,
  ): Promise<readonly ManagedDocumentRecord[]>;
  countDocuments(indexId: string): Promise<number>;
  upsertDocuments(indexId: string, documents: readonly AddDocumentApiRequest[]): Promise<void>;
  deleteDocument(indexId: string, documentId: string): Promise<boolean>;
}

interface DatedRow {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
type ProjectRow = Omit<ProjectRecord, 'createdAt' | 'updatedAt'> & DatedRow;
type IndexRow = Omit<ManagedIndexRecord, 'createdAt' | 'updatedAt' | 'lastIndexedAt'> &
  DatedRow & { readonly lastIndexedAt: Date | null };
type DocumentRow = Omit<ManagedDocumentRecord, 'createdAt' | 'updatedAt'> & DatedRow;

export class PostgresCatalogStore implements CatalogStore {
  constructor(private readonly database: Database) {}

  async createProject(input: CreateProjectApiRequest): Promise<ProjectRecord> {
    return this.database.sql.begin(async (transaction) => {
      const users = await transaction<{ id: string }[]>`
        insert into users (email) values (${input.ownerEmail.toLowerCase()})
        on conflict (email) do update set updated_at = now()
        returning id
      `;
      const owner = requiredRow(users);
      const rows = await transaction<ProjectRow[]>`
        insert into projects (owner_id, name, slug) values (${owner.id}, ${input.name}, ${input.slug})
        returning id, name, slug, created_at, updated_at
      `;
      return mapProject(requiredRow(rows));
    });
  }

  async createIndex(input: CreateIndexApiRequest): Promise<ManagedIndexRecord> {
    const rows = await this.database.sql<IndexRow[]>`
      insert into indexes (project_id, name, settings)
      values (${input.projectId}, ${input.name}, ${this.database.sql.json(input.schema)})
      returning id, project_id, name, settings as schema, status, last_indexed_at,
        created_at, updated_at
    `;
    return mapIndex(requiredRow(rows));
  }

  async listIndexes(projectId?: string): Promise<readonly ManagedIndexRecord[]> {
    const rows =
      projectId === undefined
        ? await this.database.sql<IndexRow[]>`
            select id, project_id, name, settings as schema, status, last_indexed_at,
              created_at, updated_at from indexes order by created_at desc
          `
        : await this.database.sql<IndexRow[]>`
            select id, project_id, name, settings as schema, status, last_indexed_at,
              created_at, updated_at from indexes where project_id = ${projectId}
            order by created_at desc
          `;
    return rows.map(mapIndex);
  }

  async getIndex(id: string): Promise<ManagedIndexRecord | undefined> {
    const rows = await this.database.sql<IndexRow[]>`
      select id, project_id, name, settings as schema, status, last_indexed_at,
        created_at, updated_at from indexes where id = ${id} limit 1
    `;
    return rows[0] === undefined ? undefined : mapIndex(rows[0]);
  }

  async deleteIndex(id: string): Promise<boolean> {
    const rows = await this.database.sql<{ id: string }[]>`
      delete from indexes where id = ${id} returning id
    `;
    return rows.length > 0;
  }

  async updateIndexSchema(
    id: string,
    schema: IndexSchemaConfigurationApi,
  ): Promise<ManagedIndexRecord | undefined> {
    const rows = await this.database.sql<IndexRow[]>`
      update indexes set settings = ${this.database.sql.json(schema)}, updated_at = now(),
        last_indexed_at = now(), status = 'ready'
      where id = ${id}
      returning id, project_id, name, settings as schema, status, last_indexed_at,
        created_at, updated_at
    `;
    return rows[0] === undefined ? undefined : mapIndex(rows[0]);
  }

  async listDocuments(
    indexId: string,
    limit = 100_000,
    offset = 0,
  ): Promise<readonly ManagedDocumentRecord[]> {
    const rows = await this.database.sql<DocumentRow[]>`
      select external_id as id, index_id, fields, metadata, created_at, updated_at
      from documents where index_id = ${indexId} order by created_at desc
      limit ${limit} offset ${offset}
    `;
    return rows.map(mapDocument);
  }

  async countDocuments(indexId: string): Promise<number> {
    const rows = await this.database.sql<{ count: number }[]>`
      select count(*)::integer as count from documents where index_id = ${indexId}
    `;
    return rows[0]?.count ?? 0;
  }

  async upsertDocuments(
    indexId: string,
    documents: readonly AddDocumentApiRequest[],
  ): Promise<void> {
    await this.database.sql.begin(async (transaction) => {
      for (const document of documents) {
        await transaction`
          insert into documents (index_id, external_id, fields, metadata)
          values (
            ${indexId}, ${document.id}, ${transaction.json(document.fields)},
            ${transaction.json(document.metadata)}
          )
          on conflict (index_id, external_id) do update
          set fields = excluded.fields, metadata = excluded.metadata, updated_at = now()
        `;
      }
      await transaction`update indexes set last_indexed_at = now() where id = ${indexId}`;
    });
  }

  async deleteDocument(indexId: string, documentId: string): Promise<boolean> {
    const rows = await this.database.sql<{ id: string }[]>`
      delete from documents where index_id = ${indexId} and external_id = ${documentId}
      returning id
    `;
    return rows.length > 0;
  }
}

export class InMemoryCatalogStore implements CatalogStore {
  readonly #projects = new Map<string, ProjectRecord>();
  readonly #indexes = new Map<string, ManagedIndexRecord>();
  readonly #documents = new Map<string, Map<string, ManagedDocumentRecord>>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  createProject(input: CreateProjectApiRequest): Promise<ProjectRecord> {
    const timestamp = this.now().toISOString();
    const project = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.#projects.set(project.id, project);
    return Promise.resolve(project);
  }

  createIndex(input: CreateIndexApiRequest): Promise<ManagedIndexRecord> {
    const timestamp = this.now().toISOString();
    const index: ManagedIndexRecord = {
      id: randomUUID(),
      projectId: input.projectId,
      name: input.name,
      schema: input.schema,
      status: 'ready',
      lastIndexedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.#indexes.set(index.id, index);
    this.#documents.set(index.id, new Map());
    return Promise.resolve(index);
  }

  listIndexes(projectId?: string): Promise<readonly ManagedIndexRecord[]> {
    return Promise.resolve(
      [...this.#indexes.values()].filter(
        (index) => projectId === undefined || index.projectId === projectId,
      ),
    );
  }

  getIndex(id: string): Promise<ManagedIndexRecord | undefined> {
    return Promise.resolve(this.#indexes.get(id));
  }

  deleteIndex(id: string): Promise<boolean> {
    this.#documents.delete(id);
    return Promise.resolve(this.#indexes.delete(id));
  }

  updateIndexSchema(
    id: string,
    schema: IndexSchemaConfigurationApi,
  ): Promise<ManagedIndexRecord | undefined> {
    const existing = this.#indexes.get(id);
    if (existing === undefined) return Promise.resolve(undefined);
    const updated = {
      ...existing,
      schema,
      lastIndexedAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    };
    this.#indexes.set(id, updated);
    return Promise.resolve(updated);
  }

  listDocuments(
    indexId: string,
    limit = 100_000,
    offset = 0,
  ): Promise<readonly ManagedDocumentRecord[]> {
    return Promise.resolve(
      [...(this.#documents.get(indexId)?.values() ?? [])].slice(offset, offset + limit),
    );
  }

  countDocuments(indexId: string): Promise<number> {
    return Promise.resolve(this.#documents.get(indexId)?.size ?? 0);
  }

  upsertDocuments(indexId: string, documents: readonly AddDocumentApiRequest[]): Promise<void> {
    const destination = this.#documents.get(indexId);
    if (destination === undefined)
      return Promise.reject(new Error(`Index ${indexId} does not exist`));
    const timestamp = this.now().toISOString();
    for (const document of documents) {
      destination.set(document.id, {
        ...document,
        indexId,
        createdAt: destination.get(document.id)?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
    }
    const index = this.#indexes.get(indexId);
    if (index !== undefined) this.#indexes.set(indexId, { ...index, lastIndexedAt: timestamp });
    return Promise.resolve();
  }

  deleteDocument(indexId: string, documentId: string): Promise<boolean> {
    return Promise.resolve(this.#documents.get(indexId)?.delete(documentId) ?? false);
  }
}

function mapProject(row: ProjectRow): ProjectRecord {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function mapIndex(row: IndexRow): ManagedIndexRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastIndexedAt: row.lastIndexedAt?.toISOString() ?? null,
  };
}
function mapDocument(row: DocumentRow): ManagedDocumentRecord {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function requiredRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('Database insert did not return a row');
  return row;
}

import type {
  AddDocumentApiRequest,
  CreateIndexApiRequest,
  CreateProjectApiRequest,
  IndexSchemaConfigurationApi,
} from '@seekr/shared';
import type { IndexConfiguration } from '@seekr/search-core';

import { HttpError } from '../errors/http-error.js';
import type { CatalogStore, ManagedIndexRecord } from './catalog-store.js';
import type { IndexService } from './index-service.js';
import type { RecommendationDocumentSink } from './recommendation-service.js';

export class IndexManagementService {
  constructor(
    private readonly store: CatalogStore,
    private readonly engine: IndexService,
    private readonly recommendations?: RecommendationDocumentSink,
  ) {}

  async initialize(): Promise<void> {
    for (const index of await this.store.listIndexes()) {
      this.engine.createIndex(index.id, toEngineConfiguration(index.schema));
      const documents = await this.store.listDocuments(index.id);
      this.engine.addDocuments(index.id, documents.map(toSearchDocument));
      this.recommendations?.setDocuments(index.id, documents, index.schema);
    }
  }

  createProject(input: CreateProjectApiRequest) {
    return this.store.createProject(input);
  }

  async createIndex(input: CreateIndexApiRequest) {
    const index = await this.store.createIndex(input);
    try {
      this.engine.createIndex(index.id, toEngineConfiguration(index.schema));
      this.recommendations?.setDocuments(index.id, [], index.schema);
      return this.summarize(index);
    } catch (error) {
      await this.store.deleteIndex(index.id);
      throw error;
    }
  }

  async listIndexes(projectId?: string) {
    return (await this.store.listIndexes(projectId)).map((index) => this.summarize(index));
  }

  async getIndex(indexId: string) {
    const index = await this.requiredIndex(indexId);
    return this.summarize(index);
  }

  async getProjectId(indexId: string): Promise<string> {
    return (await this.requiredIndex(indexId)).projectId;
  }

  async deleteIndex(indexId: string): Promise<void> {
    if (!(await this.store.deleteIndex(indexId))) throw notFound('Index', indexId);
    this.engine.deleteIndex(indexId);
    this.recommendations?.deleteIndex(indexId);
  }

  async updateSchema(indexId: string, schema: IndexSchemaConfigurationApi) {
    await this.requiredIndex(indexId);
    const documents = await this.store.listDocuments(indexId);
    for (const document of documents) validateDocument(schema, document);
    const updated = await this.store.updateIndexSchema(indexId, schema);
    if (updated === undefined) throw notFound('Index', indexId);
    this.engine.deleteIndex(indexId);
    this.engine.createIndex(indexId, toEngineConfiguration(schema));
    this.engine.addDocuments(indexId, documents.map(toSearchDocument));
    this.recommendations?.setDocuments(indexId, documents, schema);
    return {
      index: this.summarize(updated),
      reindexRequired: documents.length > 0,
      reindexedDocuments: documents.length,
    };
  }

  async reindex(indexId: string) {
    const index = await this.requiredIndex(indexId);
    const documents = await this.store.listDocuments(indexId);
    this.engine.deleteIndex(indexId);
    this.engine.createIndex(indexId, toEngineConfiguration(index.schema));
    this.engine.addDocuments(indexId, documents.map(toSearchDocument));
    this.recommendations?.setDocuments(indexId, documents, index.schema);
    return { reindexedDocuments: documents.length };
  }

  async exportIndex(indexId: string) {
    const index = await this.requiredIndex(indexId);
    return { index: this.summarize(index), documents: await this.store.listDocuments(indexId) };
  }

  async restoreIndex(
    indexId: string,
    schema: IndexSchemaConfigurationApi,
    documents: readonly AddDocumentApiRequest[],
  ): Promise<void> {
    await this.requiredIndex(indexId);
    for (const document of documents) validateDocument(schema, document);
    const existing = await this.store.listDocuments(indexId);
    for (const document of existing) await this.store.deleteDocument(indexId, document.id);
    const updated = await this.store.updateIndexSchema(indexId, schema);
    if (updated === undefined) throw notFound('Index', indexId);
    if (documents.length > 0) await this.store.upsertDocuments(indexId, documents);
    this.engine.deleteIndex(indexId);
    this.engine.createIndex(indexId, toEngineConfiguration(schema));
    this.engine.addDocuments(indexId, documents.map(toSearchDocument));
    this.recommendations?.setDocuments(indexId, documents, schema);
  }

  async updateSynonyms(
    indexId: string,
    synonyms: IndexSchemaConfigurationApi['synonyms'],
    synonymPenalty: number,
  ) {
    const index = await this.requiredIndex(indexId);
    return this.updateSchema(indexId, { ...index.schema, synonyms, synonymPenalty });
  }

  async listDocuments(indexId: string, limit: number, offset: number) {
    await this.requiredIndex(indexId);
    const [documents, total] = await Promise.all([
      this.store.listDocuments(indexId, limit, offset),
      this.store.countDocuments(indexId),
    ]);
    return { documents, total, limit, offset };
  }

  async getDocument(indexId: string, documentId: string) {
    await this.requiredIndex(indexId);
    const document = await this.store.getDocument(indexId, documentId);
    if (document === undefined) throw notFound('Document', documentId);
    return document;
  }

  async addDocuments(indexId: string, documents: readonly AddDocumentApiRequest[]) {
    const index = await this.requiredIndex(indexId);
    for (const document of documents) validateDocument(index.schema, document);
    await this.store.upsertDocuments(indexId, documents);
    this.engine.addDocuments(indexId, documents.map(toSearchDocument));
    this.recommendations?.upsertDocuments(indexId, documents, index.schema);
    return { indexed: documents.length };
  }

  async deleteDocument(indexId: string, documentId: string): Promise<void> {
    await this.requiredIndex(indexId);
    if (!(await this.store.deleteDocument(indexId, documentId)))
      throw notFound('Document', documentId);
    this.engine.removeDocument(indexId, documentId);
    this.recommendations?.removeDocument(indexId, documentId);
  }

  private summarize(index: ManagedIndexRecord) {
    const statistics = this.engine.getStatistics(index.id);
    return {
      ...index,
      documentCount: statistics.documentCount,
      termCount: statistics.vocabularySize,
      storageSizeBytes: null,
    };
  }

  private async requiredIndex(indexId: string): Promise<ManagedIndexRecord> {
    const index = await this.store.getIndex(indexId);
    if (index === undefined) throw notFound('Index', indexId);
    return index;
  }
}

export function toEngineConfiguration(schema: IndexSchemaConfigurationApi): IndexConfiguration {
  return {
    fields: Object.fromEntries(
      Object.entries(schema.fields).map(([name, field]) => [
        name,
        {
          searchable: field.searchable,
          filterable: field.filterable,
          facetable: field.facetable,
          sortable: field.sortable,
          weight: field.weight,
        },
      ]),
    ),
    synonyms: schema.synonyms,
    synonymPenalty: schema.synonymPenalty,
    rankingRules: schema.rankingRules.map((rule) =>
      'condition' in rule
        ? {
            field: rule.field,
            condition: rule.condition,
            boost: rule.boost,
            ...(rule.value === undefined ? {} : { value: rule.value }),
          }
        : {
            field: rule.field,
            strategy: rule.strategy,
            halfLifeDays: rule.halfLifeDays,
            weight: rule.weight,
          },
    ),
  };
}

function toSearchDocument(document: AddDocumentApiRequest) {
  return { id: document.id, fields: document.fields, metadata: document.metadata };
}

function validateDocument(
  schema: IndexSchemaConfigurationApi,
  document: AddDocumentApiRequest,
): void {
  for (const [name, value] of Object.entries(document.fields)) {
    const field = schema.fields[name];
    if (field === undefined)
      throw new HttpError(400, 'UNKNOWN_FIELD', `Field ${name} is not defined in the index schema`);
    validateFieldValue(name, field.type, value);
  }
  for (const [name, value] of Object.entries(document.metadata)) {
    const field = schema.fields[name];
    if (field !== undefined) validateFieldValue(name, field.type, value);
  }
}

function validateFieldValue(
  name: string,
  type: IndexSchemaConfigurationApi['fields'][string]['type'],
  value: AddDocumentApiRequest['fields'][string],
): void {
  const values = Array.isArray(value) ? value : [value];
  for (const entry of values) {
    if (entry === null) continue;
    const valid =
      (type === 'number' && typeof entry === 'number') ||
      (type === 'boolean' && typeof entry === 'boolean') ||
      ((type === 'text' || type === 'string' || type === 'date') && typeof entry === 'string');
    if (!valid)
      throw new HttpError(400, 'FIELD_TYPE_MISMATCH', `Field ${name} must contain ${type} values`);
  }
}

function notFound(entity: string, id: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', `${entity} ${id} was not found`);
}

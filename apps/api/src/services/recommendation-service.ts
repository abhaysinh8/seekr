import {
  ContentBasedRecommender,
  DEFAULT_INTERACTION_WEIGHTS,
  HybridRecommender,
  InteractionStore,
  ItemItemCollaborativeRecommender,
  type ContentItem,
} from '@seekr/recommendation-core';
import type {
  AddDocumentApiRequest,
  IndexSchemaConfigurationApi,
  RecordInteractionApiRequest,
} from '@seekr/shared';

import { HttpError } from '../errors/http-error.js';
import type { InteractionRepository } from './interaction-repository.js';

interface RecommendationState {
  readonly items: Map<string, ContentItem>;
  readonly interactions: InteractionStore;
  readonly content: ContentBasedRecommender;
  readonly collaborative: ItemItemCollaborativeRecommender;
  readonly hybrid: HybridRecommender;
}

export interface RecommendationDocumentSink {
  setDocuments(
    indexId: string,
    documents: readonly AddDocumentApiRequest[],
    schema: IndexSchemaConfigurationApi,
  ): void;
  upsertDocuments(
    indexId: string,
    documents: readonly AddDocumentApiRequest[],
    schema: IndexSchemaConfigurationApi,
  ): void;
  removeDocument(indexId: string, documentId: string): void;
  deleteIndex(indexId: string): void;
}

export class RecommendationService implements RecommendationDocumentSink {
  readonly #states = new Map<string, RecommendationState>();
  constructor(private readonly repository: InteractionRepository) {}

  async loadInteractions(indexId: string): Promise<void> {
    const state = this.#requiredState(indexId);
    for (const interaction of await this.repository.list(indexId)) {
      state.collaborative.recordInteraction({
        userId: interaction.userId,
        itemId: interaction.itemId,
        type: interaction.type,
        ...(interaction.weight === undefined ? {} : { weight: interaction.weight }),
        occurredAt: new Date(interaction.occurredAt),
      });
    }
  }

  setDocuments(
    indexId: string,
    documents: readonly AddDocumentApiRequest[],
    schema: IndexSchemaConfigurationApi,
  ): void {
    const existing = this.#states.get(indexId);
    const interactions = existing?.interactions ?? new InteractionStore();
    const items = new Map(
      documents.map((document) => [document.id, toContentItem(document, schema)]),
    );
    const content = new ContentBasedRecommender([...items.values()], interactions);
    const collaborative =
      existing?.collaborative ?? new ItemItemCollaborativeRecommender(interactions);
    this.#states.set(indexId, {
      items,
      interactions,
      content,
      collaborative,
      hybrid: new HybridRecommender(interactions, content, collaborative),
    });
  }

  upsertDocuments(
    indexId: string,
    documents: readonly AddDocumentApiRequest[],
    schema: IndexSchemaConfigurationApi,
  ): void {
    const state = this.#states.get(indexId);
    if (state === undefined) {
      this.setDocuments(indexId, documents, schema);
      return;
    }
    for (const document of documents) state.items.set(document.id, toContentItem(document, schema));
    state.content.buildIndex([...state.items.values()]);
  }

  removeDocument(indexId: string, documentId: string): void {
    const state = this.#states.get(indexId);
    if (state === undefined) return;
    state.items.delete(documentId);
    state.content.buildIndex([...state.items.values()]);
  }

  deleteIndex(indexId: string): void {
    this.#states.delete(indexId);
  }

  async recordInteraction(input: RecordInteractionApiRequest): Promise<void> {
    const state = this.#requiredState(input.indexId);
    if (!state.items.has(input.itemId)) {
      throw new HttpError(
        404,
        'ITEM_NOT_FOUND',
        `Item ${input.itemId} is not in index ${input.indexId}`,
      );
    }
    const weight = input.weight ?? DEFAULT_INTERACTION_WEIGHTS[input.type];
    await this.repository.record({ ...input, weight });
    state.collaborative.recordInteraction({
      userId: input.userId,
      itemId: input.itemId,
      type: input.type,
      weight,
      ...(input.occurredAt === undefined ? {} : { occurredAt: new Date(input.occurredAt) }),
    });
  }

  recommendItems(indexId: string, itemId: string, limit: number) {
    const state = this.#requiredState(indexId);
    if (!state.items.has(itemId))
      throw new HttpError(404, 'ITEM_NOT_FOUND', `Item ${itemId} is not in index ${indexId}`);
    return state.hybrid.recommendItems(itemId, limit);
  }

  recommendForUser(indexId: string, userId: string, limit: number, explain: boolean) {
    return this.#requiredState(indexId).hybrid.recommendForUser(userId, { limit, explain });
  }

  getPopularItems(indexId: string, limit: number) {
    return this.#requiredState(indexId).interactions.getPopularItems({ limit });
  }

  getStatistics(indexId: string) {
    return this.#requiredState(indexId).interactions.getInteractionStatistics();
  }

  #requiredState(indexId: string): RecommendationState {
    const state = this.#states.get(indexId);
    if (state === undefined)
      throw new HttpError(404, 'INDEX_NOT_FOUND', `Index ${indexId} does not exist`);
    return state;
  }
}

function toContentItem(
  document: AddDocumentApiRequest,
  schema: IndexSchemaConfigurationApi,
): ContentItem {
  const fields: Record<string, string | readonly string[]> = {};
  for (const [name, configuration] of Object.entries(schema.fields)) {
    if (!configuration.searchable) continue;
    const value = document.fields[name];
    if (typeof value === 'string') fields[name] = value;
    else if (Array.isArray(value)) {
      const strings = value.filter((entry): entry is string => typeof entry === 'string');
      if (strings.length > 0) fields[name] = strings;
    }
  }
  return { id: document.id, fields };
}

import type { RecordInteractionApiRequest } from '@seekr/shared';
import type { Database } from '../database/client.js';

export interface StoredInteraction extends Omit<
  RecordInteractionApiRequest,
  'occurredAt' | 'weight'
> {
  readonly occurredAt: string;
  readonly weight: number | undefined;
}
export interface InteractionRepository {
  record(input: RecordInteractionApiRequest): Promise<void>;
  list(indexId: string): Promise<readonly StoredInteraction[]>;
}

interface InteractionRow {
  readonly indexId: string;
  readonly userId: string;
  readonly itemId: string;
  readonly type: StoredInteraction['type'];
  readonly weight: number;
  readonly occurredAt: Date;
}

export class PostgresInteractionRepository implements InteractionRepository {
  constructor(private readonly database: Database) {}
  async record(input: RecordInteractionApiRequest): Promise<void> {
    await this.database.sql`
      insert into interactions (
        project_id, index_id, external_user_id, external_item_id,
        interaction_type, weight, occurred_at
      )
      select project_id, id, ${input.userId}, ${input.itemId}, ${input.type},
        ${input.weight ?? 1}, ${input.occurredAt ?? new Date().toISOString()}
      from indexes where id = ${input.indexId}
    `;
  }
  async list(indexId: string): Promise<readonly StoredInteraction[]> {
    const rows = await this.database.sql<InteractionRow[]>`
      select index_id, external_user_id as user_id, external_item_id as item_id,
        interaction_type as type, weight, occurred_at
      from interactions where index_id = ${indexId} order by occurred_at asc
    `;
    return rows.map((row) => ({
      indexId: row.indexId,
      userId: row.userId,
      itemId: row.itemId,
      type: row.type,
      weight: row.weight,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }
}

export class InMemoryInteractionRepository implements InteractionRepository {
  readonly #records: StoredInteraction[] = [];
  record(input: RecordInteractionApiRequest): Promise<void> {
    this.#records.push({
      ...input,
      weight: input.weight,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    });
    return Promise.resolve();
  }
  list(indexId: string): Promise<readonly StoredInteraction[]> {
    return Promise.resolve(this.#records.filter((record) => record.indexId === indexId));
  }
}

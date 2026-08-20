import { randomUUID } from 'node:crypto';

import type { ClickEventApiRequest, SearchApiRequest } from '@seekr/shared';

import type { Database } from '../database/client.js';

export interface NewSearchRecord {
  readonly indexId: string;
  readonly normalizedQuery: string;
  readonly processingTimeMs: number;
  readonly resultCount: number;
  readonly filters: SearchApiRequest['filters'];
  readonly sessionHash: string | null;
  readonly impressions: ReadonlyArray<{ readonly documentId: string; readonly position: number }>;
}
export interface SearchAnalyticsRecord extends Omit<NewSearchRecord, 'impressions'> {
  readonly id: string;
  readonly impressionCount: number;
  readonly createdAt: string;
}
export interface ClickAnalyticsRecord {
  readonly searchId: string;
  readonly indexId: string;
  readonly normalizedQuery: string;
  readonly documentId: string;
  readonly position: number;
  readonly createdAt: string;
}
export interface AnalyticsRepository {
  recordSearch(input: NewSearchRecord): Promise<string>;
  recordClick(input: ClickEventApiRequest): Promise<boolean>;
  listSearches(
    indexId: string,
    start: string,
    end: string,
  ): Promise<readonly SearchAnalyticsRecord[]>;
  listClicks(indexId: string, start: string, end: string): Promise<readonly ClickAnalyticsRecord[]>;
}

interface SearchRow extends Omit<SearchAnalyticsRecord, 'createdAt'> {
  readonly createdAt: Date;
}
interface ClickRow extends Omit<ClickAnalyticsRecord, 'createdAt'> {
  readonly createdAt: Date;
}

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly database: Database) {}

  async recordSearch(input: NewSearchRecord): Promise<string> {
    return this.database.sql.begin(async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        insert into search_queries (index_id, query, result_count, duration_ms, filters, session_hash)
        values (${input.indexId}, ${input.normalizedQuery}, ${input.resultCount},
          ${Math.max(0, Math.round(input.processingTimeMs))}, ${transaction.json(input.filters)},
          ${input.sessionHash}) returning id
      `;
      const id = requiredRow(rows).id;
      for (const impression of input.impressions) {
        await transaction`
          insert into search_impressions (search_id, external_document_id, result_position)
          values (${id}, ${impression.documentId}, ${impression.position})
        `;
      }
      return id;
    });
  }

  async recordClick(input: ClickEventApiRequest): Promise<boolean> {
    const impressions = await this.database.sql<{ exists: boolean }[]>`
      select exists(
        select 1 from search_impressions where search_id = ${input.searchId}
          and external_document_id = ${input.documentId} and result_position = ${input.position}
      ) as exists
    `;
    if (!impressions[0]?.exists) return false;
    const rows = await this.database.sql<{ id: string }[]>`
      insert into search_events (query_id, event_type, external_document_id, result_position)
      values (${input.searchId}, 'click', ${input.documentId}, ${input.position})
      returning id
    `;
    return rows.length > 0;
  }

  async listSearches(
    indexId: string,
    start: string,
    end: string,
  ): Promise<readonly SearchAnalyticsRecord[]> {
    const rows = await this.database.sql<SearchRow[]>`
      select q.id, q.index_id, q.query as normalized_query, q.duration_ms as processing_time_ms,
        q.result_count, q.filters, q.session_hash, q.searched_at as created_at,
        count(i.search_id)::integer as impression_count
      from search_queries q left join search_impressions i on i.search_id = q.id
      where q.index_id = ${indexId} and q.searched_at >= ${start} and q.searched_at <= ${end}
      group by q.id order by q.searched_at asc
    `;
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }

  async listClicks(
    indexId: string,
    start: string,
    end: string,
  ): Promise<readonly ClickAnalyticsRecord[]> {
    const rows = await this.database.sql<ClickRow[]>`
      select e.query_id as search_id, q.index_id, q.query as normalized_query,
        e.external_document_id as document_id, e.result_position as position,
        e.created_at
      from search_events e join search_queries q on q.id = e.query_id
      where q.index_id = ${indexId} and e.event_type = 'click'
        and e.created_at >= ${start} and e.created_at <= ${end}
      order by e.created_at asc
    `;
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }
}

export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  readonly #searches = new Map<
    string,
    SearchAnalyticsRecord & { readonly impressions: NewSearchRecord['impressions'] }
  >();
  readonly #clicks: ClickAnalyticsRecord[] = [];
  constructor(private readonly now: () => Date = () => new Date()) {}
  recordSearch(input: NewSearchRecord): Promise<string> {
    const id = randomUUID();
    this.#searches.set(id, {
      ...input,
      id,
      impressionCount: input.impressions.length,
      createdAt: this.now().toISOString(),
    });
    return Promise.resolve(id);
  }
  recordClick(input: ClickEventApiRequest): Promise<boolean> {
    const search = this.#searches.get(input.searchId);
    if (
      search === undefined ||
      !search.impressions.some(
        (impression) =>
          impression.documentId === input.documentId && impression.position === input.position,
      )
    )
      return Promise.resolve(false);
    this.#clicks.push({
      searchId: input.searchId,
      indexId: search.indexId,
      normalizedQuery: search.normalizedQuery,
      documentId: input.documentId,
      position: input.position,
      createdAt: this.now().toISOString(),
    });
    return Promise.resolve(true);
  }
  listSearches(
    indexId: string,
    start: string,
    end: string,
  ): Promise<readonly SearchAnalyticsRecord[]> {
    return Promise.resolve(
      [...this.#searches.values()].filter((record) => inRange(record, indexId, start, end)),
    );
  }
  listClicks(
    indexId: string,
    start: string,
    end: string,
  ): Promise<readonly ClickAnalyticsRecord[]> {
    return Promise.resolve(this.#clicks.filter((record) => inRange(record, indexId, start, end)));
  }
}

function inRange(
  record: { indexId: string; createdAt: string },
  indexId: string,
  start: string,
  end: string,
): boolean {
  return record.indexId === indexId && record.createdAt >= start && record.createdAt <= end;
}
function requiredRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('Database insert did not return a row');
  return row;
}

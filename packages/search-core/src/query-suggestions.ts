import { tokenize } from '@seekr/tokenizer';
import { Trie } from './trie.js';

interface QuerySignals {
  frequency: number;
  clicks: number;
  impressions: number;
  lastSeenAt: number;
}
export interface QuerySuggestion {
  readonly value: string;
  readonly score: number;
  readonly frequency: number;
  readonly ctr: number;
  readonly type: 'query';
}
export interface SuggestionResponse {
  readonly querySuggestions: readonly QuerySuggestion[];
  readonly termSuggestions: readonly string[];
}
export interface QuerySuggestionOptions {
  readonly limit?: number;
  readonly now?: Date;
  readonly halfLifeMs?: number;
  readonly termSuggestions?: readonly string[];
}

export class QuerySuggestionIndex {
  readonly #trie = new Trie();
  readonly #signals = new Map<string, QuerySignals>();
  readonly #searchQueries = new Map<string, string>();

  recordSearch(
    searchId: string,
    query: string,
    resultCount: number,
    impressions: number,
    occurredAt = new Date(),
  ): void {
    const normalized = normalizeQuery(query);
    if (normalized.length === 0) return;
    this.#searchQueries.set(searchId, normalized);
    if (resultCount <= 0) return;
    const current = this.#signals.get(normalized) ?? {
      frequency: 0,
      clicks: 0,
      impressions: 0,
      lastSeenAt: 0,
    };
    current.frequency += 1;
    current.impressions += impressions;
    current.lastSeenAt = Math.max(current.lastSeenAt, occurredAt.getTime());
    this.#signals.set(normalized, current);
    this.#trie.insert(normalized);
  }

  recordClick(searchId: string): boolean {
    const query = this.#searchQueries.get(searchId);
    if (query === undefined) return false;
    const signals = this.#signals.get(query);
    if (signals === undefined) return false;
    signals.clicks += 1;
    return true;
  }

  suggest(prefix: string, options: QuerySuggestionOptions = {}): SuggestionResponse {
    const normalizedPrefix = normalizeQuery(prefix);
    const limit = options.limit ?? 10;
    const now = options.now?.getTime() ?? Date.now();
    const halfLife = options.halfLifeMs ?? 30 * 24 * 60 * 60_000;
    const querySuggestions = this.#trie
      .suggest(normalizedPrefix, limit, (query) =>
        this.#score(query, normalizedPrefix, now, halfLife),
      )
      .map((value) => {
        const signals = this.#signals.get(value) ?? {
          frequency: 0,
          clicks: 0,
          impressions: 0,
          lastSeenAt: 0,
        };
        return {
          value,
          score: this.#score(value, normalizedPrefix, now, halfLife),
          frequency: signals.frequency,
          ctr: signals.impressions === 0 ? 0 : signals.clicks / signals.impressions,
          type: 'query' as const,
        };
      });
    return { querySuggestions, termSuggestions: (options.termSuggestions ?? []).slice(0, limit) };
  }

  #score(query: string, prefix: string, now: number, halfLife: number): number {
    const signals = this.#signals.get(query);
    if (signals === undefined) return 0;
    const age = Math.max(0, now - signals.lastSeenAt);
    const decay = halfLife <= 0 ? 0 : 2 ** (-age / halfLife);
    const ctr = signals.impressions === 0 ? 0 : signals.clicks / signals.impressions;
    return Math.log1p(signals.frequency) * decay + ctr * 2 + (query === prefix ? 0.5 : 0);
  }
}

function normalizeQuery(query: string): string {
  return tokenize(query).join(' ');
}

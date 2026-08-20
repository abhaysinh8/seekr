import { createHash } from 'node:crypto';

import type { AnalyticsRangeQuery, ClickEventApiRequest } from '@seekr/shared';
import { tokenize } from '@seekr/tokenizer';

import { HttpError } from '../errors/http-error.js';
import type { AnalyticsRepository, NewSearchRecord } from './analytics-repository.js';

export class AnalyticsService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  recordSearch(
    input: Omit<NewSearchRecord, 'normalizedQuery' | 'sessionHash'> & {
      query: string;
      sessionId?: string;
    },
  ) {
    return this.repository.recordSearch({
      ...input,
      normalizedQuery: tokenize(input.query).join(' '),
      sessionHash:
        input.sessionId === undefined
          ? null
          : createHash('sha256').update(input.sessionId).digest('hex'),
    });
  }

  async recordClick(input: ClickEventApiRequest): Promise<void> {
    if (!(await this.repository.recordClick(input))) {
      throw new HttpError(
        400,
        'INVALID_CLICK',
        'The document and position were not an impression for this search',
      );
    }
  }

  async overview(indexId: string, query: AnalyticsRangeQuery) {
    const range = this.resolveRange(query);
    const searches = await this.repository.listSearches(indexId, range.start, range.end);
    const durations = searches.map((search) => search.processingTimeMs).sort((a, b) => a - b);
    const zeroResults = searches.filter((search) => search.resultCount === 0).length;
    const volume = new Map<string, number>();
    for (const search of searches) {
      const day = search.createdAt.slice(0, 10);
      volume.set(day, (volume.get(day) ?? 0) + 1);
    }
    return {
      range,
      totalSearches: searches.length,
      uniqueQueries: new Set(searches.map((search) => search.normalizedQuery)).size,
      averageLatencyMs: average(durations),
      latency: {
        p50: percentile(durations, 0.5),
        p95: percentile(durations, 0.95),
        p99: percentile(durations, 0.99),
      },
      zeroResultSearches: zeroResults,
      zeroResultRate: searches.length === 0 ? 0 : zeroResults / searches.length,
      volume: [...volume].map(([date, count]) => ({ date, count })),
    };
  }

  async queries(indexId: string, query: AnalyticsRangeQuery) {
    const range = this.resolveRange(query);
    const [searches, clicks] = await Promise.all([
      this.repository.listSearches(indexId, range.start, range.end),
      this.repository.listClicks(indexId, range.start, range.end),
    ]);
    const grouped = new Map<
      string,
      {
        searches: number;
        results: number;
        zero: number;
        latency: number;
        impressions: number;
        clicks: number;
      }
    >();
    for (const search of searches) {
      const group = grouped.get(search.normalizedQuery) ?? {
        searches: 0,
        results: 0,
        zero: 0,
        latency: 0,
        impressions: 0,
        clicks: 0,
      };
      group.searches += 1;
      group.results += search.resultCount;
      group.latency += search.processingTimeMs;
      group.impressions += search.impressionCount;
      if (search.resultCount === 0) group.zero += 1;
      grouped.set(search.normalizedQuery, group);
    }
    for (const click of clicks) {
      const group = grouped.get(click.normalizedQuery);
      if (group !== undefined) group.clicks += 1;
    }
    return {
      range,
      queries: [...grouped]
        .map(([normalizedQuery, value]) => ({
          normalizedQuery,
          searchCount: value.searches,
          averageResultCount: value.results / value.searches,
          averageLatencyMs: value.latency / value.searches,
          zeroResultRate: value.zero / value.searches,
          impressions: value.impressions,
          clicks: value.clicks,
          ctr: value.impressions === 0 ? 0 : value.clicks / value.impressions,
        }))
        .sort(
          (a, b) =>
            b.searchCount - a.searchCount || a.normalizedQuery.localeCompare(b.normalizedQuery),
        )
        .slice(0, query.limit),
    };
  }

  async noResults(indexId: string, query: AnalyticsRangeQuery) {
    const result = await this.queries(indexId, { ...query, limit: 100 });
    return {
      range: result.range,
      queries: result.queries
        .filter((entry) => entry.zeroResultRate > 0)
        .sort((a, b) => b.zeroResultRate - a.zeroResultRate || b.searchCount - a.searchCount)
        .slice(0, query.limit),
    };
  }

  async latency(indexId: string, query: AnalyticsRangeQuery) {
    const range = this.resolveRange(query);
    const values = (await this.repository.listSearches(indexId, range.start, range.end))
      .map((search) => search.processingTimeMs)
      .sort((a, b) => a - b);
    return {
      range,
      count: values.length,
      averageMs: average(values),
      minimumMs: values[0] ?? 0,
      maximumMs: values.at(-1) ?? 0,
      p50Ms: percentile(values, 0.5),
      p95Ms: percentile(values, 0.95),
      p99Ms: percentile(values, 0.99),
    };
  }

  async clicks(indexId: string, query: AnalyticsRangeQuery) {
    const range = this.resolveRange(query);
    const [searches, clicks] = await Promise.all([
      this.repository.listSearches(indexId, range.start, range.end),
      this.repository.listClicks(indexId, range.start, range.end),
    ]);
    const impressions = searches.reduce((total, search) => total + search.impressionCount, 0);
    const documents = new Map<string, number>();
    for (const click of clicks)
      documents.set(click.documentId, (documents.get(click.documentId) ?? 0) + 1);
    return {
      range,
      impressions,
      clicks: clicks.length,
      ctr: impressions === 0 ? 0 : clicks.length / impressions,
      averageClickedPosition: average(clicks.map((click) => click.position)),
      mostClickedDocuments: [...documents]
        .map(([documentId, count]) => ({ documentId, clicks: count }))
        .sort((a, b) => b.clicks - a.clicks || a.documentId.localeCompare(b.documentId))
        .slice(0, query.limit),
    };
  }

  private resolveRange(query: AnalyticsRangeQuery) {
    const end = query.end ?? this.now().toISOString();
    const start =
      query.start ?? new Date(new Date(end).getTime() - 30 * 24 * 60 * 60_000).toISOString();
    if (start > end)
      throw new HttpError(400, 'INVALID_DATE_RANGE', 'start must be before or equal to end');
    return { start, end };
  }
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
function percentile(sorted: readonly number[], quantile: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

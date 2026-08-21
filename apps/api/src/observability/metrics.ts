import type { FastifyRequest } from 'fastify';
import type { IndexManagementService } from '../services/index-management.js';

interface Counter {
  count: number;
  durationSeconds: number;
}
export class MetricsRegistry {
  readonly #started = new WeakMap<FastifyRequest, bigint>();
  readonly #http = new Map<string, Counter>();
  #searchQueries = 0;
  #autocompleteQueries = 0;

  start(request: FastifyRequest): void {
    this.#started.set(request, process.hrtime.bigint());
  }
  complete(request: FastifyRequest, statusCode: number): void {
    const start = this.#started.get(request);
    if (start === undefined) return;
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = request.routeOptions.url ?? 'unmatched';
    const key = JSON.stringify([request.method, route, statusCode]);
    const counter = this.#http.get(key) ?? { count: 0, durationSeconds: 0 };
    counter.count += 1;
    counter.durationSeconds += seconds;
    this.#http.set(key, counter);
    if (route.endsWith('/search')) this.#searchQueries += 1;
    if (route.endsWith('/autocomplete')) this.#autocompleteQueries += 1;
  }

  async render(indexes: IndexManagementService): Promise<string> {
    const lines = [
      '# HELP seekr_http_requests_total Total completed HTTP requests.',
      '# TYPE seekr_http_requests_total counter',
    ];
    for (const [key, value] of this.#http) {
      const [method, route, status] = JSON.parse(key) as [string, string, number];
      const labels = `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}"`;
      lines.push(`seekr_http_requests_total{${labels}} ${value.count}`);
      lines.push(`seekr_http_request_duration_seconds_sum{${labels}} ${value.durationSeconds}`);
      lines.push(`seekr_http_request_duration_seconds_count{${labels}} ${value.count}`);
    }
    lines.push(
      '# HELP seekr_search_queries_total Ranked search requests.',
      '# TYPE seekr_search_queries_total counter',
      `seekr_search_queries_total ${this.#searchQueries}`,
    );
    lines.push(
      '# HELP seekr_autocomplete_queries_total Autocomplete requests.',
      '# TYPE seekr_autocomplete_queries_total counter',
      `seekr_autocomplete_queries_total ${this.#autocompleteQueries}`,
    );
    lines.push(
      '# HELP seekr_index_documents Number of documents in each index.',
      '# TYPE seekr_index_documents gauge',
    );
    for (const index of await indexes.listIndexes())
      lines.push(
        `seekr_index_documents{index_id="${escapeLabel(index.id)}",index_name="${escapeLabel(index.name)}"} ${index.documentCount}`,
      );
    lines.push(
      '# HELP process_resident_memory_bytes Resident memory used by the API process.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${process.memoryUsage().rss}`,
    );
    return `${lines.join('\n')}\n`;
  }
}

const escapeLabel = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');

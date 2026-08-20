import { performance } from 'node:perf_hooks';

import type { FastifyPluginCallback } from 'fastify';

import type {
  HighlightOptions,
  FieldValue,
  SearchFilter,
  SearchOptions,
  TypoToleranceOptions,
} from '@seekr/search-core';
import {
  autocompleteRequestSchema,
  indexIdParametersSchema,
  searchRequestSchema,
} from '@seekr/shared';

import type { IndexSearchService } from '../services/index-service.js';
import type { AnalyticsService } from '../services/analytics-service.js';
import type { SearchResponseCache } from '../cache/search-cache.js';
import { parseRequest } from './validation.js';

interface SearchRouteOptions {
  readonly indexes: IndexSearchService;
  readonly analytics: AnalyticsService;
  readonly cache: SearchResponseCache;
}

const cleanFilters = (
  filters: ReadonlyArray<{
    readonly field: string;
    readonly operator: SearchFilter['operator'];
    readonly value?: FieldValue | undefined;
  }>,
): SearchFilter[] =>
  filters.map((filter) => ({
    field: filter.field,
    operator: filter.operator,
    ...(filter.value === undefined ? {} : { value: filter.value }),
  }));

const cleanTypoTolerance = (
  value:
    | boolean
    | { readonly maxDistance?: number | undefined; readonly prefixLength?: number | undefined },
): boolean | TypoToleranceOptions =>
  typeof value === 'boolean'
    ? value
    : {
        ...(value.maxDistance === undefined ? {} : { maxDistance: value.maxDistance }),
        ...(value.prefixLength === undefined ? {} : { prefixLength: value.prefixLength }),
      };

const cleanHighlight = (
  value:
    | boolean
    | {
        readonly fields?: readonly string[] | undefined;
        readonly preTag?: string | undefined;
        readonly postTag?: string | undefined;
      },
): boolean | HighlightOptions =>
  typeof value === 'boolean'
    ? value
    : {
        ...(value.fields === undefined ? {} : { fields: value.fields }),
        ...(value.preTag === undefined ? {} : { preTag: value.preTag }),
        ...(value.postTag === undefined ? {} : { postTag: value.postTag }),
      };

export const searchRoutes: FastifyPluginCallback<SearchRouteOptions> = (app, options, done) => {
  app.post('/v1/indexes/:indexId/search', async (request) => {
    const { indexId } = parseRequest(indexIdParametersSchema, request.params, 'path parameters');
    const body = parseRequest(searchRequestSchema, request.body, 'search request');
    const startedAt = performance.now();
    const searchOptions: SearchOptions = {
      limit: body.limit,
      offset: body.offset,
      ranking: body.ranking,
      filters: cleanFilters(body.filters),
      facets: body.facets,
      typoTolerance: cleanTypoTolerance(body.typoTolerance),
      highlights: cleanHighlight(body.highlight),
      explain: body.explain,
      proximityBoost: body.proximityBoost,
      ...(body.fields === undefined ? {} : { fields: body.fields }),
      ...(body.maxProximityDistance === undefined
        ? {}
        : { maxProximityDistance: body.maxProximityDistance }),
      ...(body.sort === undefined ? {} : { sort: body.sort }),
      ...(body.k1 === undefined ? {} : { k1: body.k1 }),
      ...(body.b === undefined ? {} : { b: body.b }),
    };
    const result = await options.cache.getOrCompute(
      indexId,
      options.indexes.getGeneration(indexId),
      body.query,
      searchOptions,
      () => options.indexes.search(indexId, body.query, searchOptions),
    );
    const processingTimeMs = performance.now() - startedAt;
    const searchId = await options.analytics.recordSearch({
      indexId,
      query: body.query,
      processingTimeMs,
      resultCount: result.total,
      filters: body.filters,
      impressions: result.results.map((hit, resultIndex) => ({
        documentId: hit.documentId,
        position: body.offset + resultIndex + 1,
      })),
      ...(body.sessionId === undefined ? {} : { sessionId: body.sessionId }),
    });

    return {
      query: body.query,
      processingTimeMs,
      searchId,
      total: result.total,
      limit: body.limit,
      offset: body.offset,
      hits: result.results.map((hit) => ({
        ...hit,
        document: options.indexes.getDocument(indexId, hit.documentId),
      })),
      facets: result.facets,
      requestId: request.id,
    };
  });

  app.post('/v1/indexes/:indexId/autocomplete', async (request) => {
    const { indexId } = parseRequest(indexIdParametersSchema, request.params, 'path parameters');
    const body = parseRequest(autocompleteRequestSchema, request.body, 'autocomplete request');
    const startedAt = performance.now();
    const autocompleteOptions = { limit: body.limit };
    const suggestions = await options.cache.getAutocompleteOrCompute(
      indexId,
      options.indexes.getGeneration(indexId),
      body.prefix,
      autocompleteOptions,
      () => options.indexes.autocomplete(indexId, body.prefix, autocompleteOptions),
    );

    return {
      prefix: body.prefix,
      suggestions,
      processingTimeMs: performance.now() - startedAt,
      requestId: request.id,
    };
  });

  done();
};

import { highlightField } from './highlight.js';
import { selectTopK } from './heap.js';
import {
  correctQuerySpelling,
  type SpellCorrectionOptions,
  type SpellCorrectionResult,
} from './spell-correction.js';
import { SynonymMap } from './synonyms.js';
import { InMemoryInvertedIndex } from './inverted-index.js';
import { defaultMaximumEditDistance, levenshteinDistance } from './levenshtein.js';
import { parseQuery, type ParsedPhrase } from './query-parser.js';
import { BM25RankingStrategy, TFIDFRankingStrategy, type RankingStrategy } from './ranking.js';
import type {
  AutocompleteOptions,
  CollectionStatistics,
  FieldContribution,
  HighlightOptions,
  IndexConfiguration,
  PhraseMatchDebug,
  RankingRuleContribution,
  PostingEntry,
  SearchHit,
  SearchOptions,
  SearchResponse,
  SearchSort,
  SeekrSearchIndex,
  TermScoreDebug,
  TypoToleranceOptions,
} from './types.js';

interface ResolvedTerm {
  readonly queryTerm: string;
  readonly matchedTerm: string;
  readonly editDistance: number;
  readonly penalty: number;
  readonly queryFrequency: number;
  readonly synonym: boolean;
}

interface PhraseEvaluation {
  readonly matches: boolean;
  readonly debug: readonly PhraseMatchDebug[];
}

interface ScoredCandidate {
  readonly documentId: string;
  readonly score: number;
  readonly terms: readonly TermScoreDebug[];
  readonly phrases: readonly PhraseMatchDebug[];
  readonly proximityBoost: number;
  readonly matchedTerms: readonly string[];
  readonly matchedFields: readonly string[];
  readonly fieldContributions: readonly FieldContribution[];
  readonly rankingRules: readonly RankingRuleContribution[];
}

const intersect = (left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> => {
  const intersection = new Set<string>();
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  for (const value of smaller) if (larger.has(value)) intersection.add(value);
  return intersection;
};

const compareByScore = (left: ScoredCandidate, right: ScoredCandidate): number =>
  right.score - left.score || left.documentId.localeCompare(right.documentId);

export class SearchIndex extends InMemoryInvertedIndex implements SeekrSearchIndex {
  readonly #synonyms: SynonymMap;
  public constructor(configuration: IndexConfiguration = {}) {
    super(configuration);
    this.#synonyms = new SynonymMap(configuration.synonyms);
  }

  public search(query: string, options: SearchOptions = {}): SearchResponse {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;
    if (!Number.isInteger(limit) || limit < 0)
      throw new RangeError('limit must be a non-negative integer');
    if (!Number.isInteger(offset) || offset < 0)
      throw new RangeError('offset must be a non-negative integer');

    const parsed = parseQuery(query, this.configuration.tokenizer);
    const allowedFields = this.resolveAllowedFields(options.fields);
    const resolvedTerms = this.resolveTerms(parsed.terms, options.typoTolerance);
    let candidates = this.collectCandidates(resolvedTerms, allowedFields);
    const hasQuery = parsed.terms.length > 0 || parsed.phrases.length > 0;
    if (!hasQuery && (options.filters?.length ?? 0) > 0)
      candidates = new Set(this.getDocumentIds());

    for (const filter of options.filters ?? []) {
      candidates = intersect(candidates, this.filterCandidates(filter));
    }

    const ranking = this.createRankingStrategy(options);
    const collection = this.getCollectionStatistics();
    const documentFrequencyCache = new Map<string, number>();
    const scored: ScoredCandidate[] = [];
    const matchedDocumentIds = new Set<string>();

    for (const documentId of candidates) {
      const phraseEvaluation = this.evaluatePhrases(documentId, parsed.phrases, allowedFields);
      if (!phraseEvaluation.matches) continue;
      const candidate = this.applyRankingRules(
        this.scoreDocument(
          documentId,
          resolvedTerms,
          allowedFields,
          ranking,
          options,
          phraseEvaluation.debug,
          collection,
          documentFrequencyCache,
        ),
      );
      if (hasQuery && candidate.score <= 0) continue;
      scored.push(candidate);
      matchedDocumentIds.add(documentId);
    }

    const compare = this.createResultComparator(options.sort);
    const selected = selectTopK(scored, limit + offset, compare).slice(offset, offset + limit);
    const results = selected.map((candidate) => this.toSearchHit(candidate, options));
    const facets: Record<string, Readonly<Record<string, number>>> = {};
    for (const field of options.facets ?? []) facets[field] = this.facet(field, matchedDocumentIds);

    return { results, total: scored.length, facets };
  }

  public override autocomplete(
    prefix: string,
    options: AutocompleteOptions = {},
  ): readonly string[] {
    return super.autocomplete(prefix, options);
  }

  public correctQuery(query: string, options: SpellCorrectionOptions = {}): SpellCorrectionResult {
    return correctQuerySpelling(query, this, options);
  }

  private resolveAllowedFields(
    fields: readonly string[] | undefined,
  ): ReadonlySet<string> | undefined {
    if (fields === undefined) return undefined;
    const allowed = new Set<string>();
    for (const field of fields) {
      if (this.configuration.fields?.[field]?.searchable !== true)
        throw new Error(`Field "${field}" is not configured as searchable`);
      allowed.add(field);
    }
    return allowed;
  }

  private resolveTerms(
    terms: readonly string[],
    typoTolerance: SearchOptions['typoTolerance'],
  ): ResolvedTerm[] {
    const frequencies = new Map<string, number>();
    for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    const resolved: ResolvedTerm[] = [];

    for (const [queryTerm, queryFrequency] of frequencies) {
      if (this.getDocumentFrequency(queryTerm) > 0) {
        resolved.push({
          queryTerm,
          matchedTerm: queryTerm,
          editDistance: 0,
          penalty: 1,
          queryFrequency,
          synonym: false,
        });
      }
      for (const expansion of this.#synonyms.expand(queryTerm)) {
        if (this.getDocumentFrequency(expansion) === 0) continue;
        resolved.push({
          queryTerm,
          matchedTerm: expansion,
          editDistance: 0,
          penalty: this.configuration.synonymPenalty ?? 0.7,
          queryFrequency,
          synonym: true,
        });
      }
      if (this.getDocumentFrequency(queryTerm) > 0) continue;
      if (typoTolerance !== true && typeof typoTolerance !== 'object') continue;
      const configuration: TypoToleranceOptions =
        typeof typoTolerance === 'object' ? typoTolerance : {};
      const maxDistance = configuration.maxDistance ?? defaultMaximumEditDistance(queryTerm);
      const queryLength = Array.from(queryTerm).length;
      const prefixLength = configuration.prefixLength ?? 1;
      const prefix = Array.from(queryTerm).slice(0, prefixLength).join('');

      for (const candidate of this.getVocabularyCandidates(
        Math.max(1, queryLength - maxDistance),
        queryLength + maxDistance,
      )) {
        if (prefixLength > 0 && !candidate.startsWith(prefix)) continue;
        const distance = levenshteinDistance(queryTerm, candidate, maxDistance);
        if (distance <= maxDistance) {
          resolved.push({
            queryTerm,
            matchedTerm: candidate,
            editDistance: distance,
            penalty: Math.max(0.25, 1 - distance / (maxDistance + 1)),
            queryFrequency,
            synonym: false,
          });
        }
      }
    }
    return resolved;
  }

  private collectCandidates(
    terms: readonly ResolvedTerm[],
    allowedFields: ReadonlySet<string> | undefined,
  ): Set<string> {
    const candidates = new Set<string>();
    for (const term of terms) {
      for (const posting of this.getPostingList(term.matchedTerm)) {
        if (allowedFields === undefined || allowedFields.has(posting.field))
          candidates.add(posting.documentId);
      }
    }
    return candidates;
  }

  private createRankingStrategy(options: SearchOptions): RankingStrategy {
    return options.ranking === 'tfidf'
      ? new TFIDFRankingStrategy()
      : new BM25RankingStrategy({
          ...(options.k1 === undefined ? {} : { k1: options.k1 }),
          ...(options.b === undefined ? {} : { b: options.b }),
        });
  }

  private scoreDocument(
    documentId: string,
    terms: readonly ResolvedTerm[],
    allowedFields: ReadonlySet<string> | undefined,
    ranking: RankingStrategy,
    options: SearchOptions,
    phrases: readonly PhraseMatchDebug[],
    collection: CollectionStatistics,
    documentFrequencyCache: Map<string, number>,
  ): ScoredCandidate {
    const document = this.getDocumentStatistics(documentId);
    const termDebug: TermScoreDebug[] = [];
    const fieldScores = new Map<string, { score: number; terms: Set<string> }>();

    for (const term of terms) {
      for (const field of this.getFieldsForTerm(term.matchedTerm, documentId)) {
        if (allowedFields !== undefined && !allowedFields.has(field)) continue;
        const posting = this.getFieldPosting(term.matchedTerm, documentId, field);
        if (posting === undefined) continue;
        const documentCount = collection.fieldDocumentCounts[field] ?? collection.documentCount;
        const documentLength = document?.fieldLengths[field] ?? 0;
        const averageDocumentLength = collection.fieldAverageLengths[field] ?? 0;
        const frequencyKey = `${term.matchedTerm}\u0000${field}`;
        let df = documentFrequencyCache.get(frequencyKey);
        if (df === undefined) {
          df = this.getDocumentFrequency(term.matchedTerm, field);
          documentFrequencyCache.set(frequencyKey, df);
        }
        const rankingScore = ranking.score({
          termFrequency: posting.termFrequency,
          documentFrequency: df,
          documentCount,
          documentLength,
          averageDocumentLength,
        });
        const fieldWeight = this.configuration.fields?.[field]?.weight ?? 1;
        const contribution = rankingScore.score * fieldWeight * term.penalty * term.queryFrequency;
        const current = fieldScores.get(field) ?? { score: 0, terms: new Set<string>() };
        current.score += contribution;
        current.terms.add(term.matchedTerm);
        fieldScores.set(field, current);
        termDebug.push({
          queryTerm: term.queryTerm,
          matchedTerm: term.matchedTerm,
          field,
          tf: posting.termFrequency,
          df,
          idf: rankingScore.idf,
          documentLength,
          averageDocumentLength,
          fieldWeight,
          typoPenalty: term.synonym ? 1 : term.penalty,
          synonymPenalty: term.synonym ? term.penalty : 1,
          proximityBoost: 0,
          contribution,
          ...(ranking instanceof BM25RankingStrategy ? { bm25Score: rankingScore.score } : {}),
          ...(term.editDistance > 0 ? { editDistance: term.editDistance } : {}),
        });
      }
    }

    const baseScore = [...fieldScores.values()].reduce((total, field) => total + field.score, 0);
    const proximityBoost =
      options.proximityBoost === true
        ? this.calculateProximityBoost(documentId, terms, allowedFields, baseScore, options)
        : 0;
    const adjustedDebug = termDebug.map((debug, index) =>
      index === 0 ? { ...debug, proximityBoost } : debug,
    );

    return {
      documentId,
      score: baseScore + proximityBoost,
      terms: adjustedDebug,
      phrases,
      proximityBoost,
      matchedTerms: [...new Set(termDebug.map(({ matchedTerm }) => matchedTerm))],
      matchedFields: [...fieldScores.keys()].sort(),
      fieldContributions: [...fieldScores]
        .map(([field, value]) => ({
          field,
          score: value.score,
          matchedTerms: [...value.terms].sort(),
        }))
        .sort((left, right) => left.field.localeCompare(right.field)),
      rankingRules: [],
    };
  }

  private applyRankingRules(candidate: ScoredCandidate): ScoredCandidate {
    const contributions: RankingRuleContribution[] = [];
    const document = this.getDocument(candidate.documentId);
    if (document === undefined) return candidate;
    for (const rule of this.configuration.rankingRules ?? []) {
      const value = document.metadata?.[rule.field] ?? document.fields[rule.field];
      if ('condition' in rule) {
        const matches =
          rule.condition === 'exists'
            ? value !== undefined && value !== null
            : rule.condition === 'equals'
              ? value === rule.value
              : value !== rule.value;
        if (!matches) continue;
        contributions.push({
          field: rule.field,
          rule: 'boost',
          contribution: Math.max(candidate.score, 1) * (rule.boost - 1),
        });
      } else if (typeof value === 'string') {
        const timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp)) continue;
        const ageDays = Math.max(0, Date.now() - timestamp) / (24 * 60 * 60_000);
        const decay = 2 ** (-ageDays / rule.halfLifeDays);
        contributions.push({
          field: rule.field,
          rule: 'recency',
          contribution: Math.max(candidate.score, 1) * decay * (rule.weight ?? 0.2),
        });
      }
    }
    return {
      ...candidate,
      score: Math.max(
        0,
        candidate.score + contributions.reduce((sum, item) => sum + item.contribution, 0),
      ),
      rankingRules: contributions,
    };
  }

  private evaluatePhrases(
    documentId: string,
    phrases: readonly ParsedPhrase[],
    allowedFields: ReadonlySet<string> | undefined,
  ): PhraseEvaluation {
    const debug: PhraseMatchDebug[] = [];
    for (const phrase of phrases) {
      const first = phrase.tokens[0];
      if (first === undefined) continue;
      let phraseMatched = false;
      for (const field of this.getFieldsForTerm(first.token, documentId)) {
        if (allowedFields !== undefined && !allowedFields.has(field)) continue;
        const postings = phrase.tokens.map(({ token }) =>
          this.getFieldPosting(token, documentId, field),
        );
        if (postings.some((posting) => posting === undefined)) continue;
        const firstPosting = postings[0];
        if (firstPosting === undefined) continue;
        const starts = firstPosting.positions.filter((start) =>
          phrase.tokens.every((token, index) => {
            const posting = postings[index];
            const expected = start + token.position - first.position;
            return posting?.positions.includes(expected) ?? false;
          }),
        );
        if (starts.length > 0) {
          phraseMatched = true;
          debug.push({ phrase: phrase.source, field, positions: starts });
        }
      }
      if (!phraseMatched) return { matches: false, debug: [] };
    }
    return { matches: true, debug };
  }

  private calculateProximityBoost(
    documentId: string,
    terms: readonly ResolvedTerm[],
    allowedFields: ReadonlySet<string> | undefined,
    baseScore: number,
    options: SearchOptions,
  ): number {
    const uniqueTerms = [...new Set(terms.map(({ matchedTerm }) => matchedTerm))];
    if (uniqueTerms.length < 2 || baseScore <= 0) return 0;
    const maximum = options.maxProximityDistance ?? 5;
    let minimumDistance = Infinity;
    const fields = new Set(uniqueTerms.flatMap((term) => this.getFieldsForTerm(term, documentId)));

    for (const field of fields) {
      if (allowedFields !== undefined && !allowedFields.has(field)) continue;
      for (let left = 0; left < uniqueTerms.length; left += 1) {
        for (let right = left + 1; right < uniqueTerms.length; right += 1) {
          const leftPositions = this.getFieldPosting(
            uniqueTerms[left] as string,
            documentId,
            field,
          )?.positions;
          const rightPositions = this.getFieldPosting(
            uniqueTerms[right] as string,
            documentId,
            field,
          )?.positions;
          for (const leftPosition of leftPositions ?? []) {
            for (const rightPosition of rightPositions ?? [])
              minimumDistance = Math.min(minimumDistance, Math.abs(leftPosition - rightPosition));
          }
        }
      }
    }
    if (minimumDistance > maximum) return 0;
    return baseScore * 0.1 * (1 - Math.max(0, minimumDistance - 1) / maximum);
  }

  private createResultComparator(sort: SearchSort | undefined) {
    if (sort === undefined) return compareByScore;
    if (this.configuration.fields?.[sort.field]?.sortable !== true)
      throw new Error(`Field "${sort.field}" is not configured as sortable`);

    return (left: ScoredCandidate, right: ScoredCandidate): number => {
      const leftValue = this.getSortableValue(left.documentId, sort.field);
      const rightValue = this.getSortableValue(right.documentId, sort.field);
      if (leftValue === undefined && rightValue === undefined) return compareByScore(left, right);
      if (leftValue === undefined) return 1;
      if (rightValue === undefined) return -1;
      const direction = sort.direction === 'asc' ? 1 : -1;
      const comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      return comparison * direction || compareByScore(left, right);
    };
  }

  private getSortableValue(
    documentId: string,
    field: string,
  ): string | number | boolean | undefined {
    const value = this.getFieldValue(documentId, field);
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? value
      : undefined;
  }

  private toSearchHit(candidate: ScoredCandidate, options: SearchOptions): SearchHit {
    const highlights = this.createHighlights(candidate, options.highlights);
    return {
      documentId: candidate.documentId,
      score: candidate.score,
      matchedTerms: candidate.matchedTerms,
      matchedFields: candidate.matchedFields,
      fieldContributions: candidate.fieldContributions,
      ...(highlights === undefined ? {} : { highlights }),
      ...(options.explain === true
        ? {
            explanation: {
              finalScore: candidate.score,
              terms: candidate.terms,
              phrases: candidate.phrases,
              proximityBoost: candidate.proximityBoost,
              rankingRules: candidate.rankingRules,
            },
          }
        : {}),
      ...(options.debug === true ? { debug: candidate.terms } : {}),
    };
  }

  private createHighlights(
    candidate: ScoredCandidate,
    highlights: SearchOptions['highlights'],
  ): Readonly<Record<string, string>> | undefined {
    if (highlights !== true && typeof highlights !== 'object') return undefined;
    const options: HighlightOptions = typeof highlights === 'object' ? highlights : {};
    const document = this.getDocument(candidate.documentId);
    if (document === undefined) return undefined;
    const allowed = options.fields === undefined ? undefined : new Set(options.fields);
    const result: Record<string, string> = {};

    for (const field of candidate.matchedFields) {
      if (allowed !== undefined && !allowed.has(field)) continue;
      const postings: PostingEntry[] = [];
      for (const term of candidate.terms) {
        if (term.field !== field) continue;
        const posting = this.getFieldPosting(term.matchedTerm, candidate.documentId, field);
        if (posting !== undefined) postings.push(posting);
      }
      const highlighted = highlightField(document.fields[field] ?? null, postings, options);
      if (highlighted !== undefined) result[field] = highlighted;
    }
    return Object.keys(result).length === 0 ? undefined : result;
  }
}

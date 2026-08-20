import { SearchIndex } from './search-engine.js';
import type { IndexConfiguration, SearchDocument, SearchOptions } from './types.js';

export interface RelevanceQuery {
  readonly id?: string;
  readonly query: string;
  readonly relevantDocuments: Readonly<Record<string, number>>;
}
export interface EvaluationDataset {
  readonly documents: readonly SearchDocument[];
  readonly queries: readonly RelevanceQuery[];
}
export interface QueryEvaluation {
  readonly query: string;
  readonly precisionAtK: number;
  readonly recallAtK: number;
  readonly reciprocalRank: number;
  readonly dcgAtK: number;
  readonly ndcgAtK: number;
}
export interface EvaluationResult {
  readonly name: string;
  readonly k: number;
  readonly queries: readonly QueryEvaluation[];
  readonly meanPrecisionAtK: number;
  readonly meanRecallAtK: number;
  readonly meanReciprocalRank: number;
  readonly meanNdcgAtK: number;
}
export interface EvaluationConfiguration {
  readonly name: string;
  readonly index?: IndexConfiguration;
  readonly search?: SearchOptions;
}

export function precisionAtK(
  retrieved: readonly string[],
  relevant: Readonly<Record<string, number>>,
  k: number,
): number {
  if (k <= 0) return 0;
  return retrieved.slice(0, k).filter((id) => (relevant[id] ?? 0) > 0).length / k;
}
export function recallAtK(
  retrieved: readonly string[],
  relevant: Readonly<Record<string, number>>,
  k: number,
): number {
  const totalRelevant = Object.values(relevant).filter((grade) => grade > 0).length;
  if (totalRelevant === 0) return 0;
  return retrieved.slice(0, k).filter((id) => (relevant[id] ?? 0) > 0).length / totalRelevant;
}
export function reciprocalRank(
  retrieved: readonly string[],
  relevant: Readonly<Record<string, number>>,
): number {
  const position = retrieved.findIndex((id) => (relevant[id] ?? 0) > 0);
  return position < 0 ? 0 : 1 / (position + 1);
}
export function dcgAtK(
  retrieved: readonly string[],
  relevant: Readonly<Record<string, number>>,
  k: number,
): number {
  return retrieved
    .slice(0, k)
    .reduce((score, id, index) => score + (2 ** (relevant[id] ?? 0) - 1) / Math.log2(index + 2), 0);
}
export function ndcgAtK(
  retrieved: readonly string[],
  relevant: Readonly<Record<string, number>>,
  k: number,
): number {
  const actual = dcgAtK(retrieved, relevant, k);
  const idealGrades = Object.values(relevant)
    .sort((left, right) => right - left)
    .slice(0, k);
  const ideal = idealGrades.reduce(
    (score, grade, index) => score + (2 ** grade - 1) / Math.log2(index + 2),
    0,
  );
  return ideal === 0 ? 0 : actual / ideal;
}

export function evaluateConfigurations(
  dataset: EvaluationDataset,
  configurations: readonly EvaluationConfiguration[],
  k = 10,
): readonly EvaluationResult[] {
  return configurations.map((configuration) => {
    const index = new SearchIndex(configuration.index);
    index.addDocuments(dataset.documents);
    const queries = dataset.queries.map((judgment): QueryEvaluation => {
      const retrieved = index
        .search(judgment.query, { limit: k, ...configuration.search })
        .results.map((hit) => hit.documentId);
      return {
        query: judgment.query,
        precisionAtK: precisionAtK(retrieved, judgment.relevantDocuments, k),
        recallAtK: recallAtK(retrieved, judgment.relevantDocuments, k),
        reciprocalRank: reciprocalRank(retrieved, judgment.relevantDocuments),
        dcgAtK: dcgAtK(retrieved, judgment.relevantDocuments, k),
        ndcgAtK: ndcgAtK(retrieved, judgment.relevantDocuments, k),
      };
    });
    return {
      name: configuration.name,
      k,
      queries,
      meanPrecisionAtK: mean(queries.map((query) => query.precisionAtK)),
      meanRecallAtK: mean(queries.map((query) => query.recallAtK)),
      meanReciprocalRank: mean(queries.map((query) => query.reciprocalRank)),
      meanNdcgAtK: mean(queries.map((query) => query.ndcgAtK)),
    };
  });
}

export function formatEvaluationTable(results: readonly EvaluationResult[]): string {
  const rows = [['Configuration', 'P@K', 'R@K', 'MRR', 'NDCG@K']];
  for (const result of results)
    rows.push([
      result.name,
      result.meanPrecisionAtK.toFixed(4),
      result.meanRecallAtK.toFixed(4),
      result.meanReciprocalRank.toFixed(4),
      result.meanNdcgAtK.toFixed(4),
    ]);
  const widths =
    rows[0]?.map((_, column) => Math.max(...rows.map((row) => row[column]?.length ?? 0))) ?? [];
  return rows
    .map((row) => row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  '))
    .join('\n');
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

import { tokenize } from '@seekr/tokenizer';
import { defaultMaximumEditDistance, levenshteinDistance } from './levenshtein.js';

export interface SpellCorrectionResult {
  readonly originalQuery: string;
  readonly correctedQuery: string;
  readonly correctionApplied: boolean;
  readonly correctionConfidence: number;
  readonly corrections: ReadonlyArray<{
    readonly originalTerm: string;
    readonly correctedTerm: string;
    readonly editDistance: number;
    readonly confidence: number;
  }>;
}
export interface VocabularyAccess {
  getDocumentFrequency(term: string): number;
  getVocabularyCandidates(minLength: number, maxLength: number): readonly string[];
}
export interface SpellCorrectionOptions {
  readonly confidenceThreshold?: number;
  readonly maximumEditDistance?: number;
}

export function correctQuerySpelling(
  query: string,
  vocabulary: VocabularyAccess,
  options: SpellCorrectionOptions = {},
): SpellCorrectionResult {
  if (query.includes('"')) return unchanged(query);
  const terms = tokenize(query);
  const corrected: string[] = [];
  const corrections: SpellCorrectionResult['corrections'][number][] = [];
  for (const term of terms) {
    if (vocabulary.getDocumentFrequency(term) > 0) {
      corrected.push(term);
      continue;
    }
    const maximumDistance = options.maximumEditDistance ?? defaultMaximumEditDistance(term);
    const length = Array.from(term).length;
    const candidates = vocabulary
      .getVocabularyCandidates(Math.max(1, length - maximumDistance), length + maximumDistance)
      .filter((candidate) => candidate[0] === term[0])
      .map((candidate) => ({
        candidate,
        distance: levenshteinDistance(term, candidate, maximumDistance),
        df: vocabulary.getDocumentFrequency(candidate),
      }))
      .filter((candidate) => candidate.distance <= maximumDistance)
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          right.df - left.df ||
          left.candidate.localeCompare(right.candidate),
      );
    const best = candidates[0];
    if (best === undefined) {
      corrected.push(term);
      continue;
    }
    const maximumDf = Math.max(...candidates.map((candidate) => candidate.df), 1);
    const confidence =
      (1 - best.distance / (Math.max(length, Array.from(best.candidate).length) + 1)) * 0.8 +
      (Math.log1p(best.df) / Math.log1p(maximumDf)) * 0.2;
    const second = candidates[1];
    const ambiguous =
      second !== undefined && second.distance === best.distance && second.df >= best.df * 0.9;
    if (confidence < (options.confidenceThreshold ?? 0.65) || ambiguous) {
      corrected.push(term);
      continue;
    }
    corrected.push(best.candidate);
    corrections.push({
      originalTerm: term,
      correctedTerm: best.candidate,
      editDistance: best.distance,
      confidence,
    });
  }
  return {
    originalQuery: query,
    correctedQuery: corrected.join(' '),
    correctionApplied: corrections.length > 0,
    correctionConfidence:
      corrections.length === 0
        ? 0
        : corrections.reduce((sum, item) => sum + item.confidence, 0) / corrections.length,
    corrections,
  };
}

function unchanged(query: string): SpellCorrectionResult {
  return {
    originalQuery: query,
    correctedQuery: query,
    correctionApplied: false,
    correctionConfidence: 0,
    corrections: [],
  };
}

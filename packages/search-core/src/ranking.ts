export interface RankingInput {
  readonly termFrequency: number;
  readonly documentFrequency: number;
  readonly documentCount: number;
  readonly documentLength: number;
  readonly averageDocumentLength: number;
}

export interface RankingScore {
  readonly score: number;
  readonly tf: number;
  readonly idf: number;
}

export interface RankingStrategy {
  score(input: RankingInput): RankingScore;
}

export function inverseDocumentFrequency(documentCount: number, documentFrequency: number): number {
  if (documentCount <= 0 || documentFrequency <= 0) return 0;
  return Math.log(documentCount / documentFrequency);
}

export function smoothedInverseDocumentFrequency(
  documentCount: number,
  documentFrequency: number,
): number {
  if (documentCount <= 0 || documentFrequency <= 0) return 0;
  return Math.log((documentCount + 1) / (documentFrequency + 1)) + 1;
}

export class TFIDFRankingStrategy implements RankingStrategy {
  public score(input: RankingInput): RankingScore {
    const tf = input.termFrequency > 0 ? 1 + Math.log(input.termFrequency) : 0;
    const idf = smoothedInverseDocumentFrequency(input.documentCount, input.documentFrequency);
    return { score: tf * idf, tf, idf };
  }
}

export interface BM25Options {
  readonly k1?: number;
  readonly b?: number;
}

export class BM25RankingStrategy implements RankingStrategy {
  public readonly k1: number;
  public readonly b: number;

  public constructor(options: BM25Options = {}) {
    this.k1 = options.k1 ?? 1.2;
    this.b = options.b ?? 0.75;
    if (!Number.isFinite(this.k1) || this.k1 < 0) throw new RangeError('k1 must be non-negative');
    if (!Number.isFinite(this.b) || this.b < 0 || this.b > 1)
      throw new RangeError('b must be between 0 and 1');
  }

  public score(input: RankingInput): RankingScore {
    if (input.termFrequency <= 0 || input.documentCount <= 0) return { score: 0, tf: 0, idf: 0 };
    const idf = Math.log(
      1 + (input.documentCount - input.documentFrequency + 0.5) / (input.documentFrequency + 0.5),
    );
    const averageLength = input.averageDocumentLength > 0 ? input.averageDocumentLength : 1;
    const normalization = 1 - this.b + this.b * (input.documentLength / averageLength);
    const denominator = input.termFrequency + this.k1 * normalization;
    const tf = (input.termFrequency * (this.k1 + 1)) / denominator;
    return { score: idf * tf, tf, idf };
  }
}

export type UnicodeNormalizationForm = 'NFC' | 'NFD' | 'NFKC' | 'NFKD';

export type PunctuationHandling = 'preserve' | 'remove' | 'replace';

export interface NGramOptions {
  readonly minN: number;
  readonly maxN: number;
  readonly separator?: string;
}

export interface Stemmer {
  stem(token: string): string;
}

export interface TokenizeOptions {
  /** Defaults to NFKC. Set to false to retain the source representation. */
  readonly unicodeNormalization?: UnicodeNormalizationForm | false;
  /** Defaults to true. */
  readonly lowercase?: boolean;
  readonly locale?: string | readonly string[];
  /** Defaults to replacing punctuation and symbols with spaces. */
  readonly punctuation?: PunctuationHandling;
  /** Defaults to true and uses the built-in English set. */
  readonly stopWordRemoval?: boolean;
  /** Replaces the built-in English stop-word set when supplied. */
  readonly stopWords?: Iterable<string>;
  /** No stemming is performed unless a strategy is supplied. */
  readonly stemmer?: Stemmer;
  /** No n-grams are generated unless a range is supplied. */
  readonly nGrams?: NGramOptions | false;
}

export interface DetailedToken {
  readonly token: string;
  /** Zero-based position before stop-word removal. */
  readonly position: number;
  /** End-exclusive UTF-16 offsets into the original input. */
  readonly startOffset: number;
  readonly endOffset: number;
}

export type Token = DetailedToken;

export interface Tokenizer {
  tokenize(text: string, options?: TokenizeOptions): readonly string[];
  tokenizeDetailed(text: string, options?: TokenizeOptions): readonly DetailedToken[];
}

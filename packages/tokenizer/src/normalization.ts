import { convertToLowercase } from './case-folding.js';
import { handlePunctuation } from './punctuation.js';
import type { TokenizeOptions } from './types.js';
import { DEFAULT_UNICODE_NORMALIZATION, normalizeUnicode } from './unicode.js';
import { normalizeWhitespace } from './whitespace.js';

export type NormalizeTokenOptions = Pick<
  TokenizeOptions,
  'unicodeNormalization' | 'lowercase' | 'locale' | 'punctuation'
>;

export function normalizeToken(token: string, options: NormalizeTokenOptions = {}): string {
  const normalizationForm = options.unicodeNormalization ?? DEFAULT_UNICODE_NORMALIZATION;
  const unicodeNormalized =
    normalizationForm === false ? token : normalizeUnicode(token, normalizationForm);
  const caseNormalized =
    options.lowercase === false
      ? unicodeNormalized
      : convertToLowercase(unicodeNormalized, options.locale);
  const punctuationNormalized = handlePunctuation(caseNormalized, options.punctuation ?? 'replace');

  return normalizeWhitespace(punctuationNormalized);
}

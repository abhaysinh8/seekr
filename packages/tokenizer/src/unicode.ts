import type { UnicodeNormalizationForm } from './types.js';

export const DEFAULT_UNICODE_NORMALIZATION: UnicodeNormalizationForm = 'NFKC';

export function normalizeUnicode(
  text: string,
  form: UnicodeNormalizationForm = DEFAULT_UNICODE_NORMALIZATION,
): string {
  return text.normalize(form);
}

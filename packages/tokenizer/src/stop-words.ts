const englishStopWords = [
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
] as const;

export const DEFAULT_ENGLISH_STOP_WORDS: ReadonlySet<string> = new Set(englishStopWords);

export function removeStopWords(
  tokens: readonly string[],
  stopWords: ReadonlySet<string> = DEFAULT_ENGLISH_STOP_WORDS,
): string[] {
  return tokens.filter((token) => !stopWords.has(token));
}

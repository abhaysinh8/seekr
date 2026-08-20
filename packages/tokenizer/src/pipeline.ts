import {
  handleMappedPunctuation,
  lowercaseMappedText,
  mapSourceText,
  normalizeMappedWhitespace,
  splitMappedTokens,
} from './mapped-text.js';
import { generateDetailedNGrams } from './ngrams.js';
import { normalizeToken } from './normalization.js';
import { removeEmptyTokens, splitTokens } from './splitting.js';
import { DEFAULT_ENGLISH_STOP_WORDS } from './stop-words.js';
import type { DetailedToken, TokenizeOptions, Tokenizer } from './types.js';
import { DEFAULT_UNICODE_NORMALIZATION } from './unicode.js';

function createStopWordSet(options: TokenizeOptions): ReadonlySet<string> {
  if (options.stopWords === undefined) return DEFAULT_ENGLISH_STOP_WORDS;

  const stopWords = new Set<string>();
  for (const stopWord of options.stopWords) {
    const normalized = normalizeToken(stopWord, options);
    for (const token of removeEmptyTokens(splitTokens(normalized))) stopWords.add(token);
  }
  return stopWords;
}

function filterStopWords(
  tokens: readonly DetailedToken[],
  options: TokenizeOptions,
): DetailedToken[] {
  if (options.stopWordRemoval === false) return [...tokens];
  const stopWords = createStopWordSet(options);
  return tokens.filter(({ token }) => !stopWords.has(token));
}

function stemDetailedTokens(
  tokens: readonly DetailedToken[],
  options: TokenizeOptions,
): DetailedToken[] {
  if (options.stemmer === undefined) return [...tokens];

  return tokens.flatMap((token) => {
    const stemmed = options.stemmer?.stem(token.token) ?? token.token;
    return stemmed.length === 0 ? [] : [{ ...token, token: stemmed }];
  });
}

export function tokenizeDetailed(text: string, options: TokenizeOptions = {}): DetailedToken[] {
  const normalization = options.unicodeNormalization ?? DEFAULT_UNICODE_NORMALIZATION;
  let characters = mapSourceText(text, normalization);

  if (options.lowercase !== false) {
    characters = lowercaseMappedText(characters, options.locale);
  }

  characters = handleMappedPunctuation(characters, options.punctuation ?? 'replace');
  characters = normalizeMappedWhitespace(characters);

  const split = splitMappedTokens(characters);
  const withoutStopWords = filterStopWords(split, options);
  const stemmed = stemDetailedTokens(withoutStopWords, options);

  return options.nGrams === undefined || options.nGrams === false
    ? stemmed
    : generateDetailedNGrams(stemmed, options.nGrams);
}

export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
  return tokenizeDetailed(text, options).map(({ token }) => token);
}

export function createTokenizer(defaultOptions: TokenizeOptions = {}): Tokenizer {
  return {
    tokenize: (text, options) => tokenize(text, { ...defaultOptions, ...options }),
    tokenizeDetailed: (text, options) => tokenizeDetailed(text, { ...defaultOptions, ...options }),
  };
}

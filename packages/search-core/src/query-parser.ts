import { tokenize, tokenizeDetailed } from '@seekr/tokenizer';
import type { DetailedToken, TokenizeOptions } from '@seekr/tokenizer';

export interface ParsedPhrase {
  readonly source: string;
  readonly tokens: readonly DetailedToken[];
}

export interface ParsedQuery {
  readonly terms: readonly string[];
  readonly phrases: readonly ParsedPhrase[];
}

export function parseQuery(query: string, tokenizerOptions = {} as TokenizeOptions): ParsedQuery {
  const phrases: ParsedPhrase[] = [];
  const unquoted = query.replace(/"([^"]+)"/gu, (_match, phrase: string) => {
    const tokens = tokenizeDetailed(phrase, tokenizerOptions);
    if (tokens.length > 0) phrases.push({ source: phrase, tokens });
    return ' ';
  });
  const ordinaryTerms = tokenize(unquoted, tokenizerOptions);
  const phraseTerms = phrases.flatMap(({ tokens }) => tokens.map(({ token }) => token));
  return { terms: [...ordinaryTerms, ...phraseTerms], phrases };
}

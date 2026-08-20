import type { PunctuationHandling } from './types.js';

const punctuationOrSymbolPattern = /[\p{P}\p{S}]/gu;

export function handlePunctuation(text: string, mode: PunctuationHandling = 'replace'): string {
  if (mode === 'preserve') return text;
  return text.replace(punctuationOrSymbolPattern, mode === 'replace' ? ' ' : '');
}

export function isPunctuationOrSymbol(value: string): boolean {
  return /^[\p{P}\p{S}]$/u.test(value);
}

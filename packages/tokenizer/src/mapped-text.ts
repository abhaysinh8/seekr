import { isPunctuationOrSymbol } from './punctuation.js';
import type { DetailedToken, PunctuationHandling, UnicodeNormalizationForm } from './types.js';

interface MappedCharacter {
  readonly value: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const splitMappedValue = (
  value: string,
  source: Pick<MappedCharacter, 'startOffset' | 'endOffset'>,
): MappedCharacter[] =>
  Array.from(value, (character) => ({
    value: character,
    startOffset: source.startOffset,
    endOffset: source.endOffset,
  }));

export function mapSourceText(
  text: string,
  normalization: UnicodeNormalizationForm | false,
): MappedCharacter[] {
  const characters: MappedCharacter[] = [];

  for (const part of graphemeSegmenter.segment(text)) {
    const endOffset = part.index + part.segment.length;
    const value = normalization === false ? part.segment : part.segment.normalize(normalization);
    characters.push(
      ...splitMappedValue(value, {
        startOffset: part.index,
        endOffset,
      }),
    );
  }

  return characters;
}

export function lowercaseMappedText(
  characters: readonly MappedCharacter[],
  locale?: string | readonly string[],
): MappedCharacter[] {
  return characters.flatMap((character) =>
    splitMappedValue(
      locale === undefined
        ? character.value.toLowerCase()
        : character.value.toLocaleLowerCase(locale),
      character,
    ),
  );
}

export function handleMappedPunctuation(
  characters: readonly MappedCharacter[],
  mode: PunctuationHandling,
): MappedCharacter[] {
  if (mode === 'preserve') return [...characters];

  return characters.flatMap((character) => {
    if (!isPunctuationOrSymbol(character.value)) return [character];
    return mode === 'remove' ? [] : [{ ...character, value: ' ' }];
  });
}

export function normalizeMappedWhitespace(
  characters: readonly MappedCharacter[],
): MappedCharacter[] {
  const normalized: MappedCharacter[] = [];
  let whitespaceStart: number | undefined;
  let whitespaceEnd: number | undefined;

  const flushWhitespace = () => {
    if (normalized.length > 0 && whitespaceStart !== undefined && whitespaceEnd !== undefined) {
      normalized.push({ value: ' ', startOffset: whitespaceStart, endOffset: whitespaceEnd });
    }
    whitespaceStart = undefined;
    whitespaceEnd = undefined;
  };

  for (const character of characters) {
    if (/\s/u.test(character.value)) {
      whitespaceStart ??= character.startOffset;
      whitespaceEnd = character.endOffset;
    } else {
      flushWhitespace();
      normalized.push(character);
    }
  }

  return normalized;
}

export function splitMappedTokens(characters: readonly MappedCharacter[]): DetailedToken[] {
  const tokens: DetailedToken[] = [];
  let current: MappedCharacter[] = [];
  let position = 0;

  const flushToken = () => {
    const first = current[0];
    const last = current.at(-1);
    if (first !== undefined && last !== undefined) {
      tokens.push({
        token: current.map(({ value }) => value).join(''),
        position,
        startOffset: first.startOffset,
        endOffset: last.endOffset,
      });
      position += 1;
    }
    current = [];
  };

  for (const character of characters) {
    if (/\s/u.test(character.value)) flushToken();
    else current.push(character);
  }
  flushToken();

  return tokens;
}

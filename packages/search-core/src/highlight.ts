import type { FieldValue, HighlightOptions, PostingEntry } from './types.js';

interface Range {
  readonly start: number;
  readonly end: number;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

const safeTagPattern = /^<\/?[a-z][a-z0-9-]*>$/iu;

function validateTag(tag: string, label: string): void {
  if (!safeTagPattern.test(tag))
    throw new Error(`${label} must be a simple HTML tag such as <mark> or </mark>`);
}

function mergeRanges(text: string, ranges: readonly Range[]): Range[] {
  const sorted = [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged: Range[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (
      previous !== undefined &&
      (range.start <= previous.end || /^\s*$/u.test(text.slice(previous.end, range.start)))
    ) {
      merged[merged.length - 1] = { start: previous.start, end: Math.max(previous.end, range.end) };
    } else merged.push(range);
  }
  return merged;
}

export function highlightField(
  value: FieldValue,
  postings: readonly PostingEntry[],
  options: HighlightOptions = {},
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const preTag = options.preTag ?? '<mark>';
  const postTag = options.postTag ?? '</mark>';
  validateTag(preTag, 'preTag');
  validateTag(postTag, 'postTag');

  const ranges = mergeRanges(
    value,
    postings.flatMap(({ offsets }) =>
      offsets.map(({ startOffset, endOffset }) => ({ start: startOffset, end: endOffset })),
    ),
  );
  if (ranges.length === 0) return undefined;

  let cursor = 0;
  let highlighted = '';
  for (const range of ranges) {
    highlighted += escapeHtml(value.slice(cursor, range.start));
    highlighted += preTag + escapeHtml(value.slice(range.start, range.end)) + postTag;
    cursor = range.end;
  }
  return highlighted + escapeHtml(value.slice(cursor));
}

export { escapeHtml };

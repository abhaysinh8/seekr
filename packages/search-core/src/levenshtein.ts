/** Levenshtein distance in O(mn) time and O(min(m,n)) memory. */
export function levenshteinDistance(left: string, right: string, maxDistance = Infinity): number {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  const [shorter, longer] =
    leftCharacters.length <= rightCharacters.length
      ? [leftCharacters, rightCharacters]
      : [rightCharacters, leftCharacters];

  if (Math.abs(longer.length - shorter.length) > maxDistance) return maxDistance + 1;
  let previous = Array.from({ length: shorter.length + 1 }, (_, index) => index);

  for (let row = 1; row <= longer.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= shorter.length; column += 1) {
      const substitutionCost = longer[row - 1] === shorter[column - 1] ? 0 : 1;
      const value = Math.min(
        (current[column - 1] as number) + 1,
        (previous[column] as number) + 1,
        (previous[column - 1] as number) + substitutionCost,
      );
      current[column] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maxDistance) return maxDistance + 1;
    previous = current;
  }

  return previous[shorter.length] as number;
}

export function defaultMaximumEditDistance(term: string): number {
  return Array.from(term).length <= 4 ? 1 : 2;
}

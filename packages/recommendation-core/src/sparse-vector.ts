import type { SparseVector } from './types.js';

export function sparseDotProduct(left: SparseVector, right: SparseVector): number {
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  let dot = 0;
  for (const [feature, value] of smaller) dot += value * (larger.get(feature) ?? 0);
  return dot;
}

export function sparseMagnitude(vector: SparseVector): number {
  let squared = 0;
  for (const value of vector.values()) squared += value * value;
  return Math.sqrt(squared);
}

export function normalizeSparseVector(vector: SparseVector): Map<string, number> {
  const magnitude = sparseMagnitude(vector);
  if (magnitude === 0) return new Map();
  return new Map([...vector].map(([feature, value]) => [feature, value / magnitude]));
}

export function cosineSimilarity(left: SparseVector, right: SparseVector): number {
  const denominator = sparseMagnitude(left) * sparseMagnitude(right);
  return denominator === 0 ? 0 : sparseDotProduct(left, right) / denominator;
}

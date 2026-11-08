import type { NodePin } from '@/api/types';

// "Popular" on the find view = the longest line of acts behind a node (its depth).

/** Ids of the n findable pins with the most acts behind them (ties: newest first). */
export function mostPopular(pins: NodePin[], n = 3): Set<number> {
  const ranked = pins
    .filter((p) => (p.depth ?? 0) > 0)
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0) || b.createdAt.localeCompare(a.createdAt));
  return new Set(ranked.slice(0, n).map((p) => p.id));
}

/**
 * How many acts are in the line leading to this node (it included), rounded down past 5
 * so it reads as a rough size: "3 acts", "5+ acts", "10+ acts".
 */
export function actsInLineLabel(depth: number | undefined): string {
  if (depth === undefined) return 'A line of kindness';
  const acts = depth + 1;
  if (acts === 1) return 'Just started: 1 act';
  if (acts < 5) return `${acts} acts so far`;
  return `${Math.floor(acts / 5) * 5}+ acts so far`;
}

import type { NodePin } from '@/api/types';

import { MAX_CHILDREN } from './rules';

/**
 * Which pins show on the join map. A node is findable while it has no children yet and isn't
 * your own (you can't continue it). Nodes don't expire just for being old: the clock only
 * starts once someone claims one. Once it gets a first child it disappears from the join map,
 * but the backend still accepts a second child, so someone already working on it can finish.
 *
 * Uses childCount when the backend sends it (requested); until then "no children" is read
 * from openSlots === MAX_CHILDREN. openSlots > 0 still lets the backend close a node.
 */
export function isFindable(pin: NodePin): boolean {
  const noChildren = pin.childCount !== undefined ? pin.childCount === 0 : pin.openSlots === MAX_CHILDREN;
  return !pin.mine && noChildren && pin.openSlots > 0;
}

/** "5h 12m left" style label, for a claimed node's countdown. */
export function timeLeft(closesAt: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((Date.parse(closesAt) - now) / 60_000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m left` : `${mins}m left`;
}

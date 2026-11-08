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

/** At most this many open acts on a join map at once. */
const MAX_OPEN_SHOWN = 6;
/** Two shown open acts are at least this far apart, so dots don't pile on top of each other. */
const MIN_GAP_M = 170;

function metresBetween(a: NodePin, b: NodePin): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * The open acts a join map actually shows: findable pins, thinned so the map stays readable.
 * Acts that continue an existing tree come before brand-new trees, then newest first; a pin is
 * skipped if it sits within MIN_GAP_M of one already shown, and at most MAX_OPEN_SHOWN are kept.
 * Display only: hidden acts are still open on the server.
 */
export function openPinsToShow(pins: NodePin[]): NodePin[] {
  const ranked = pins
    .filter(isFindable)
    .sort((a, b) => Number(b.parentId !== null) - Number(a.parentId !== null) || b.createdAt.localeCompare(a.createdAt));
  const shown: NodePin[] = [];
  for (const pin of ranked) {
    if (shown.length >= MAX_OPEN_SHOWN) break;
    if (shown.every((s) => metresBetween(s, pin) >= MIN_GAP_M)) shown.push(pin);
  }
  return shown;
}

/** "5h 12m left" style label, for a claimed node's countdown. */
export function timeLeft(closesAt: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((Date.parse(closesAt) - now) / 60_000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m left` : `${mins}m left`;
}

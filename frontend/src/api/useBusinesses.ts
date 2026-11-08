import { useMemo } from 'react';

import { applyBusinessDemoTotals } from './businessDemoTotals';
import { listBusinesses } from './client';
import type { BusinessHub } from './types';
import { useLoad } from './useLoad';

// Module-level stable empty list: a fresh [] per render would restart ChainMap's fit effect.
const NO_BUSINESSES: BusinessHub[] = [];

/**
 * The business catalog for map screens, loaded independently of the screen's primary data so a
 * businesses API outage can't break the kindness map. BusinessHub matches the maps' BusinessPin.
 */
export function useBusinesses() {
  const { data, error, loading, reload } = useLoad(() => listBusinesses());
  // Memoized so a new array identity can't retrigger map camera effects; API objects untouched.
  const businesses = useMemo(() => (data ? data.map(applyBusinessDemoTotals) : NO_BUSINESSES), [data]);
  return { businesses, error, loading, reload };
}

import type { BusinessHub } from './types';

// User-provided demo display totals (NOT server truth): diameterUnits are precomputed from the
// existing growth rule for these exact visitor counts. Applied for presentation only - the API
// catalog is never mutated and no records are invented.
const DEMO_TOTALS: Record<string, { visitors: number; kindnessActs: number; diameterUnits: number }> = {
  'cinnzeo bakery cafe': { visitors: 312, kindnessActs: 2500, diameterUnits: 12.4 },
  'lotus fine indian cuisine - charleswood': { visitors: 242, kindnessActs: 1847, diameterUnits: 11.525 },
};

/** Returns the business with demo display totals applied, or the same object when unmatched. */
export function applyBusinessDemoTotals(business: BusinessHub): BusinessHub {
  const totals = DEMO_TOTALS[business.name.trim().toLowerCase()];
  return totals ? { ...business, ...totals, demoTotals: true } : business;
}

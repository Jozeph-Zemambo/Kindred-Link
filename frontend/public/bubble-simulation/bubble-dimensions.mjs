import { diameterUnits } from './bubble-size.mjs';

// Geographic size of a participation bubble: diameterUnits * metersPerUnit.
// Callers must never mix diameter and radius - everything comes from here.
export function bubbleDimensions(visitors, metersPerUnit) {
  if (typeof metersPerUnit !== 'number' || !Number.isFinite(metersPerUnit)
      || metersPerUnit <= 0) {
    throw new RangeError('metersPerUnit must be a positive finite number');
  }
  const units = diameterUnits(visitors);
  const diameterMeters = units * metersPerUnit;
  if (!Number.isFinite(diameterMeters)) {
    throw new RangeError('diameterMeters is not finite');
  }
  return { diameterUnits: units, diameterMeters, radiusMeters: diameterMeters / 2 };
}

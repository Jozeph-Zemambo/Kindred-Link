// Recency appearance for the bubble lab: a simulated clock drives color
// vibrancy for how recent the last contribution was. Size still encodes total
// participation; this is presentation only, not real history.
const NONE = { stage: 'none', label: 'No contributions', color: '#9baaa8', fillOpacity: 0.12, opacity: 0.25 };
const BANDS = [
  { max: 1, stage: 'fresh', label: 'Within 1 hour', color: '#087f78', fillOpacity: 0.65, opacity: 1.0 },
  { max: 24, stage: 'recent', label: 'Within 24 hours', color: '#298e88', fillOpacity: 0.45, opacity: 0.8 },
  { max: 168, stage: 'cooling', label: 'Within 7 days', color: '#6d9994', fillOpacity: 0.25, opacity: 0.5 },
];
const QUIET = { stage: 'quiet', label: 'Over 7 days ago', color: '#9baaa8', fillOpacity: 0.12, opacity: 0.25 };

export function contributionAppearance(ageHours) {
  if (ageHours === null) {
    return NONE;
  }
  if (typeof ageHours !== 'number' || !Number.isFinite(ageHours) || ageHours < 0) {
    throw new RangeError('ageHours must be null or a finite number >= 0');
  }
  for (const band of BANDS) {
    if (ageHours <= band.max) {
      return band;
    }
  }
  return QUIET;
}

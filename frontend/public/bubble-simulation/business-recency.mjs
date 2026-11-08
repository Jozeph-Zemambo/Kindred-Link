// Kindness-recency appearance for one business: wraps contributionAppearance
// with the catalog's recencyKnown flag. The API only timestamps acts of
// kindness (linked checkins); a business whose backend lacks the field is
// "unknown", one with the field but no act is "none". Ordinary scans never
// refresh it.
import { contributionAppearance } from './recency.mjs';

export function businessAppearance(b, clockHours) {
  const age = b.lastAt == null ? null
    : Math.max(0, clockHours - b.lastAt);
  const app = contributionAppearance(age);
  if (age !== null) {
    return { ...app, ageHours: age };
  }
  return {
    ...app,
    ageHours: null,
    label: b.recencyKnown === false
      ? 'Kindness recency unknown'
      : 'No recorded acts of kindness',
  };
}

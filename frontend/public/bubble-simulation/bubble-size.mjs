// Mirrors backend BusinessBubbleSize.diameterUnits exactly: same brackets and growth.
export function diameterUnits(visitors) {
  if (!Number.isSafeInteger(visitors) || visitors < 0) {
    throw new RangeError('visitors must be a non-negative safe integer');
  }
  if (visitors <= 50) {
    return 1 + visitors / 10;
  }
  let remaining = visitors - 50;
  let width = 50;
  let denominator = 20;
  let diameter = 6;
  while (remaining > width) {
    remaining -= width;
    diameter += 2.5;
    width *= 2;
    denominator *= 2;
  }
  return diameter + remaining / denominator;
}

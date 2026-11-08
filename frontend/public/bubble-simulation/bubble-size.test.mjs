import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diameterUnits } from './bubble-size.mjs';

const EPS = 1e-9;

const CASES = [
  [0, 1.0], [1, 1.1], [10, 2.0], [49, 5.9], [50, 6.0],
  [51, 6.05], [99, 8.45], [100, 8.5], [101, 8.525],
  [199, 10.975], [200, 11.0], [201, 11.0125], [399, 13.4875],
  [400, 13.5], [401, 13.50625], [500, 14.125], [800, 16.0],
  [1000, 16.625], [1600, 18.5], [2000, 19.125], [4000, 21.625],
  [8000, 24.125], [16000, 26.625],
];

for (const [visitors, expected] of CASES) {
  test(`diameterUnits(${visitors}) = ${expected}`, () => {
    assert.ok(Math.abs(diameterUnits(visitors) - expected) < EPS,
      `expected ${expected}, got ${diameterUnits(visitors)}`);
  });
}

for (const bad of [-1, NaN, Infinity, -Infinity, 1.5, -0.5, Number.MAX_SAFE_INTEGER + 1, '10', null, undefined]) {
  test(`rejects ${String(bad)}`, () => {
    assert.throws(() => diameterUnits(bad), RangeError);
  });
}

test('MAX_SAFE_INTEGER stays finite and monotonic', () => {
  const max = diameterUnits(Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isFinite(max), `expected finite diameter, got ${max}`);
  assert.ok(max >= diameterUnits(Number.MAX_SAFE_INTEGER - 1));
  assert.ok(max > diameterUnits(16000));
});

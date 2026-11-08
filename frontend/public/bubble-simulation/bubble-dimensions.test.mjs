import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bubbleDimensions } from './bubble-dimensions.mjs';

const CASES = [
  [0, 1, 20, 10],
  [50, 6, 120, 60],
  [100, 8.5, 170, 85],
  [200, 11, 220, 110],
  [400, 13.5, 270, 135],
];

for (const [visitors, units, diameter, radius] of CASES) {
  test(`visitors ${visitors} at 20 m/unit`, () => {
    const d = bubbleDimensions(visitors, 20);
    assert.equal(d.diameterUnits, units);
    assert.equal(d.diameterMeters, diameter);
    assert.equal(d.radiusMeters, radius);
  });
}

test('metersPerUnit 5 quarters the 20-scale size', () => {
  const d5 = bubbleDimensions(50, 5);
  const d20 = bubbleDimensions(50, 20);
  assert.equal(d5.diameterMeters, 30);
  assert.equal(d5.radiusMeters, 15);
  assert.equal(d20.diameterMeters, 120);
  assert.equal(d20.radiusMeters, 60);
  assert.equal(d5.diameterMeters, d20.diameterMeters / 4);
  assert.equal(d5.radiusMeters, d20.radiusMeters / 4);
});

test('metersPerUnit 40 doubles the geographic size', () => {
  const d20 = bubbleDimensions(50, 20);
  const d40 = bubbleDimensions(50, 40);
  assert.equal(d40.diameterMeters, d20.diameterMeters * 2);
  assert.equal(d40.radiusMeters, d20.radiusMeters * 2);
});

test('invalid metersPerUnit rejected', () => {
  for (const bad of [0, -1, NaN, Infinity, -Infinity, null, '20', undefined]) {
    assert.throws(() => bubbleDimensions(100, bad), RangeError, String(bad));
  }
});

test('visitor validation inherited from diameterUnits', () => {
  assert.throws(() => bubbleDimensions(-1, 20), RangeError);
  assert.throws(() => bubbleDimensions(1.5, 20), RangeError);
  assert.throws(() => bubbleDimensions(NaN, 20), RangeError);
});

test('huge visitors stay finite or throw', () => {
  const d = bubbleDimensions(Number.MAX_SAFE_INTEGER, 20);
  assert.ok(Number.isFinite(d.diameterMeters));
  assert.throws(() => bubbleDimensions(Number.MAX_SAFE_INTEGER, 1e308), RangeError);
});

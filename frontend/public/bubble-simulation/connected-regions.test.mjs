import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedRegions, regionAppearance } from './connected-regions.mjs';

const dist = (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng);
const disk = (id, lat, lng, r, lastAt = null) =>
  ({ id, lat, lng, radiusMeters: r, lastAt });
const ids = (groups) =>
  groups.map((g) => g.map((d) => d.id).sort().join(',')).sort();

test('empty and single', () => {
  assert.deepEqual(connectedRegions([], dist), []);
  const one = disk('a', 0, 0, 1);
  assert.deepEqual(connectedRegions([one], dist), [[one]]);
});

test('two separated / overlapping / tangent', () => {
  assert.equal(connectedRegions(
    [disk('a', 0, 0, 1), disk('b', 3, 0, 1)], dist).length, 2);
  assert.equal(connectedRegions(
    [disk('a', 0, 0, 1), disk('b', 1, 0, 1)], dist).length, 1);
  assert.equal(connectedRegions(
    [disk('a', 0, 0, 1), disk('b', 2, 0, 1)], dist).length, 1); // touching connects
});

test('transitive chain merges', () => {
  const g = connectedRegions(
    [disk('a', 0, 0, 1), disk('b', 1.5, 0, 1), disk('c', 3, 0, 1)], dist);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].map((d) => d.id), ['a', 'b', 'c']);
});

test('two disconnected pairs -> two components', () => {
  const g = connectedRegions([
    disk('a', 0, 0, 1), disk('b', 1, 0, 1),
    disk('c', 10, 0, 1), disk('d', 11, 0, 1),
  ], dist);
  assert.equal(g.length, 2);
});

test('containment and coincident disks connect', () => {
  assert.equal(connectedRegions(
    [disk('a', 0, 0, 5), disk('b', 1, 0, 1)], dist).length, 1);
  const g = connectedRegions(
    [disk('a', 0, 0, 1), disk('b', 0, 0, 1)], dist);
  assert.equal(g.length, 1);
  assert.equal(g[0].length, 2); // both members kept
});

test('input order does not change membership', () => {
  const a = disk('a', 0, 0, 1), b = disk('b', 1, 0, 1), c = disk('c', 9, 0, 1);
  assert.deepEqual(ids(connectedRegions([a, b, c], dist)),
    ids(connectedRegions([c, b, a], dist)));
});

test('shrinking a radius can split a component', () => {
  assert.equal(connectedRegions(
    [disk('a', 0, 0, 1), disk('b', 1, 0, 1)], dist).length, 1);
  assert.equal(connectedRegions(
    [disk('a', 0, 0, 0.4), disk('b', 1, 0, 0.4)], dist).length, 2);
});

test('regionAppearance: freshest member wins, null-only -> none', () => {
  const group = [disk('a', 0, 0, 1, null), disk('b', 0, 0, 1, -24),
    disk('c', 0, 0, 1, -0.25)];
  assert.equal(regionAppearance(group, 0).stage, 'fresh'); // min age 0.25h
  assert.equal(regionAppearance(group, 2).stage, 'recent'); // min age 2.25h
  assert.equal(regionAppearance([disk('x', 0, 0, 1), disk('y', 1, 0, 1)], 0).stage, 'none');
  // a member ahead of the clock (clock skew) clamps to age 0, staying fresh
  const skewed = regionAppearance([disk('f', 0, 0, 1, 5)], 0);
  assert.equal(skewed.stage, 'fresh');
  assert.equal(skewed.opacity, 1);
});

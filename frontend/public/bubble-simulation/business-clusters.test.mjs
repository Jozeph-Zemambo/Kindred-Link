import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterBusinesses, populationWeight } from './business-clusters.mjs';

// Identity projection at zoom 0, doubling per zoom level; Cartesian
// distance so "meters" in tests are just coordinate units.
const project = (lat, lng, zoom) => ({ x: lng * 2 ** zoom, y: lat * 2 ** zoom });
const unproject = ({ x, y }, zoom) => ({ lat: y / 2 ** zoom, lng: x / 2 ** zoom });
const distanceMeters = (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng);
const opts = (over = {}) =>
  ({ zoom: 0, project, unproject, distanceMeters, ...over });
// pixelDistance 1000 isolates the geographic fence from the pixel gate.
const geoOpts = (over = {}) => opts({ pixelDistance: 1000, ...over });
const disk = (id, lat, lng, r = 10, lastAt = null, visitors = 0) =>
  ({ id, lat, lng, radiusMeters: r, lastAt, name: id, visitors });

test('populationWeight brackets and validation', () => {
  for (const p of [0, 1, 4999, 5000]) {
    assert.ok(Math.abs(populationWeight(p) - 1) < 1e-12, String(p));
  }
  for (const p of [5001, 9999, 10000]) {
    assert.ok(Math.abs(populationWeight(p) - 1.2) < 1e-12, String(p));
  }
  for (const p of [10001, 14999, 15000]) {
    assert.ok(Math.abs(populationWeight(p) - 1.4) < 1e-12, String(p));
  }
  for (const p of [15001, 20000]) {
    assert.ok(Math.abs(populationWeight(p) - 1.6) < 1e-12, String(p));
  }
  assert.ok(Math.abs(populationWeight(20001) - 1.8) < 1e-12);
  for (const bad of [-1, NaN, Infinity, -Infinity, 1.5, '5000', null, undefined]) {
    assert.throws(() => populationWeight(bad), RangeError, String(bad));
  }
});

test('empty and single position preserved at 1.3x display radius', () => {
  assert.deepEqual(clusterBusinesses([], opts()), []);
  const g = clusterBusinesses([disk('a', 5, 7, 3)], opts());
  assert.equal(g.length, 1);
  assert.equal(g[0].id, 'a');
  assert.equal(g[0].lat, 5);
  assert.equal(g[0].lng, 7);
  assert.ok(Math.abs(g[0].radiusMeters - 3.9) < 1e-12); // 3 * 1.3
});

test('near points merge, far split, tangent merges', () => {
  assert.equal(clusterBusinesses(
    [disk('a', 0, 0), disk('b', 0, 32)], opts()).length, 1);
  assert.equal(clusterBusinesses(
    [disk('a', 0, 0), disk('b', 0, 65)], opts()).length, 2);
  assert.equal(clusterBusinesses(
    [disk('a', 0, 0), disk('b', 0, 64)], opts()).length, 1);
});

test('zoom splits the same geographic points', () => {
  const two = [disk('a', 0, 0), disk('b', 0, 40)];
  assert.equal(clusterBusinesses(two, opts({ zoom: 0 })).length, 1); // 40px
  assert.equal(clusterBusinesses(two, opts({ zoom: 1 })).length, 2); // 80px
});

test('coincident points split at splitZoom or when disabled', () => {
  const two = [disk('a', 0, 0), disk('b', 0, 0)];
  assert.equal(clusterBusinesses(two, opts({ zoom: 15 })).length, 1);
  assert.equal(clusterBusinesses(two, opts({ zoom: 16 })).length, 2);
  assert.equal(clusterBusinesses(two, opts({ zoom: 17 })).length, 2);
  assert.equal(clusterBusinesses(two, opts({ enabled: false })).length, 2);
});

test('stable cluster id and membership regardless of input order', () => {
  const mk = () => [disk('x', 0, 0), disk('y', 0, 10), disk('z', 0, 20)];
  const a = clusterBusinesses(mk(), opts());
  const b = clusterBusinesses(mk().reverse(), opts());
  assert.equal(a[0].id, b[0].id);
  assert.deepEqual(a[0].members.map((m) => m.id), b[0].members.map((m) => m.id));
});

test('population-weighted center, reach, display-scaled radius, latest lastAt', () => {
  const [g] = clusterBusinesses([
    disk('a', 0, 0, 3, -10, 1000),
    disk('b', 0, 100, 4, -0.25, 3000),
    disk('c', 0, 5, 1, null, 0),
  ], geoOpts());
  assert.equal(g.lng, (100 * 3000 + 5 * 0) / 4000); // = 75
  assert.equal(g.totalPopulation, 4000);
  assert.equal(g.weightMultiplier, 1);
  assert.equal(g.inclusionDistanceMeters, 200);
  assert.equal(g.radiusMeters, Math.hypot(3, 4, 1) * 3.6);
  assert.equal(g.lastAt, -0.25);
  assert.equal('visitors' in g, false); // no aggregated count field
});

test('zero-total groups fall back to the arithmetic-mean center', () => {
  const [g] = clusterBusinesses(
    [disk('a', 0, 0), disk('b', 0, 100)], geoOpts());
  assert.equal(g.lng, 50);
});

test('geographic fence edges: reach boundary is inclusive', () => {
  const pair = (bPos, v) =>
    [disk('a', 0, 0, 10, null, v), disk('b', 0, bPos, 10, null, v)];
  // total 2 -> weight 1 -> reach 200; center 200, member distance 200.
  assert.equal(clusterBusinesses(pair(400, 1), geoOpts()).length, 1);
  assert.equal(clusterBusinesses(pair(401, 1), geoOpts()).length, 2); // 200.5
  // total 10000 -> weight 1.2 -> reach 240; center 240.
  assert.equal(clusterBusinesses(pair(480, 5000), geoOpts()).length, 1);
  assert.equal(clusterBusinesses(pair(481, 5000), geoOpts()).length, 2);
  // total 15000 -> weight 1.4 -> reach 280; center 280.
  assert.equal(clusterBusinesses(pair(560, 7500), geoOpts()).length, 1);
  assert.equal(clusterBusinesses(pair(561, 7500), geoOpts()).length, 2);
});

test('pixel-near chain never merges into one runaway group', () => {
  const chain = [0, 150, 300, 450, 600, 750].map(
    (x, i) => disk(`d${i}`, 0, x, 10, null, 1));
  const groups = clusterBusinesses(chain, geoOpts());
  assert.notEqual(groups.length, 1);
  for (const g of groups) {
    if (g.members.length > 1) {
      for (const m of g.members) {
        assert.ok(distanceMeters(m, g) <= g.inclusionDistanceMeters + 1e-9,
          `${m.id} escaped reach of ${g.id}`);
      }
    }
  }
});

test('centroid shift re-validates every member', () => {
  const groups = clusterBusinesses([
    disk('a', 0, 0, 10, null, 1000),
    disk('b', 0, 300, 10, null, 1000),
    disk('c', 0, 340, 10, null, 3000),
  ], geoOpts());
  // A triple would center at 264 - 'a' would sit 264 > 200 away.
  assert.ok(groups.every((g) => g.members.length < 3));
});

test('population bracket alone can change membership', () => {
  const pair = (v) => [disk('a', 0, 0, 10, null, v), disk('b', 0, 440, 10, null, v)];
  // total 5000 -> reach 200, center 220 -> rejected.
  assert.equal(clusterBusinesses(pair(2500), geoOpts()).length, 2);
  // total 5002 -> reach 240, same positions and radii -> merged.
  assert.equal(clusterBusinesses(pair(2501), geoOpts()).length, 1);
});

test('cluster radius is 3.6 x sqrt(sum r^2); display scale only', () => {
  const [g] = clusterBusinesses(
    [disk('a', 0, 0, 3), disk('b', 0, 40, 4)], geoOpts());
  assert.ok(Math.abs(g.radiusMeters - 18) < 1e-12); // 3.6 * hypot(3,4)
  const [s] = clusterBusinesses([disk('s', 0, 500, 3)], geoOpts());
  assert.ok(Math.abs(s.radiusMeters - 3.9) < 1e-12); // single gets 1.3x
  // membership metadata is unaffected by the display scale
  const [w] = clusterBusinesses([
    disk('a', 0, 0, 3, null, 1000),
    disk('b', 0, 100, 4, null, 3000),
  ], geoOpts());
  assert.equal(w.lng, 75);
  assert.equal(w.inclusionDistanceMeters, 200);
});

test('quartering member radii quarters the cluster radius only', () => {
  const big = [disk('a', 0, 0, 80), disk('b', 0, 40, 60)];
  const small = big.map((d) => ({ ...d, radiusMeters: d.radiusMeters / 4 }));
  const gBig = clusterBusinesses(big, opts())[0];
  const gSmall = clusterBusinesses(small, opts())[0];
  assert.equal(gBig.id, gSmall.id); // membership unchanged at fixed zoom
  assert.equal(gSmall.radiusMeters, gBig.radiusMeters / 4);
});

test('individual 1.3x applies to singles only, never cluster inputs', () => {
  // visitors 50 -> native radius 15 -> display 19.5
  const [pt] = clusterBusinesses(
    [disk('pt', 0, 500, 15, null, 50)], geoOpts());
  assert.ok(Math.abs(pt.radiusMeters - 19.5) < 1e-12);
  // Cluster radius still 3.6 x hypot of BASE member radii; inputs untouched.
  const pair = [disk('a', 0, 0, 3), disk('b', 0, 40, 4)];
  const [g] = clusterBusinesses(pair, geoOpts());
  assert.equal(g.radiusMeters, 18);
  assert.equal(pair[0].radiusMeters, 3);
  assert.equal(pair[1].radiusMeters, 4);
  // zoom-16 and disabled singles carry the 1.3x display radius too
  const two = clusterBusinesses(
    [disk('x', 0, 0, 3), disk('y', 0, 0, 4)], opts({ zoom: 16 }));
  assert.ok(Math.abs(two[0].radiusMeters - 3.9) < 1e-12);
  assert.ok(Math.abs(two[1].radiusMeters - 5.2) < 1e-12);
  const off = clusterBusinesses(
    [disk('x', 0, 0, 3), disk('y', 0, 0, 4)], opts({ enabled: false }));
  assert.ok(Math.abs(off[0].radiusMeters - 3.9) < 1e-12);
  assert.ok(Math.abs(off[1].radiusMeters - 5.2) < 1e-12);
});

test('invalid or unsafe visitor totals rejected', () => {
  for (const v of [-1, 1.5, NaN, Infinity, '5', null, undefined]) {
    assert.throws(() => clusterBusinesses(
      [{ ...disk('a', 0, 0), visitors: v }], opts()), RangeError, String(v));
  }
  assert.throws(() => clusterBusinesses([
    disk('a', 0, 0, 10, null, Number.MAX_SAFE_INTEGER),
    disk('b', 0, 0, 10, null, 1),
  ], opts()), RangeError);
});

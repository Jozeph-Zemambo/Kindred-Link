import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBusinesses, normalizeApiBase, normalizeBusinesses }
  from './business-catalog.mjs';

const BASE = 'http://localhost:8080';
const CINNZEO = { id: 4, name: 'Cinnzeo Bakery Cafe', lat: 51.07923,
  lng: -114.127219, logoUrl: '/images/businesses/cinnzeo-bakery-cafe.png',
  visitors: 0, kindnessActs: 0, diameterUnits: 1.0 };
const LOTUS = { id: 5, name: 'Lotus Fine Indian Cuisine - Charleswood',
  lat: 51.087303, lng: -114.109781,
  logoUrl: '/images/businesses/lotus-charleswood.png',
  visitors: 0, kindnessActs: 0, diameterUnits: 1.0 };

test('provided catalog normalizes exactly', () => {
  const input = [CINNZEO, LOTUS];
  const out = normalizeBusinesses(input, BASE);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'business-4');
  assert.equal(out[0].backendId, 4);
  assert.equal(out[0].name, 'Cinnzeo Bakery Cafe');
  assert.equal(out[0].lat, 51.07923);
  assert.equal(out[0].lng, -114.127219);
  assert.equal(out[0].logoUrl,
    'http://localhost:8080/images/businesses/cinnzeo-bakery-cafe.png');
  assert.equal(out[1].id, 'business-5');
  assert.equal(out[1].logoUrl,
    'http://localhost:8080/images/businesses/lotus-charleswood.png');
  assert.equal(out[0].visitors, 0);
  assert.equal(out[0].kindnessActs, 0);
  // Field absent on this payload -> old backend -> unknown, not fabricated.
  assert.equal(out[0].recencyKnown, false);
  assert.equal(out[0].lastAt, null);
  assert.equal(out[0].locationLabel, 'Backend location - supplied coordinates');
  // inputs untouched
  assert.equal(CINNZEO.logoUrl, '/images/businesses/cinnzeo-bakery-cafe.png');
  assert.equal('backendId' in CINNZEO, false);
});

test('null logo stays null; absolute http logo preserved', () => {
  const [a] = normalizeBusinesses(
    [{ ...CINNZEO, id: 7, logoUrl: null }], BASE);
  assert.equal(a.logoUrl, null);
  const [b] = normalizeBusinesses(
    [{ ...CINNZEO, id: 8, logoUrl: 'https://cdn.example.com/x.png' }], BASE);
  assert.equal(b.logoUrl, 'https://cdn.example.com/x.png');
});

test('empty array ok; non-array and bad entries rejected', () => {
  assert.deepEqual(normalizeBusinesses([], BASE), []);
  for (const bad of [null, undefined, {}, 'x', 5, [null],
      [{ ...CINNZEO, id: 0 }], [{ ...CINNZEO, id: -1 }],
      [{ ...CINNZEO, id: '4' }], [{ ...CINNZEO, id: 1.5 }],
      [{ ...CINNZEO, id: Number.MAX_SAFE_INTEGER + 1 }],
      [{ ...CINNZEO, name: '' }], [{ ...CINNZEO, name: '  ' }],
      [{ ...CINNZEO, name: null }],
      [{ ...CINNZEO, lat: 91 }], [{ ...CINNZEO, lat: -91 }],
      [{ ...CINNZEO, lng: 181 }], [{ ...CINNZEO, lng: -181 }],
      [{ ...CINNZEO, lat: '51.0' }], [{ ...CINNZEO, lat: NaN }],
      [{ ...CINNZEO, visitors: -1 }], [{ ...CINNZEO, visitors: 1.5 }],
      [{ ...CINNZEO, visitors: '0' }], [{ ...CINNZEO, visitors: NaN }],
      [{ ...CINNZEO, logoUrl: 'javascript:alert(1)' }],
      [{ ...CINNZEO, logoUrl: 'data:image/png;base64,x' }],
      [{ ...CINNZEO, logoUrl: 5 }]]) {
    assert.throws(() => normalizeBusinesses(bad, BASE), Error, JSON.stringify(bad));
  }
});

test('duplicate ids rejected; large visitor counts pass through', () => {
  assert.throws(() => normalizeBusinesses([CINNZEO, { ...CINNZEO }], BASE));
  const [big] = normalizeBusinesses(
    [{ ...CINNZEO, visitors: 5_000_000 }], BASE);
  assert.equal(big.visitors, 5_000_000); // real counts are never clamped
});

test('api base must be http(s)', () => {
  assert.equal(normalizeApiBase('http://localhost:8080/'), 'http://localhost:8080');
  assert.equal(normalizeApiBase(' https://x.example.com/api '),
    'https://x.example.com/api');
  for (const bad of ['javascript:x', 'ftp://h', 'not a url']) {
    assert.throws(() => normalizeApiBase(bad), Error, bad);
  }
});

const NOW = Date.parse('2026-11-07T12:00:00Z');

test('lastKindnessAt parses to negative-hour lastAt at fixed now', () => {
  const opts = { nowMs: NOW };
  const [a] = normalizeBusinesses(
    [{ ...CINNZEO, id: 20, lastKindnessAt: '2026-11-07T11:30:00Z' }], BASE, opts);
  assert.equal(a.lastAt, -0.5);
  assert.equal(a.recencyKnown, true);
  assert.equal(a.lastKindnessAt, '2026-11-07T11:30:00Z');
  const [day] = normalizeBusinesses(
    [{ ...CINNZEO, id: 21, lastKindnessAt: '2026-11-06T12:00:00Z' }], BASE, opts);
  assert.equal(day.lastAt, -24);
  const [off] = normalizeBusinesses(
    [{ ...CINNZEO, id: 22, lastKindnessAt: '2026-11-07T13:30:00+02:00' }], BASE, opts);
  assert.equal(off.lastAt, -0.5);
  const [none] = normalizeBusinesses(
    [{ ...CINNZEO, id: 23, lastKindnessAt: null }], BASE, opts);
  assert.equal(none.lastAt, null);
  assert.equal(none.recencyKnown, true);
  const [old] = normalizeBusinesses([{ ...CINNZEO, id: 24 }], BASE, opts);
  assert.equal(old.recencyKnown, false);
  const [future] = normalizeBusinesses(
    [{ ...CINNZEO, id: 25, lastKindnessAt: '2026-11-07T13:00:00Z' }], BASE, opts);
  assert.ok(future.lastAt === 0); // clamped to now, never positive
  const [acts] = normalizeBusinesses(
    [{ ...CINNZEO, id: 26, kindnessActs: 7, opacity: 0.8 }], BASE, opts);
  assert.equal(acts.kindnessActs, 7);
  for (const bad of [{ ...CINNZEO, id: 30, lastKindnessAt: 5 },
      { ...CINNZEO, id: 31, lastKindnessAt: '2026-11-07T11:30:00' },
      { ...CINNZEO, id: 32, lastKindnessAt: 'not a date' },
      { ...CINNZEO, id: 33, lastKindnessAt: '2026-13-40T99:99:99Z' },
      { ...CINNZEO, id: 34, kindnessActs: -1 },
      { ...CINNZEO, id: 35, opacity: 1.5 },
      { ...CINNZEO, id: 36, opacity: NaN },
      { ...CINNZEO, id: 37, opacity: Infinity }]) {
    assert.throws(() => normalizeBusinesses([bad], BASE, opts),
      Error, JSON.stringify(bad));
  }
});

const okJson = (body) => Promise.resolve(
  { ok: true, status: 200, json: () => Promise.resolve(body) });

test('fetchBusinesses: success, http error, bad json, network, timeout', async () => {
  const got = await fetchBusinesses(BASE, { fetchImpl: () => okJson([CINNZEO]) });
  assert.equal(got[0].id, 'business-4');

  const http500 = () => Promise.resolve(
    { ok: false, status: 500, json: () => Promise.resolve({}) });
  await assert.rejects(fetchBusinesses(BASE, { fetchImpl: http500 }),
    /HTTP 500/);

  const badJson = () => Promise.resolve(
    { ok: true, status: 200, json: () => Promise.reject(new SyntaxError('x')) });
  await assert.rejects(fetchBusinesses(BASE, { fetchImpl: badJson }),
    /non-JSON/);

  const dead = () => Promise.reject(new TypeError('fetch failed'));
  await assert.rejects(fetchBusinesses(BASE, { fetchImpl: dead }),
    /unreachable/);

  const hang = (url, { signal }) => new Promise((_, rej) => {
    signal.addEventListener('abort', () =>
      rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  await assert.rejects(
    fetchBusinesses(BASE, { fetchImpl: hang, timeoutMs: 5 }), /timed out/);

  // An AbortError raised while reading the body is still a timeout,
  // not a non-JSON response.
  const abortJson = () => Promise.resolve(
    { ok: true, status: 200, json: () => Promise.reject(
      Object.assign(new Error('aborted'), { name: 'AbortError' })) });
  await assert.rejects(fetchBusinesses(BASE, { fetchImpl: abortJson }),
    /timed out/);

  const invalid = () => okJson([{ ...CINNZEO, lat: 999 }]);
  await assert.rejects(fetchBusinesses(BASE, { fetchImpl: invalid }),
    /Invalid business catalog data/);
});

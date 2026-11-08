import test from 'node:test';
import assert from 'node:assert/strict';
import { businessAppearance } from './business-recency.mjs';

const b = (over) => ({ lastAt: null, recencyKnown: true, ...over });

test('recorded act drives the age band and opacity', () => {
  const fresh = businessAppearance(b({ lastAt: -0.5 }), 0);
  assert.equal(fresh.stage, 'fresh');
  assert.equal(fresh.opacity, 1.0);
  assert.equal(fresh.ageHours, 0.5);
  assert.equal(fresh.label, 'Within 1 hour');
  assert.equal(businessAppearance(b({ lastAt: -30 }), 0).opacity, 0.5);
  assert.equal(businessAppearance(b({ lastAt: -300 }), 0).opacity, 0.25);
});

test('future-dated acts clamp to age 0, never negative', () => {
  const app = businessAppearance(b({ lastAt: 5 }), 0);
  assert.equal(app.ageHours, 0);
  assert.equal(app.opacity, 1.0);
});

test('field reported but no act -> known "none"', () => {
  const app = businessAppearance(b({ lastAt: null }), 0);
  assert.equal(app.ageHours, null);
  assert.equal(app.label, 'No recorded acts of kindness');
  assert.equal(app.opacity, 0.25);
});

test('field absent on old backend -> "unknown", still 0.25', () => {
  const app = businessAppearance(
    b({ lastAt: null, recencyKnown: false }), 0);
  assert.equal(app.label, 'Kindness recency unknown');
  assert.equal(app.opacity, 0.25);
});

test('zero visitors can still carry a recorded act', () => {
  const app = businessAppearance(
    b({ lastAt: -0.25, visitors: 0 }), 0);
  assert.equal(app.opacity, 1.0);
});

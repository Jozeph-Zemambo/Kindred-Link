import test from 'node:test';
import assert from 'node:assert/strict';
import { contributionAppearance } from './recency.mjs';

test('null -> none', () => {
  assert.equal(contributionAppearance(null).stage, 'none');
  assert.equal(contributionAppearance(null).label, 'No contributions');
});

test('fresh: 0 through 1 hour inclusive', () => {
  assert.equal(contributionAppearance(0).stage, 'fresh');
  assert.equal(contributionAppearance(0.25).stage, 'fresh');
  assert.equal(contributionAppearance(1).stage, 'fresh');
});

test('recent: just over 1 hour through 24 inclusive', () => {
  assert.equal(contributionAppearance(1.0001).stage, 'recent');
  assert.equal(contributionAppearance(24).stage, 'recent');
});

test('cooling: just over 24 hours through 168 inclusive', () => {
  assert.equal(contributionAppearance(24.0001).stage, 'cooling');
  assert.equal(contributionAppearance(168).stage, 'cooling');
});

test('quiet: over 168 hours', () => {
  assert.equal(contributionAppearance(168.0001).stage, 'quiet');
  assert.equal(contributionAppearance(240).stage, 'quiet');
});

test('opacity bands: 1.0 / 0.8 / 0.5 / 0.25', () => {
  assert.equal(contributionAppearance(null).opacity, 0.25);
  assert.equal(contributionAppearance(0).opacity, 1.0);
  assert.equal(contributionAppearance(1).opacity, 1.0);
  assert.equal(contributionAppearance(1.0001).opacity, 0.8);
  assert.equal(contributionAppearance(24).opacity, 0.8);
  assert.equal(contributionAppearance(24.0001).opacity, 0.5);
  assert.equal(contributionAppearance(168).opacity, 0.5);
  assert.equal(contributionAppearance(168.0001).opacity, 0.25);
});

test('rejects invalid input', () => {
  for (const bad of [-1, NaN, Infinity, -Infinity, '2', undefined, false]) {
    assert.throws(() => contributionAppearance(bad), RangeError);
  }
});

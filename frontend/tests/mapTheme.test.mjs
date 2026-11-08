import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';

// Loads the real theme.ts for each platform (fresh module state per load) and inspects the
// Google style rules + BASE_MAP props. No renderer - this checks the style payload only.
const THEME = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'src', 'map', 'theme.ts');

function loadTheme(os) {
  const code = fs.readFileSync(THEME, 'utf8');
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: THEME,
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, () => ({ Platform: { OS: os } }));
  return mod.exports;
}

const style = (base, featureType, elementType) =>
  base.customMapStyle.find((r) => r.featureType === featureType && r.elementType === elementType);
const hasRule = (base, featureType) => base.customMapStyle.some((r) => r.featureType === featureType);

const android = loadTheme('android');
const ios = loadTheme('ios');
const CREAM = android.palette.cream;

test('Android BASE_MAP: standard map type, buildings and toolbar off', () => {
  assert.equal(android.BASE_MAP.mapType, 'standard');
  assert.equal(android.BASE_MAP.showsBuildings, false);
  assert.equal(android.BASE_MAP.toolbarEnabled, false);
  assert.ok(Array.isArray(android.BASE_MAP.customMapStyle));
});

test('Android style: flat cream land, overlay surfaces hidden', () => {
  const a = android.BASE_MAP;
  assert.deepEqual(style(a, 'landscape', 'geometry').stylers, [{ color: CREAM }]);
  assert.deepEqual(style(a, 'landscape.man_made', 'geometry').stylers, [{ visibility: 'off' }], 'built surface hidden, not just recoloured');
  assert.deepEqual(style(a, 'landscape.natural', 'geometry.fill').stylers, [{ color: CREAM }]);
  assert.deepEqual(style(a, 'landscape.natural.landcover', 'geometry').stylers, [{ visibility: 'off' }]);
  assert.deepEqual(style(a, 'landscape.natural.terrain', 'geometry').stylers, [{ visibility: 'off' }]);
  assert.ok(hasRule(a, 'poi'), 'poi hidden');
  assert.ok(!hasRule(a, 'poi.park'), 'parks inherit the poi-off rule - no park tint');
  for (const r of a.customMapStyle.filter((r) => r.featureType?.startsWith('landscape'))) {
    assert.ok(r.elementType && r.stylers.every((s) => s.visibility !== 'on'), `no landscape rule turns anything on: ${JSON.stringify(r)}`);
  }
});

test('Android style: palette base, icons/transit off, roads water labels kept', () => {
  const a = android.BASE_MAP;
  assert.deepEqual(a.customMapStyle.find((r) => !r.featureType && r.elementType === 'geometry').stylers, [{ color: CREAM }]);
  assert.deepEqual(a.customMapStyle.find((r) => r.elementType === 'labels.icon').stylers, [{ visibility: 'off' }]);
  assert.deepEqual(style(a, 'transit').stylers, [{ visibility: 'off' }]);
  assert.deepEqual(style(a, 'road', 'geometry').stylers, [{ color: android.palette.white }]);
  assert.equal(style(a, 'road.highway', 'geometry').stylers[0].color, '#F3E6C6');
  assert.equal(style(a, 'water', 'geometry').stylers[0].color, '#CFE3F3');
  assert.deepEqual(a.customMapStyle.find((r) => r.elementType === 'labels.text.fill').stylers, [{ color: android.palette.navy }]);
});

test('iOS BASE_MAP unchanged: muted standard, no Google style rules', () => {
  assert.deepEqual(ios.BASE_MAP, {
    mapType: 'mutedStandard',
    showsPointsOfInterests: false,
    showsBuildings: false,
    userInterfaceStyle: 'light',
  });
  assert.equal(ios.BASE_MAP.customMapStyle, undefined);
});

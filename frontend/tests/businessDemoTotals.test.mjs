import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

// Verifies the user-provided demo display totals: exact figures applied by name for
// presentation only - API objects never mutated, non-matching businesses untouched.
const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const src = (p) => path.join(root, 'src', p);

function loadTs(file, stubs) {
  const code = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, (id) => {
    if (id in stubs) return stubs[id];
    throw new Error(`unexpected require: ${id} (from ${path.basename(file)})`);
  });
  return mod.exports;
}

const allText = (el) => (el == null || typeof el === 'boolean') ? '' : (typeof el === 'string' || typeof el === 'number') ? String(el) : Array.isArray(el) ? el.map(allText).join('') : typeof el.type === 'function' ? allText(el.type(el.props)) : allText(el.props?.children);

const { applyBusinessDemoTotals } = loadTs(src('api/businessDemoTotals.ts'), {});

const CINNZEO = { id: 1, name: 'Cinnzeo Bakery Cafe', logoUrl: '/logos/cinnzeo.png', lat: 51.08, lng: -114.13, visitors: 0, kindnessActs: 0, diameterUnits: 1, lastKindnessAt: null, opacity: 1 };
const LOTUS = { id: 2, name: 'Lotus Fine Indian Cuisine - Charleswood', logoUrl: '/logos/lotus.png', lat: 49.85, lng: -97.31, visitors: 0, kindnessActs: 0, diameterUnits: 1 };
const OTHER = { id: 9, name: 'Cafe Kind', lat: 0, lng: 10, visitors: 5, kindnessActs: 2, diameterUnits: 4 };

test('applyBusinessDemoTotals: exact user-provided figures for both named businesses', () => {
  const c = applyBusinessDemoTotals(CINNZEO);
  assert.equal(c.visitors, 312);
  assert.equal(c.kindnessActs, 2500);
  assert.equal(c.diameterUnits, 12.4);
  assert.equal(c.demoTotals, true);
  const l = applyBusinessDemoTotals(LOTUS);
  assert.equal(l.visitors, 242);
  assert.equal(l.kindnessActs, 1847);
  assert.equal(l.diameterUnits, 11.525);
  assert.equal(l.demoTotals, true);
});

test('applyBusinessDemoTotals: name matching survives case/whitespace and a changed id', () => {
  const renamed = applyBusinessDemoTotals({ ...CINNZEO, id: 77, name: '  CINNZEO BAKERY CAFE ' });
  assert.equal(renamed.id, 77, 'backend id untouched');
  assert.equal(renamed.diameterUnits, 12.4);
  assert.equal(renamed.demoTotals, true);
});

test('applyBusinessDemoTotals: unrelated business returns the same object, input not mutated', () => {
  const before = { ...OTHER };
  const out = applyBusinessDemoTotals(OTHER);
  assert.equal(out, OTHER, 'same identity for non-matches');
  assert.deepEqual(OTHER, before, 'input object unmodified');
  const c = applyBusinessDemoTotals(CINNZEO);
  assert.equal(CINNZEO.visitors, 0, 'API object never mutated');
  assert.equal(c.lat, CINNZEO.lat);
  assert.equal(c.logoUrl, CINNZEO.logoUrl);
  assert.equal(c.lastKindnessAt, CINNZEO.lastKindnessAt, 'recency fields preserved');
});

// --- BusinessSheet demo rendering ---

const RN = { Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (s) => s }, Text: 'Text', View: 'View' };
const SHEET = path.join(root, 'src/map/BusinessSheet.tsx');
const sheetStubs = {
  react: {},
  'react/jsx-runtime': jsxRuntime,
  'react-native': RN,
  'expo-image': { Image: 'Image' },
  './BusinessBubble': { logoSource: () => ({ uri: 'x' }) },
  './SidePanel': { SidePanel: (p) => [p.children] },
  './theme': { palette: { cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', navy: '#303A59', muted: '#6C748A' }, OUTLINE: '#1C2030' },
};

test('BusinessSheet: demo business shows exact totals, without a Demo totals label', () => {
  const { BusinessSheet } = loadTs(SHEET, sheetStubs);
  const demo = applyBusinessDemoTotals(CINNZEO);
  const text = allText(BusinessSheet({ business: demo, onClose() {} }));
  assert.ok(text.includes('Cinnzeo Bakery Cafe'));
  assert.ok(!text.includes('Demo totals'), 'label removed for the live demo (figures stay)');
  assert.ok(text.includes('312'), 'exact visitor figure, not rounded');
  assert.ok(text.includes('2,500'), 'exact acts figure with thousands separator');
  assert.ok(!text.includes('300+') && !text.includes('2,400+'), 'no roundedPlus for demo totals');
  const lotus = allText(BusinessSheet({ business: applyBusinessDemoTotals(LOTUS), onClose() {} }));
  assert.ok(lotus.includes('242'));
  assert.ok(lotus.includes('1,847'));
  assert.ok(!lotus.includes('200+') && !lotus.includes('1,800+'));
});

test('BusinessSheet: demo acts still show when paidForwardCents is present; non-demo unchanged', () => {
  const { BusinessSheet, roundedPlus } = loadTs(SHEET, sheetStubs);
  const withMoney = allText(BusinessSheet({ business: { ...applyBusinessDemoTotals(CINNZEO), paidForwardCents: 50000 }, onClose() {} }));
  assert.ok(withMoney.includes('2,500'), 'demo acts win over the optional money figure');
  assert.ok(!withMoney.includes('$500'), 'money branch hidden for demo totals');
  const plain = allText(BusinessSheet({ business: { ...OTHER, visitors: 312 }, onClose() {} }));
  assert.ok(plain.includes(roundedPlus(312)), 'non-demo keeps roundedPlus');
  assert.ok(!plain.includes('Demo totals'), 'no label for real data');
});

// --- Bubble size uses the demo diameter ---

test('demo totals feed the existing bubbleSize growth (Cinnzeo > Lotus > live zero)', () => {
  const BUBBLE = path.join(root, 'src/map/BusinessBubble.tsx');
  const { bubbleSize } = loadTs(BUBBLE, {
    react: { useMemo: (fn) => fn() },
    'react/jsx-runtime': jsxRuntime,
    'react-native': RN,
    'expo-image': { Image: 'Image' },
    './assetUrl': { assetUrl: (u) => u },
    './demoLogos': { demoLogoFor: () => undefined },
    './theme': sheetStubs['./theme'],
  });
  const c = applyBusinessDemoTotals(CINNZEO);
  const l = applyBusinessDemoTotals(LOTUS);
  assert.ok(bubbleSize(c.diameterUnits) > bubbleSize(l.diameterUnits), 'Cinnzeo bubble bigger than Lotus');
  assert.ok(bubbleSize(l.diameterUnits) > bubbleSize(1), 'both demo bubbles bigger than a live 0-visitor unit bubble');
  assert.equal(bubbleSize(c.diameterUnits), Math.round(30 + (12.4 - 1) * 3.8));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

// Renders the real HomeScreen (src/app/index.tsx) in isolation: transpile + stub imports,
// inspect the element tree. Map components/status stay as inspectable markers.
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

function flatten(el, out = []) {
  if (el == null || typeof el === 'boolean' || typeof el === 'string' || typeof el === 'number') return out;
  if (Array.isArray(el)) { el.forEach((c) => flatten(c, out)); return out; }
  if (typeof el.type === 'function') { flatten(el.type(el.props), out); return out; }
  out.push(el);
  flatten(el.props?.children, out);
  return out;
}
const findAll = (tree, type) => flatten(tree).filter((e) => e.type === type);
const findOne = (tree, type) => findAll(tree, type)[0];
const allText = (el) => (el == null || typeof el === 'boolean') ? '' : (typeof el === 'string' || typeof el === 'number') ? String(el) : Array.isArray(el) ? el.map(allText).join('') : typeof el.type === 'function' ? allText(el.type(el.props)) : allText(el.props?.children);

// Returns the ancestor chain (outermost first) ending at the element matching `pred`.
function findPath(node, pred, trail = []) {
  if (node == null || typeof node !== 'object' || Array.isArray(node)) return null;
  const next = [...trail, node];
  if (pred(node)) return next;
  const kids = node.props?.children;
  for (const child of Array.isArray(kids) ? kids : [kids]) {
    const hit = findPath(child, pred, next);
    if (hit) return hit;
  }
  return null;
}

const BIZ = { id: 1, name: 'Cinnzeo Bakery Cafe', logoUrl: '/logos/c.png', lat: 51.08, lng: -114.13, visitors: 0, kindnessActs: 0, diameterUnits: 1 };
const PIN = { id: 11, chainId: 2, lat: 51.05, lng: -114.06, openSlots: 1 };
const DATA = { latest: null, nodes: [], allNodes: [], mine: [], trees: [], nearbyMe: { lat: 51, lng: -114 }, nearbyPins: [PIN] };

function makeCtx() {
  const ctx = { nav: [], bizReloads: 0, stateIdx: 0 };
  ctx.react = {
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: () => ({ current: null }),
  };
  const biz = { businesses: [BIZ], error: null, loading: false, reload: () => ctx.bizReloads++ };
  const stubs = {
    react: ctx.react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': {
      Alert: { alert() {} },
      Pressable: 'Pressable',
      ScrollView: 'ScrollView',
      StyleSheet: { create: (s) => s },
      Text: 'Text',
      useWindowDimensions: () => ({ width: 390, height: 844 }),
      View: 'View',
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { router: { push: (to) => ctx.nav.push(to) } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } },
    '@clerk/expo': { useUser: () => ({ user: { firstName: 'Sam' } }) },
    '@/api/client': { getChain: async () => ({ nodes: [] }), listMine: async () => [], listNearby: async () => [] },
    '@/api/config': { USE_MOCKS: false },
    '@/api/useLoad': { useLoad: () => ({ data: DATA, error: null, loading: false, reload: () => {} }) },
    '@/api/useBusinesses': { useBusinesses: () => biz },
    '@/auth/clerk': { isClerkConfigured: true },
    '@/components/BusinessMapStatus': { BusinessMapStatus: 'BusinessMapStatus' },
    '@/components/LoadState': { LoadState: 'LoadState' },
    '@/map': { descendants: () => [], getMyLocation: async () => ({ lat: 51, lng: -114 }), isFindable: () => true, openPinsToShow: (pins) => pins, JoinMap: 'JoinMap' },
  };
  const screen = loadTs(src('app/index.tsx'), stubs).default;
  return { ctx, biz, screen };
}

test('home map card: live businesses + all three map callbacks navigate to explore', () => {
  const { ctx, screen } = makeCtx();
  const tree = screen();
  const map = findOne(tree, 'JoinMap');
  assert.equal(map.props.businesses[0], BIZ, 'live catalog reaches the home preview');
  assert.deepEqual(map.props.pins, [PIN]);
  for (const cb of ['onPinPress', 'onMapPress', 'onBusinessPress']) {
    assert.equal(typeof map.props[cb], 'function', `${cb} wired`);
    map.props[cb]({});
  }
  assert.deepEqual(ctx.nav, ['/explore', '/explore', '/explore'], 'pin/map/business taps all navigate to explore');
});

test('home map card: plain View wrapper (no Pressable swallowing gestures), overlay is pointer-transparent', () => {
  const { screen } = makeCtx();
  const tree = screen();
  const pathToMap = findPath(tree, (e) => e.type === 'JoinMap');
  assert.ok(pathToMap, 'JoinMap in the tree');
  const mapCard = pathToMap[pathToMap.length - 3]; // mapCard > mapBody > JoinMap
  assert.equal(mapCard.type, 'View', 'map card is a View, not a tap-capturing Pressable');
  assert.equal(mapCard.props.onPress, undefined);
  const overlay = findAll(tree, 'View').find((v) => v.props.pointerEvents === 'none');
  assert.ok(overlay, 'overlay must not intercept map touches');
  assert.ok(allText(overlay).includes('Nearby kindness'));
});

test('home map card: business retry hits the catalog reload, not navigation', () => {
  const { ctx, biz, screen } = makeCtx();
  const tree = screen();
  const status = findOne(tree, 'BusinessMapStatus');
  assert.equal(status.props.error, null);
  assert.equal(status.props.onRetry, biz.reload);
  status.props.onRetry();
  assert.equal(ctx.bizReloads, 1);
  assert.deepEqual(ctx.nav, [], 'retry must not navigate');
});

test('home header keeps the Clerk display name + profile initial', () => {
  const { screen } = makeCtx();
  const tree = screen();
  const texts = flatten(tree).filter((e) => e.type === 'Text').map((t) => allText(t));
  assert.ok(texts.includes('Sam'), 'ClerkDisplayName renders the first name');
  assert.ok(texts.includes('S'), 'ClerkProfileInitial renders the initial');
});

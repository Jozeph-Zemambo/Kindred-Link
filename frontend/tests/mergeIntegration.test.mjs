import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

// Merge regressions: upstream's draw-in camera plan (main) combined with the business
// catalog hook + bubble scale (backend/business-catalog-geocoding). Same transpile-and-stub
// harness as businessMaps, plus the real pure graph module for hopsFrom/edges.
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

const RN = {
  Alert: { alert() {} },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (s) => s, absoluteFill: { position: 'absolute' } },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
};
const PALETTE = { cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', tangerine: '#F49A68', navy: '#303A59', muted: '#6C748A', line: '#E9DEC4', white: '#FFFFFF' };
const THEME = { palette: PALETTE, OUTLINE: '#1C2030', NODE_FILLS: [PALETTE.yellow, PALETTE.blue, PALETTE.tangerine, PALETTE.cream], BASE_MAP: {}, mix: (a) => a, textOn: () => PALETTE.navy };
const MAPS = { __esModule: true, default: 'MapView', Marker: 'Marker', Polyline: 'Polyline' };

const BIZ2 = { id: 4, name: 'Far Away', logoUrl: null, lat: -40, lng: 150, visitors: 1, kindnessActs: 1, diameterUnits: 1 };
const NODE = { id: 11, chainId: 2, parentId: null, depth: 0, description: 'act', lat: 51.05, lng: -114.06, openSlots: 1, createdAt: '', mine: false };
const NODE2 = { id: 12, chainId: 2, parentId: 11, depth: 1, description: 'act2', lat: 51.06, lng: -114.05, openSlots: 1, createdAt: '', mine: true };

// State order in merged ChainMap: mapReady, open, openBusiness, frontier.
// useRef(null) yields the shared mapRef (its animateToRegion/fitToCoordinates record).
function makeCtx() {
  const ctx = { effects: [], focusEffects: [], canned: new Map(), statePreset: [], stateIdx: 0, setCalls: [], scaleCalls: [], animations: [] };
  ctx.mapRef = {
    animateToRegion(...a) { ctx.animations.push(['region', a]); },
    fitToCoordinates(...a) { ctx.animations.push(['fit', a]); },
  };
  ctx.bubbleScale = (mapRef) => ({
    mapScale: 1.5,
    onMapReady: () => ctx.scaleCalls.push(['ready', mapRef]),
    onLayout: (e) => ctx.scaleCalls.push(['layout', e]),
    onRegionChange: (r) => ctx.scaleCalls.push(['change', r]),
    onRegionChangeComplete: (r) => ctx.scaleCalls.push(['complete', r]),
  });
  ctx.useLoad = (load, deps) => { load?.(); const hit = ctx.canned.get(deps?.[0]); return { data: hit?.data ?? null, error: hit?.error ?? null, loading: hit?.loading ?? false, reload: hit?.reload ?? (() => {}) }; };
  ctx.react = {
    useState: (init) => { const i = ctx.stateIdx++; return [i < ctx.statePreset.length ? ctx.statePreset[i] : (typeof init === 'function' ? init() : init), (v) => ctx.setCalls.push([i, v])]; },
    useEffect: (fn) => ctx.effects.push(fn),
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (init) => ({ current: init === null ? ctx.mapRef : init }),
  };
  return ctx;
}

const bizCalls = [];
const bizCanned = new Map();
const graphMod = loadTs(src('map/graph.ts'), {});
const demoTotalsMod = loadTs(src('api/businessDemoTotals.ts'), {});
const useBusinessesMod = loadTs(src('api/useBusinesses.ts'), {
  react: { useMemo: (fn) => fn() },
  './businessDemoTotals': demoTotalsMod,
  './client': { listBusinesses: async () => bizCalls.push('listBusinesses') && [] },
  './useLoad': { useLoad: (load, deps) => { load?.(); const hit = bizCanned.get(deps?.[0]); return { data: hit?.data ?? null, error: hit?.error ?? null, loading: hit?.loading ?? false, reload: hit?.reload ?? (() => {}) }; } },
});

const CHAIN_MAP = path.join(root, 'src/map/ChainMap.tsx');
const chainStubs = (ctx) => ({
  react: ctx.react,
  'react/jsx-runtime': jsxRuntime,
  'react-native': RN,
  'react-native-maps': MAPS,
  '@/api/config': { USE_MOCKS: false },
  './BusinessBubble': { BusinessBubble: 'BusinessBubble' },
  './BusinessSheet': { BusinessSheet: 'BusinessSheet' },
  './NodeDetailModal': { NodeDetailModal: 'NodeDetailModal' },
  './NodeDot': { NodeDot: 'NodeDot' },
  './graph': { edges: graphMod.edges, hopsFrom: graphMod.hopsFrom },
  './theme': THEME,
  './useBusinessBubbleScale': { useBusinessBubbleScale: ctx.bubbleScale },
});

test('ChainMap drawIn: starts close on the latest "mine" node, both ready callbacks, pullback frames only the chain', () => {
  const ctx = makeCtx();
  ctx.statePreset = [true]; // mapReady already true so the captured effect animates
  const { ChainMap } = loadTs(CHAIN_MAP, chainStubs(ctx));
  const tree = ChainMap({ nodes: [NODE, NODE2], businesses: [BIZ2], drawIn: true });

  const map = findOne(tree, 'MapView');
  assert.equal(map.props.initialRegion.latitude, 51.06, 'draw-in opens on the start node, not the catalog');
  assert.equal(map.props.initialRegion.longitude, -114.05);
  assert.equal(map.props.initialRegion.latitudeDelta, 0.0012, 'close zoom, not a fit');
  // Hop gating with the real hopsFrom: NODE2 (hop 0) shows at frontier 0, NODE (hop 1) waits.
  const nodeMarkers = findAll(tree, 'Marker').filter((m) => !m.props.title);
  assert.equal(nodeMarkers.length, 1, 'only the start node is drawn at frontier 0');
  assert.equal(nodeMarkers[0].props.coordinate.latitude, 51.06);
  assert.equal(findAll(tree, 'Marker').filter((m) => m.props.title).length, 0, 'businesses wait until the tree has drawn itself in');

  map.props.onMapReady();
  assert.deepEqual(ctx.setCalls[0], [0, true], 'mapReady state set');
  assert.equal(ctx.scaleCalls[0][0], 'ready', 'bubble scale measures on ready too');
  assert.deepEqual(ctx.animations, [], 'no premature fit while the draw-in plan owns the camera');

  // Run the real draw effect with controllable timers: close-up first, then the pullback.
  const timers = [], rafs = [];
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => (timers.push(fn), 1);
  globalThis.requestAnimationFrame = (fn) => (rafs.push(fn), 1);
  globalThis.cancelAnimationFrame = () => {};
  try {
    const cleanup = ctx.effects[0]();
    assert.equal(ctx.animations.length, 1, 'draw-in snaps to the start node');
    assert.deepEqual(ctx.animations[0], ['region', [{ latitude: 51.06, longitude: -114.05, latitudeDelta: 0.0012, longitudeDelta: 0.0012 }, 0]]);
    timers[0]();
    assert.equal(ctx.animations.length, 2, 'pullback animates once the delay passes');
    const pullback = ctx.animations[1][1][0];
    assert.ok(Math.abs(pullback.longitude - -114.055) < 0.01, 'pullback frames the chain, not the far business');
    assert.ok(pullback.latitudeDelta < 0.1, 'chain-sized region (a far business would blow the delta up)');
    assert.equal(rafs.length, 1, 'frontier sweep scheduled');
    cleanup?.();
  } finally {
    globalThis.setTimeout = realTimeout;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  }
});

function screenStubs(ctx, params, extraClient, mapStub) {
  return {
    react: ctx.react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': RN,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { router: { push() {}, replace() {} }, useLocalSearchParams: () => params, useFocusEffect: (cb) => ctx.focusEffects.push(cb) },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } },
    'expo-image-picker': { launchCameraAsync: async () => ({ canceled: true }), launchImageLibraryAsync: async () => ({ canceled: true }) },
    '@/api/client': { claimNode: async () => ({}), continueNode: async () => ({}), createNode: async () => ({}), getNode: async () => ({}), getChain: async () => ({ nodes: [] }), listMine: async () => [NODE], listNearby: async () => [NODE], uploadPhoto: async () => ({ id: 1 }), listBusinesses: async () => bizCalls.push('direct-call') && [], ...extraClient },
    '@/api/useLoad': { useLoad: ctx.useLoad },
    '@/api/useBusinesses': useBusinessesMod,
    '@/components/BusinessMapStatus': { BusinessMapStatus: 'BusinessMapStatus' },
    '@/components/LoadState': { LoadState: 'LoadState' },
    '@/map': { getMyLocation: async () => ({ lat: 51.05, lng: -114.06 }), requireMyLocation: async () => ({ lat: 51.05, lng: -114.06 }), descendants: (ns) => ns, ...mapStub },
  };
}

test('trees screen: focus reload + drawIn + businesses + latest-act card coexist', () => {
  const ctx = makeCtx();
  ctx.canned.set(NaN, { data: { latest: NODE, tree: { nodes: [NODE, NODE2] } } });
  bizCanned.clear();
  bizCanned.set(undefined, { data: [BIZ2] });
  const screen = loadTs(src('app/trees.tsx'), screenStubs(ctx, {}, {}, { ChainMap: 'ChainMap' })).default;
  const tree = screen();
  assert.equal(ctx.focusEffects.length, 1, 'focus reload from main still registered');
  const map = findOne(tree, 'ChainMap');
  assert.equal(map.props.drawIn, true, 'draw-in reaches the map before any view switch');
  assert.equal(map.props.businesses[0], BIZ2, 'catalog reaches the map beside it');
  assert.equal(map.props.nodes.length, 2);
  assert.ok(allText(tree).includes('YOUR LATEST ACT'), 'main’s yellow latest-act card preserved');
  assert.ok(findOne(tree, 'BusinessMapStatus'), 'catalog status overlay preserved');
});

test('explore screen: only useBusinesses loads the catalog, not the screen loader', async () => {
  const ctx = makeCtx();
  ctx.statePreset = [null, true]; // storedClaim, claimLoaded
  ctx.canned.set(true, { data: { mode: 'explore', me: { lat: 51.05, lng: -114.06 }, pins: [NODE] } });
  bizCalls.length = 0;
  bizCanned.clear();
  bizCanned.set(undefined, { data: [BIZ2] });
  const screen = loadTs(src('app/explore.tsx'), screenStubs(ctx, {}, {}, { JoinMap: 'JoinMap', LocationPicker: 'LocationPicker' })).default;
  screen();
  await new Promise((r) => setImmediate(r)); // flush the loader promise chain
  assert.deepEqual(bizCalls, ['listBusinesses'], 'one catalog request from the hook; the screen loader stays off listBusinesses');
});

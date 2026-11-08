import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

// Renders the real map/screen sources in isolation: transpiles TSX to CJS and injects stub
// imports (controlled useLoad, spy client, marker components). The real react/jsx-runtime
// produces element trees we can inspect without a renderer - same harness as nodePhotos.
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

// Walks an element tree; function components are invoked so nested children are reachable,
// while string markers ('JoinMap', 'BusinessBubble', ...) stay inspectable as elements.
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
  Image: 'Image',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (s) => s, absoluteFill: { position: 'absolute' } },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
};
const PALETTE = { cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', tangerine: '#F49A68', navy: '#303A59', muted: '#6C748A', line: '#E9DEC4', white: '#FFFFFF' };
const THEME = { palette: PALETTE, OUTLINE: '#1C2030', NODE_FILLS: [PALETTE.yellow, PALETTE.blue, PALETTE.tangerine, PALETTE.cream], BASE_MAP: {}, mix: (a) => a, textOn: () => PALETTE.navy };
const MAPS = { __esModule: true, default: 'MapView', Marker: 'Marker', Circle: 'Circle', Polyline: 'Polyline' };
const ASSET = { assetUrl: (u) => (u.startsWith('/') ? `https://api.test${u}` : u) };
const SAFE_AREA = { SafeAreaView: 'SafeAreaView' };

const BIZ = { id: 3, name: 'Cafe Kind', logoUrl: '/logos/cafe.png', lat: 0, lng: 10, visitors: 5, kindnessActs: 2, diameterUnits: 4, paidForwardCents: 500, lastKindnessAt: '2026-01-01T00:00:00Z', opacity: 0.4 };
const BIZ2 = { id: 4, name: 'Far Away', logoUrl: null, lat: -40, lng: 150, visitors: 1, kindnessActs: 1, diameterUnits: 1 };
const NODE = { id: 11, chainId: 2, parentId: null, depth: 0, description: 'act', lat: 51.05, lng: -114.06, openSlots: 1, createdAt: '', closesAt: '', childIds: [], mine: false };
const NODE2 = { id: 12, chainId: 2, parentId: 11, depth: 1, description: 'act2', lat: 51.06, lng: -114.05, openSlots: 1, createdAt: '', closesAt: '', childIds: [], mine: true };

// Hook stubs: useLoad returns the canned hit registered under deps[0] and runs the loader
// synchronously so client spies see the call. useState follows an ordered preset.
function makeCtx() {
  const ctx = { canned: new Map(), statePreset: [], stateIdx: 0, setCalls: [], scaleCalls: [], mapRef: { animateToRegion(...a) { ctx.animations.push(['region', a]); }, fitToCoordinates(...a) { ctx.animations.push(['fit', a]); } }, animations: [] };
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
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (init) => ({ current: init === null ? ctx.mapRef : init }),
  };
  return ctx;
}

// Real useBusinesses module + real demo-totals helper, driven by a shared canned map so
// screens exercise the real hook.
const bizCalls = [];
const bizCanned = new Map();
const demoTotalsMod = loadTs(src('api/businessDemoTotals.ts'), {});
const useBusinessesMod = loadTs(src('api/useBusinesses.ts'), {
  react: { useMemo: (fn) => fn() },
  './businessDemoTotals': demoTotalsMod,
  './client': { listBusinesses: async () => bizCalls.push('listBusinesses') && [] },
  './useLoad': { useLoad: (load, deps) => { load?.(); const hit = bizCanned.get(deps?.[0]); return { data: hit?.data ?? null, error: hit?.error ?? null, loading: hit?.loading ?? false, reload: hit?.reload ?? (() => {}) }; } },
});

// --- useBusinesses ---

test('useBusinesses: issues listBusinesses, yields data identity, stable empty, error+reload passthrough', () => {
  bizCalls.length = 0;
  bizCanned.clear();
  bizCanned.set(undefined, { data: [BIZ, BIZ2] });
  const ok = useBusinessesMod.useBusinesses();
  assert.equal(bizCalls.length, 1, 'loader must issue listBusinesses');
  assert.equal(ok.businesses.length, 2);
  assert.equal(ok.businesses[0], BIZ, 'hub passes through with all recency fields');
  assert.equal(ok.businesses[0].opacity, 0.4);
  assert.equal(ok.businesses[0].lastKindnessAt, '2026-01-01T00:00:00Z');
  assert.equal(ok.error, null);

  bizCanned.set(undefined, {});
  const empty1 = useBusinessesMod.useBusinesses();
  const empty2 = useBusinessesMod.useBusinesses();
  assert.equal(empty1.businesses.length, 0);
  assert.equal(empty1.businesses, empty2.businesses, 'empty list must be stable across renders');
  assert.equal(empty1.error, null);

  const retry = { calls: 0, call() { this.calls++; } };
  bizCanned.set(undefined, { error: new Error('boom'), reload: () => retry.call() });
  const failed = useBusinessesMod.useBusinesses();
  assert.equal(failed.error.message, 'boom');
  failed.reload();
  assert.equal(retry.calls, 1, 'reload must reach useLoad reload');
});

// --- BusinessBubble (original fixed-pixel Expo design) ---

const BUBBLE = path.join(root, 'src/map/BusinessBubble.tsx');
const bubbleStubs = {
  react: { useMemo: (fn) => fn() },
  'react/jsx-runtime': jsxRuntime,
  'react-native': RN,
  'expo-image': { Image: 'Image' },
  './assetUrl': ASSET,
  './demoLogos': { demoLogoFor: () => undefined },
  './theme': THEME,
};

test('bubbleSize: units grow in fixed screen pixels, capped at 16.625 units', () => {
  const { bubbleSize, MAX_DIAMETER_UNITS } = loadTs(BUBBLE, bubbleStubs);
  assert.equal(MAX_DIAMETER_UNITS, 16.625);
  assert.equal(bubbleSize(1), 30);
  assert.equal(bubbleSize(4), Math.round(30 + 3 * 3.8));
  assert.equal(bubbleSize(0), 30, 'clamped to 1 unit minimum');
  assert.equal(bubbleSize(100), bubbleSize(16.625), 'growth capped at MAX_DIAMETER_UNITS');
});

test('BusinessBubble: renders at bubbleSize x 1.1 display scale with backend logo, always opaque', () => {
  const { BusinessBubble, bubbleSize } = loadTs(BUBBLE, bubbleStubs);
  const size = bubbleSize(4) * 1.1;
  const el = BusinessBubble({ name: 'Cafe Kind', logoUrl: '/logos/cafe.png', diameterUnits: 4 });
  const outer = el.props.style[1];
  assert.equal(outer.width, size);
  assert.equal(outer.height, size);
  assert.equal(outer.borderRadius, size / 2);
  assert.equal(outer.opacity ?? 1, 1, 'bubble stays fully opaque - no recency fade');
  const img = findOne(el, 'Image');
  assert.equal(img.props.source.uri, 'https://api.test/logos/cafe.png');
  assert.equal(img.props.style.width, (bubbleSize(4) - 8) * 1.1, 'inner logo scales with the bubble');
});

test('BusinessBubble: missing logo falls back to a scaled initial', () => {
  const { BusinessBubble, bubbleSize } = loadTs(BUBBLE, bubbleStubs);
  const el = BusinessBubble({ name: 'B', logoUrl: null, diameterUnits: 1 });
  const txt = findOne(el, 'Text');
  assert.equal(allText(txt), 'B');
  assert.equal(txt.props.style[1].fontSize, Math.max(12, bubbleSize(1) * 0.38) * 1.1);
});

// --- map markers ---

function mapStubs(ctx, extra) {
  return {
    react: ctx.react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': RN,
    'react-native-maps': MAPS,
    '@/api/config': { USE_MOCKS: false },
    './BusinessBubble': { BusinessBubble: 'BusinessBubble' },
    './BusinessSheet': { BusinessSheet: 'BusinessSheet' },
    './JoinSheet': { JoinSheet: 'JoinSheet' },
    './NodeDetailModal': { NodeDetailModal: 'NodeDetailModal' },
    './NodeDot': { NodeDot: 'NodeDot' },
    './findable': { isFindable: () => true },
    './graph': { edges: () => [] },
    './popularity': { mostPopular: () => new Set() },
    './rules': { JOIN_RADIUS_M: 800 },
    './theme': THEME,
    './useBusinessBubbleScale': { useBusinessBubbleScale: ctx.bubbleScale },
    ...extra,
  };
}
const JOIN_MAP = path.join(root, 'src/map/JoinMap.tsx');
const CHAIN_MAP = path.join(root, 'src/map/ChainMap.tsx');

test('JoinMap: business becomes Marker + BusinessBubble with real pin fields', () => {
  const ctx = makeCtx();
  const { JoinMap } = loadTs(JOIN_MAP, mapStubs(ctx));
  const tree = JoinMap({ pins: [NODE], me: { lat: 51.05, lng: -114.06 }, businesses: [BIZ] });
  const marker = findAll(tree, 'Marker').find((m) => m.props.title === 'Cafe Kind');
  assert.deepEqual(marker.props.coordinate, { latitude: 0, longitude: 10 });
  const bubble = findOne(marker, 'BusinessBubble');
  assert.equal(bubble.props.name, 'Cafe Kind');
  assert.equal(bubble.props.logoUrl, '/logos/cafe.png');
  assert.equal(bubble.props.diameterUnits, 4);
  assert.equal(bubble.props.mapScale, 1.5, 'zoom scale reaches the existing bubble');
  assert.equal(bubble.props.opacity, undefined, 'no opacity prop: bubble is always opaque');
  assert.equal(marker.props.tracksViewChanges, true, 'Android redraws the resized marker snapshot');
  const map = findOne(tree, 'MapView');
  assert.equal(map.props.ref?.current, ctx.mapRef, 'hook receives the native MapView ref for projection');
  map.props.onMapReady();
  assert.equal(ctx.scaleCalls[0][0], 'ready', 'map ready triggers the first measure');
  const zoomed = { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  map.props.onRegionChange(zoomed);
  map.props.onRegionChangeComplete(zoomed);
  assert.deepEqual([ctx.scaleCalls[1][0], ctx.scaleCalls[2][0]], ['change', 'complete'], 'zoom handlers feed the bubble scale');
  tree.props.onLayout({ nativeEvent: { layout: { width: 400, height: 300 } } });
  assert.equal(ctx.scaleCalls[3][0], 'layout', 'layout also triggers a measure');
});

test('JoinMap: business tap opens BusinessSheet; override gets id; node tap still reports', () => {
  const ctx = makeCtx();
  const { JoinMap } = loadTs(JOIN_MAP, mapStubs(ctx));
  const pressed = [];
  const tree = JoinMap({ pins: [NODE], me: { lat: 51.05, lng: -114.06 }, businesses: [BIZ], onPinPress: (p) => pressed.push(p.id) });
  findAll(tree, 'Marker').find((m) => m.props.title === 'Cafe Kind').props.onPress();
  assert.deepEqual(ctx.setCalls.at(-1), [1, BIZ], 'tap selects that business into the sheet');
  findAll(tree, 'Marker').find((m) => !m.props.title).props.onPress();
  assert.deepEqual(pressed, [11], 'node interaction preserved');

  ctx.stateIdx = 0;
  ctx.statePreset = [null, BIZ];
  const tree2 = JoinMap({ pins: [], me: { lat: 0, lng: 0 }, businesses: [BIZ] });
  assert.equal(findOne(tree2, 'BusinessSheet').props.business, BIZ);

  ctx.stateIdx = 0;
  ctx.statePreset = [];
  ctx.setCalls.length = 0;
  const ids = [];
  const tree3 = JoinMap({ pins: [], me: { lat: 0, lng: 0 }, businesses: [BIZ], onBusinessPress: (id) => ids.push(id) });
  findAll(tree3, 'Marker').find((m) => m.props.title === 'Cafe Kind').props.onPress();
  assert.deepEqual(ids, [3], 'screen override receives the business id');
  assert.deepEqual(ctx.setCalls, [], 'override must not open the in-map sheet');
});

test('ChainMap: nodes own the camera even when a far business is present', () => {
  const ctx = makeCtx();
  const { ChainMap } = loadTs(CHAIN_MAP, mapStubs(ctx));
  const tree = ChainMap({ nodes: [NODE, NODE2], businesses: [BIZ2] });
  const map = findOne(tree, 'MapView');
  assert.ok(Math.abs(map.props.initialRegion.latitude - 51.055) < 0.01, 'initial region centres on the chain, not the far business');
  map.props.onMapReady();
  const fit = ctx.animations.find(([kind]) => kind === 'fit');
  assert.ok(fit, 'fitToCoordinates called on map ready');
  assert.deepEqual(fit[1][0], [{ latitude: 51.05, longitude: -114.06 }, { latitude: 51.06, longitude: -114.05 }], 'camera fits only nodes');
  assert.ok(findAll(tree, 'Marker').find((m) => m.props.title === 'Far Away'), 'business marker still renders');
});

test('ChainMap: business becomes Marker + BusinessBubble, tap opens sheet, node press reports', () => {
  const ctx = makeCtx();
  const { ChainMap } = loadTs(CHAIN_MAP, mapStubs(ctx));
  const nodePressed = [];
  const tree = ChainMap({ nodes: [NODE], businesses: [BIZ], onNodePress: (id) => nodePressed.push(id) });
  const marker = findAll(tree, 'Marker').find((m) => m.props.title === 'Cafe Kind');
  assert.deepEqual(marker.props.coordinate, { latitude: 0, longitude: 10 });
  const bubble = findOne(marker, 'BusinessBubble');
  assert.equal(bubble.props.name, 'Cafe Kind');
  assert.equal(bubble.props.logoUrl, '/logos/cafe.png');
  assert.equal(bubble.props.diameterUnits, 4);
  assert.equal(bubble.props.mapScale, 1.5, 'zoom scale reaches the existing bubble');
  assert.equal(bubble.props.opacity, undefined, 'no opacity prop: bubble is always opaque');
  assert.equal(marker.props.tracksViewChanges, true, 'Android redraws the resized marker snapshot');
  const map = findOne(tree, 'MapView');
  map.props.onMapReady();
  assert.equal(ctx.scaleCalls[0][0], 'ready', 'map ready triggers the measure after fit');
  map.props.onRegionChange({ latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 });
  assert.equal(ctx.scaleCalls[1][0], 'change', 'zoom handler feeds the bubble scale');
  tree.props.onLayout({ nativeEvent: { layout: { width: 400, height: 300 } } });
  assert.equal(ctx.scaleCalls[2][0], 'layout');
  marker.props.onPress();
  assert.deepEqual(ctx.setCalls.at(-1), [1, BIZ], 'tap selects that business');
  findAll(tree, 'Marker').find((m) => !m.props.title).props.onPress();
  assert.deepEqual(nodePressed, [11], 'node interaction preserved');
  ctx.stateIdx = 0;
  ctx.statePreset = [null, BIZ];
  assert.equal(findOne(ChainMap({ nodes: [NODE], businesses: [BIZ] }), 'BusinessSheet').props.business, BIZ);
});

test('ChainMap: with no nodes, businesses frame the camera', () => {
  const ctx = makeCtx();
  const { ChainMap } = loadTs(CHAIN_MAP, mapStubs(ctx));
  const tree = ChainMap({ nodes: [], businesses: [BIZ2] });
  const map = findOne(tree, 'MapView');
  assert.ok(Math.abs(map.props.initialRegion.latitude - (-40)) < 0.01);
  map.props.onMapReady();
  const anim = ctx.animations.find(([kind]) => kind === 'region');
  assert.deepEqual(anim[1][0].latitude, -40, 'single business animates to its coordinate');
});

// --- BusinessMapStatus ---

const STATUS = path.join(root, 'src/components/BusinessMapStatus.tsx');
const statusStubs = { react: {}, 'react/jsx-runtime': jsxRuntime, 'react-native': RN, '@/map/theme': THEME };

test('BusinessMapStatus: null without error; retry stops propagation then calls onRetry once', () => {
  const { BusinessMapStatus } = loadTs(STATUS, statusStubs);
  assert.equal(BusinessMapStatus({ error: null, onRetry() {} }), null);
  const order = [];
  const tree = BusinessMapStatus({ error: new Error('down'), onRetry: () => order.push('retry') });
  assert.ok(allText(tree).includes('Businesses unavailable. Tap to retry.'));
  assert.equal(tree.props.pointerEvents, 'box-none', 'wrapper must not block map gestures');
  findOne(tree, 'Pressable').props.onPress({ stopPropagation: () => order.push('stop') });
  assert.deepEqual(order, ['stop', 'retry'], 'parent Pressable must not fire before the retry, and retry runs once');
});

// --- screen wiring: real screens + real useBusinesses, marker map components ---

function screenStubs(ctx, params, extraClient, mapStub) {
  return {
    react: ctx.react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': RN,
    'react-native-safe-area-context': SAFE_AREA,
    'expo-router': { router: { push() {}, replace() {} }, useLocalSearchParams: () => params },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } },
    'expo-image-picker': { launchCameraAsync: async () => ({ canceled: true }), launchImageLibraryAsync: async () => ({ canceled: true }) },
    '@/api/client': { claimNode: async () => ({}), continueNode: async () => ({}), createNode: async () => ({}), getNode: async () => ({}), getChain: async () => ({ nodes: [] }), listMine: async () => [], listNearby: async () => [NODE], uploadPhoto: async () => ({ id: 1 }), ...extraClient },
    '@/api/useLoad': { useLoad: ctx.useLoad },
    '@/api/useBusinesses': useBusinessesMod,
    '@/components/BusinessMapStatus': { BusinessMapStatus: 'BusinessMapStatus' },
    '@/components/LoadState': { LoadState: 'LoadState' },
    '@/map': { getMyLocation: async () => ({ lat: 51.05, lng: -114.06 }), requireMyLocation: async () => ({ lat: 51.05, lng: -114.06 }), descendants: () => [], lineage: (ns) => ns, ...mapStub },
  };
}

test('explore screen: JoinMap gets live businesses and a status overlay wired to reload', () => {
  const ctx = makeCtx();
  ctx.statePreset = [null, true]; // storedClaim=null, claimLoaded=true
  ctx.canned.set(true, { data: { mode: 'explore', me: { lat: 51.05, lng: -114.06 }, pins: [NODE] } });
  bizCanned.clear();
  bizCanned.set(undefined, { data: [BIZ] });
  const screen = loadTs(src('app/explore.tsx'), screenStubs(ctx, {}, {}, { JoinMap: 'JoinMap', LocationPicker: 'LocationPicker' })).default;
  const tree = screen();
  assert.equal(findOne(tree, 'JoinMap').props.businesses[0], BIZ, 'hub array reaches the map');
  const status = findOne(tree, 'BusinessMapStatus');
  assert.equal(status.props.error, null);
});

test('explore screen: business load failure surfaces retry without hiding the map', () => {
  const ctx = makeCtx();
  ctx.statePreset = [null, true];
  ctx.canned.set(true, { data: { mode: 'explore', me: { lat: 51.05, lng: -114.06 }, pins: [NODE] } });
  bizCanned.clear();
  let retries = 0;
  bizCanned.set(undefined, { error: new Error('catalog down'), reload: () => retries++ });
  const screen = loadTs(src('app/explore.tsx'), screenStubs(ctx, {}, {}, { JoinMap: 'JoinMap', LocationPicker: 'LocationPicker' })).default;
  const tree = screen();
  assert.deepEqual(findOne(tree, 'JoinMap').props.businesses, [], 'failed catalog yields stable empty, map still renders');
  const status = findOne(tree, 'BusinessMapStatus');
  assert.equal(status.props.error.message, 'catalog down');
  status.props.onRetry();
  assert.equal(retries, 1, 'retry reaches the business reload, not the screen load');
});

test('trees screen: ChainMap gets businesses + status overlay', () => {
  const ctx = makeCtx();
  ctx.canned.set(NaN, { data: { latest: NODE, tree: { nodes: [NODE, NODE2] } } });
  bizCanned.clear();
  bizCanned.set(undefined, { data: [BIZ2] });
  const screen = loadTs(src('app/trees.tsx'), screenStubs(ctx, {}, { listMine: async () => [NODE] }, { ChainMap: 'ChainMap' })).default;
  const tree = screen();
  const map = findOne(tree, 'ChainMap');
  assert.equal(map.props.businesses[0], BIZ2);
  assert.equal(map.props.nodes.length, 2, 'tree nodes preserved');
  assert.ok(findOne(tree, 'BusinessMapStatus'), 'status overlay inside map card');
});

test('chain screen: ChainMap gets businesses + status overlay in its own wrapper', () => {
  const ctx = makeCtx();
  ctx.canned.set(5, { data: { node: { ...NODE, chainId: 2 }, nodes: [NODE, NODE2] } });
  bizCanned.clear();
  bizCanned.set(undefined, { data: [BIZ] });
  const screen = loadTs(src('app/chain/[id].tsx'), screenStubs(ctx, { id: '5' }, {}, { ChainMap: 'ChainMap' })).default;
  const tree = screen();
  const map = findOne(tree, 'ChainMap');
  assert.equal(map.props.businesses[0], BIZ);
  assert.equal(map.props.focusId, 5);
  assert.ok(findOne(tree, 'BusinessMapStatus'));
});

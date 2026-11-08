import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

// Renders the real JoinSheet / NodeDetailModal sources in isolation: transpiles TSX to CJS
// and injects stub imports (controlled useLoad, spy client, marker host components). The
// real react/jsx-runtime produces element trees we can inspect without a renderer.
const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function loadTs(file, stubs) {
  const src = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  });
  const mod = { exports: {} };
  const stubRequire = (id) => {
    if (id in stubs) return stubs[id];
    throw new Error(`unexpected require: ${id}`);
  };
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, stubRequire);
  return mod.exports;
}

// Walks an element tree into a flat list; function components are invoked so children
// nested inside JoinSheet/ActPhoto/PhotoFrame/SidePanel are reachable.
function flatten(el, out = []) {
  if (el == null || typeof el === 'boolean' || typeof el === 'string' || typeof el === 'number') return out;
  if (Array.isArray(el)) {
    el.forEach((c) => flatten(c, out));
    return out;
  }
  if (typeof el.type === 'function') {
    flatten(el.type(el.props), out);
    return out;
  }
  out.push(el);
  flatten(el.props?.children, out);
  return out;
}

function allText(el) {
  if (el == null || typeof el === 'boolean') return '';
  if (typeof el === 'string' || typeof el === 'number') return String(el);
  if (Array.isArray(el)) return el.map(allText).join('');
  if (typeof el.type === 'function') return allText(el.type(el.props));
  return allText(el.props?.children);
}

const RN = {
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (s) => s, absoluteFill: { position: 'absolute' } },
  Text: 'Text',
  View: 'View',
};

const PALETTE = {
  cream: '#FFF9E9',
  yellow: '#FFD36D',
  blue: '#80B9E5',
  tangerine: '#F49A68',
  navy: '#303A59',
  muted: '#6C748A',
  line: '#E9DEC4',
  white: '#FFFFFF',
};

const THEME = {
  palette: PALETTE,
  OUTLINE: '#1C2030',
  textOn: (fill) => (fill === PALETTE.navy ? PALETTE.cream : PALETTE.navy),
  mix: (a) => a,
};

const ASSET = { assetUrl: (u) => (u.startsWith('/') ? `https://api.test${u}` : u) };

const JOIN_SHEET = path.join(root, 'src/map/JoinSheet.tsx');
const DETAIL_MODAL = path.join(root, 'src/map/NodeDetailModal.tsx');

const pin = (id) => ({ id, chainId: 3, parentId: null, lat: 0, lng: 0, openSlots: 1, createdAt: '', closesAt: '', hasPhoto: true, mine: false, depth: 2 });
const node = (id, photoUrl, description = 'did something kind') => ({ id, chainId: 3, parentId: null, depth: 1, description, photoUrl, lat: 0, lng: 0, openSlots: 1, createdAt: '2026-01-01T00:00:00Z', closesAt: '', childIds: [], mine: false });

// Controlled hook layer: useLoad returns whatever is registered under deps[0] and runs
// the loader synchronously so getNode/getChain spies see the requested ids.
function makeCtx() {
  const ctx = {
    loadData: new Map(),
    statePreset: [],
    stateIdx: 0,
    getNodeCalls: [],
    getChainCalls: [],
  };
  ctx.useLoad = (load, deps) => {
    load?.();
    const hit = ctx.loadData.get(deps?.[0]);
    return { data: hit?.data ?? null, error: null, loading: hit?.loading ?? false, reload() {} };
  };
  ctx.stubs = {
    'expo-image': { Image: 'Image' },
    react: {
      useState: (init) => {
        const i = ctx.stateIdx++;
        return [i < ctx.statePreset.length ? ctx.statePreset[i] : typeof init === 'function' ? init() : init, () => {}];
      },
      useEffect: () => {},
    },
    'react/jsx-runtime': jsxRuntime,
    'react-native': RN,
    '@/api/client': {
      getNode: async (id) => {
        ctx.getNodeCalls.push(id);
        return {};
      },
      getChain: async (id) => {
        ctx.getChainCalls.push(id);
        return { nodes: [] };
      },
    },
    '@/api/useLoad': { useLoad: ctx.useLoad },
    './assetUrl': ASSET,
    './graph': { ancestors: () => [] },
    './popularity': { actsInLineLabel: () => 'a few acts' },
    './SidePanel': { SidePanel: ({ children }) => children },
    './theme': THEME,
  };
  return ctx;
}

const renderSheet = (ctx, p) => loadTs(JOIN_SHEET, ctx.stubs).JoinSheet({ pin: p, onClose() {}, onJoin() {} });
const images = (tree) => flatten(tree).filter((e) => e.type === 'Image');

test('JoinSheet: selected node photo renders as hero above the description', () => {
  const ctx = makeCtx();
  ctx.loadData.set(7, { data: { node: node(7, '/api/photos/7.png', 'Picked up litter'), before: [] } });
  const tree = renderSheet(ctx, pin(7));

  const imgs = images(tree);
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].props.source.uri, 'https://api.test/api/photos/7.png');
  assert.equal(imgs[0].props.contentFit, 'cover');
  assert.ok(allText(tree).includes('Picked up litter'));
});

test('JoinSheet: selecting a different pin shows that pin photo, not the old one', () => {
  const ctx = makeCtx();
  ctx.loadData.set(9, { data: { node: node(9, '/api/photos/9.png'), before: [] } });
  const tree = renderSheet(ctx, pin(9));

  const imgs = images(tree);
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].props.source.uri, 'https://api.test/api/photos/9.png');
});

test('JoinSheet: stale load from the previous pin shows no photo or old text', () => {
  const ctx = makeCtx();
  // useLoad still holds node 5's payload while pin 7's fetch is in flight.
  ctx.loadData.set(7, { data: { node: node(5, '/api/photos/5.png', 'OLD ACT'), before: [{ id: 6, description: 'old contributor' }] } });
  const tree = renderSheet(ctx, pin(7));

  assert.equal(images(tree).length, 0, 'previous node photo must not render');
  const text = allText(tree);
  assert.ok(!text.includes('OLD ACT'), 'previous description must not render');
  assert.ok(!text.includes('old contributor'), 'previous contributors must not render');
  assert.ok(!text.includes('No photo available'), 'still loading: no premature placeholder');
});

test('JoinSheet: no public photo shows no photo frame at all', () => {
  const ctx = makeCtx();
  ctx.loadData.set(7, { data: { node: node(7, null, 'Kind act'), before: [] } });
  const tree = renderSheet(ctx, pin(7));

  assert.equal(images(tree).length, 0);
  assert.ok(!allText(tree).includes('No photo available'), 'no empty placeholder box above the act');
  assert.ok(allText(tree).includes('Kind act'));
  assert.ok(!allText(tree).includes('No photo uploaded'));
});

test('JoinSheet: open contributor fetches its own photo by ancestor id', () => {
  const ctx = makeCtx();
  ctx.statePreset = [42]; // openId: contributor row expanded
  ctx.loadData.set(7, { data: { node: node(7, '/api/photos/7.png', 'latest act'), before: [{ id: 42, description: 'earlier act' }] } });
  ctx.loadData.set(42, { data: node(42, '/api/photos/42.png') });
  const tree = renderSheet(ctx, pin(7));

  const uris = images(tree).map((i) => i.props.source.uri);
  assert.ok(ctx.getNodeCalls.includes(42), 'ActPhoto must request the ancestor node id');
  assert.ok(uris.includes('https://api.test/api/photos/7.png'), 'selected hero photo present');
  assert.ok(uris.includes('https://api.test/api/photos/42.png'), 'contributor photo uses ancestor id, not the hero URL');
  assert.equal(uris.length, 2);
});

test('JoinSheet: stale contributor payload renders no ancestor photo', () => {
  const ctx = makeCtx();
  ctx.statePreset = [42];
  ctx.loadData.set(7, { data: { node: node(7, '/api/photos/7.png'), before: [{ id: 42, description: 'earlier act' }] } });
  ctx.loadData.set(42, { data: node(11, '/api/photos/11.png') }); // previous load's node still in slot
  const tree = renderSheet(ctx, pin(7));

  const uris = images(tree).map((i) => i.props.source.uri);
  assert.deepEqual(uris, ['https://api.test/api/photos/7.png']);
});

test('NodeDetailModal: shows the tapped node photo with a node-scoped image key', () => {
  const ctx = makeCtx();
  ctx.loadData.set(7, { data: node(7, '/api/photos/7.png', 'Kind act') });
  const tree = loadTs(DETAIL_MODAL, ctx.stubs).NodeDetailModal({ nodeId: 7, onClose() {} });

  const imgs = images(tree);
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].props.source.uri, 'https://api.test/api/photos/7.png');
  assert.ok(String(imgs[0].key).includes('7'), 'key must change with the node');
  assert.ok(String(imgs[0].key).includes('/api/photos/7.png'), 'key must change with the photo');
  assert.ok(allText(tree).includes('Kind act'));
});

test('NodeDetailModal: stale node payload renders no photo or old details', () => {
  const ctx = makeCtx();
  ctx.loadData.set(7, { data: { ...node(5, '/api/photos/5.png', 'OLD ACT'), mine: true } });
  const tree = loadTs(DETAIL_MODAL, ctx.stubs).NodeDetailModal({ nodeId: 7, onClose() {} });

  assert.equal(images(tree).length, 0);
  const text = allText(tree);
  assert.ok(!text.includes('OLD ACT'));
  assert.ok(!text.includes('YOUR ACT'), 'previous mine flag must not leak');
});

test('NodeDetailModal: node without public photo keeps the placeholder', () => {
  const ctx = makeCtx();
  ctx.loadData.set(7, { data: node(7, null) });
  const tree = loadTs(DETAIL_MODAL, ctx.stubs).NodeDetailModal({ nodeId: 7, onClose() {} });

  assert.equal(images(tree).length, 0);
  assert.ok(allText(tree).includes('✦'));
});

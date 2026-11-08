import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

// Exercises the native-projection scale measurement (rotation-safe), the serialized hook
// drain, and the scaled BusinessBubble render - same transpile + stub harness as businessMaps.
const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');

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
const findOne = (tree, type) => flatten(tree).filter((e) => e.type === type)[0];
const tick = () => new Promise((r) => setImmediate(r));

const HOOK = path.join(root, 'src/map/useBusinessBubbleScale.ts');
const { measureBusinessBubbleScale } = loadTs(HOOK, { react: {} });

// Pixels per longitude degree; at zoom 15 the world is 256*2^15 px wide.
const PX_PER_DEG = (256 * 2 ** 15) / 360;

// Fake native map: linear equirectangular projection rotated by `heading`, scale factor
// `map.zoom` (mutable so tests can zoom mid-gesture).
function fakeMap({ lat = 51.05, lng = -114, heading = 0, zoom = 1, deferPoints = false } = {}) {
  const rad = (heading * Math.PI) / 180;
  const pending = [];
  const projected = [];
  const map = {
    projected,
    zoom,
    calls: { camera: 0 },
    getCamera() {
      map.calls.camera++;
      return Promise.resolve({ center: { latitude: lat, longitude: lng }, heading, pitch: 0 });
    },
    pointForCoordinate(c) {
      projected.push(c);
      const x = c.longitude * PX_PER_DEG * map.zoom;
      const y = c.latitude * PX_PER_DEG * map.zoom;
      const p = { x: x * Math.cos(rad) - y * Math.sin(rad), y: x * Math.sin(rad) + y * Math.cos(rad) };
      if (deferPoints) return new Promise((res) => pending.push(() => res(p)));
      return Promise.resolve(p);
    },
    flush() { pending.splice(0).forEach((f) => f()); },
  };
  return map;
}

// --- measureBusinessBubbleScale ---

test('measureBusinessBubbleScale: scale 1 at zoom-15 equivalent projection under any rotation', async () => {
  for (const heading of [0, 45, 90, 135]) {
    const scale = await measureBusinessBubbleScale(fakeMap({ heading }));
    assert.ok(Math.abs(scale - 1) < 1e-9, `heading ${heading}: rotation must not change the scale, got ${scale}`);
  }
});

test('measureBusinessBubbleScale: doubled projection doubles the scale', async () => {
  assert.ok(Math.abs((await measureBusinessBubbleScale(fakeMap({ zoom: 2 }))) - 2) < 1e-6);
  assert.ok(Math.abs((await measureBusinessBubbleScale(fakeMap({ zoom: 0.5, heading: 90 }))) - 0.5) < 1e-6);
});

test('measureBusinessBubbleScale: dateline camera clamps the pair inside the world', async () => {
  const map = fakeMap({ lng: 179.9999 });
  await measureBusinessBubbleScale(map);
  assert.equal(map.projected.length, 2);
  for (const c of map.projected) {
    assert.ok(c.longitude >= -180 && c.longitude <= 180, `pair point ${c.longitude} inside [-180,180]`);
    assert.equal(c.latitude, 51.05, 'pair sampled at the camera latitude');
  }
});

test('measureBusinessBubbleScale: invalid camera/points/rejections return null', async () => {
  assert.equal(await measureBusinessBubbleScale({ getCamera: async () => ({ center: { latitude: NaN, longitude: 0 } }), pointForCoordinate: async () => ({ x: 0, y: 0 }) }), null, 'NaN camera');
  assert.equal(await measureBusinessBubbleScale({ getCamera: async () => ({ center: { latitude: 0, longitude: 0 } }), pointForCoordinate: async () => ({ x: NaN, y: 0 }) }), null, 'NaN point');
  assert.equal(await measureBusinessBubbleScale({ getCamera: async () => ({ center: { latitude: 0, longitude: 0 } }), pointForCoordinate: async () => ({ x: 5, y: 5 }) }), null, 'zero distance');
  assert.equal(await measureBusinessBubbleScale({ getCamera: async () => { throw new Error('native down'); }, pointForCoordinate: async () => ({ x: 0, y: 0 }) }), null, 'rejection returns null, never throws');
});

// --- useBusinessBubbleScale (real functional setState/effect harness) ---

function hookRunner() {
  const states = [];
  const refs = [];
  const cleanups = [];
  let pendingEffects = [];
  const react = {
    _i: 0,
    _r: 0,
    useState(init) {
      const i = react._i++;
      if (states.length <= i) states.push(init);
      return [states[i], (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; }];
    },
    useRef(init) {
      const i = react._r++;
      if (refs.length <= i) refs.push({ current: init });
      return refs[i];
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => pendingEffects.push(fn),
  };
  const mod = loadTs(HOOK, { react });
  const render = (mapRef) => { react._i = 0; react._r = 0; pendingEffects = []; return mod.useBusinessBubbleScale(mapRef); };
  return {
    states,
    render,
    mount() { pendingEffects.forEach((f) => cleanups.push(f())); },
    unmount() { cleanups.splice(0).forEach((f) => f?.()); },
  };
}

test('useBusinessBubbleScale: completed measures apply during the gesture; coalesced follow-up', async () => {
  const h = hookRunner();
  const map = fakeMap({ zoom: 2, deferPoints: true });
  const out = h.render({ current: map });
  assert.equal(out.mapScale, 0.6, 'starts at the original size, capped at the max bubble scale');
  h.mount();
  out.onMapReady();
  await tick(); // camera resolved, pair #1 pending (zoom 2)
  assert.equal(map.calls.camera, 1);
  // Another gesture frame queues while batch 1 is in flight, then the map zooms further.
  out.onRegionChange({ longitudeDelta: 0.0001 });
  map.zoom = 4;
  map.flush();
  await tick();
  assert.ok(Math.abs(h.states[0] - 2) < 1e-6, 'first completed measure applies live, not dropped');
  // Batch 2 (zoom 4) is now in flight; repeated frames coalesce into one follow-up.
  out.onRegionChange();
  out.onRegionChange();
  map.flush();
  await tick();
  assert.ok(Math.abs(h.states[0] - 4) < 1e-6, 'follow-up applies without waiting for onRegionChangeComplete');
  assert.equal(map.calls.camera, 3, 'repeated frames produced exactly one more batch - no overlap');
  // Unmount suppresses a late result.
  h.unmount();
  map.flush();
  await tick();
  assert.ok(Math.abs(h.states[0] - 4) < 1e-6, 'unmounted: late result never applied');
});

test('useBusinessBubbleScale: a resolved latest measure applies and null keeps last good', async () => {
  const h = hookRunner();
  const map = fakeMap({ zoom: 2 });
  const mapRef = { current: map };
  const out = h.render(mapRef);
  h.mount();
  out.onMapReady();
  await tick();
  assert.ok(Math.abs(h.states[0] - 2) < 1e-6, 'projection scale applied');
  out.onRegionChange();
  map.getCamera = async () => { throw new Error('gone'); };
  await tick();
  assert.ok(Math.abs(h.states[0] - 2) < 1e-6, 'failure keeps the last good scale');
});

// --- BusinessBubble scaled (unchanged render contract) ---

const BUBBLE = path.join(root, 'src/map/BusinessBubble.tsx');
const bubbleStubs = {
  react: { useMemo: (fn) => fn() },
  'react/jsx-runtime': jsxRuntime,
  'react-native': {
    Image: 'Image',
    StyleSheet: { create: (s) => s },
    Text: 'Text',
    View: 'View',
  },
  'expo-image': { Image: 'Image' },
  './assetUrl': { assetUrl: (u) => u },
  './demoLogos': { demoLogoFor: () => undefined },
  './theme': { palette: { cream: '#FFF9E9', navy: '#303A59' }, OUTLINE: '#1C2030' },
};

test('BusinessBubble at mapScale 1 renders original dims scaled by the 1.1 display constant', () => {
  const { BusinessBubble, bubbleSize, BUSINESS_BUBBLE_DISPLAY_SCALE } = loadTs(BUBBLE, bubbleStubs);
  assert.equal(BUSINESS_BUBBLE_DISPLAY_SCALE, 1.1);
  const size = bubbleSize(4);
  const el = BusinessBubble({ name: 'B', logoUrl: null, diameterUnits: 4, mapScale: 1 });
  const s = el.props.style[1];
  assert.equal(s.width, size * 1.1);
  assert.equal(s.borderRadius, (size * 1.1) / 2);
  assert.equal(s.borderWidth, 2.5 * 1.1);
  assert.equal(s.shadowRadius, 4 * 1.1);
  assert.equal(s.shadowOffset.height, 2 * 1.1);
  const txt = findOne(el, 'Text');
  assert.equal(txt.props.style[1].fontSize, Math.max(12, size * 0.38) * 1.1);
});

test('BusinessBubble mapScale doubles and halves the whole design on top of the 1.1 boost', () => {
  const { BusinessBubble, bubbleSize } = loadTs(BUBBLE, bubbleStubs);
  const size = bubbleSize(4);
  const big = BusinessBubble({ name: 'B', logoUrl: '/x.png', diameterUnits: 4, mapScale: 2 }).props.style[1];
  assert.equal(big.width, size * 2.2);
  assert.equal(big.borderWidth, 2.5 * 2.2);
  assert.equal(big.shadowRadius, 4 * 2.2);
  assert.equal(big.shadowOffset.height, 2 * 2.2);
  const img = findOne(BusinessBubble({ name: 'B', logoUrl: '/x.png', diameterUnits: 4, mapScale: 2 }), 'Image');
  assert.equal(img.props.style.width, (size - 8) * 2.2, 'logo scales too');
  const small = BusinessBubble({ name: 'B', logoUrl: '/x.png', diameterUnits: 4, mapScale: 0.5 }).props.style[1];
  assert.equal(small.width, size * 0.55);
  assert.equal(small.borderWidth, 2.5 * 0.55);
  const tinyTxt = findOne(BusinessBubble({ name: 'B', logoUrl: null, diameterUnits: 1, mapScale: 0.1 }), 'Text');
  assert.ok(Math.abs(tinyTxt.props.style[1].fontSize - Math.max(12, bubbleSize(1) * 0.38) * 0.11) < 1e-9, 'font scales below the original floor');
  const bad = BusinessBubble({ name: 'B', logoUrl: null, diameterUnits: 4, mapScale: NaN }).props.style[1];
  assert.equal(bad.width, size * 1.1, 'non-finite scale falls back to display scale only');
});

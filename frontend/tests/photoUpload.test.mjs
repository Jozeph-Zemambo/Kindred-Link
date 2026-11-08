import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';

// Loads a TS module in isolation: transpiles to CJS and injects stub require/globals,
// so src/api/client.ts runs here exactly as bundled except for the swapped imports.
const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function loadTs(file, stubs, globals = {}) {
  const src = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const mod = { exports: {} };
  const stubRequire = (id) => {
    if (id in stubs) return stubs[id];
    throw new Error(`unexpected require: ${id}`);
  };
  const names = Object.keys(globals);
  const fn = new Function('module', 'exports', 'require', ...names, outputText);
  fn(mod, mod.exports, stubRequire, ...names.map((n) => globals[n]));
  return mod.exports;
}

// Minimal expo-file-system File: what convertFormDataAsync needs is name/type/bytes().
const FILE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
class FakeFile {
  constructor(uri) {
    this.uri = uri;
  }
  get name() {
    return this.uri.split('/').pop();
  }
  get type() {
    return 'image/png';
  }
  async bytes() {
    return FILE_BYTES;
  }
}

// Mirrors Expo's winter FormData patch: keeps File parts, tags Blob parts with the filename.
class FakeFormData {
  constructor() {
    this._parts = [];
  }
  append(name, value, filename) {
    if (value instanceof Blob) {
      value.name = filename ?? value.name ?? 'blob';
    } else if (typeof value !== 'object') {
      value = String(value);
    }
    this._parts.push([String(name), value]);
  }
  entries() {
    return this._parts.values();
  }
}

const platform = { OS: 'android' };

function loadClient({ mocks = false, fetchImpl, token } = {}) {
  const calls = [];
  const tokenCalls = [];
  const fetch = fetchImpl ?? (async () => ({ ok: true, json: async () => ({}) }));
  const stubs = {
    'expo-file-system': { File: FakeFile },
    'react-native': { Platform: platform },
    './config': { API_URL: 'https://api.test', RECAP_ENDPOINT_READY: false, USE_MOCKS: mocks },
    './deviceId': { getDeviceId: async () => 'dev-test' },
    '@/auth/token': { getClerkSessionToken: async () => { tokenCalls.push(1); return token ?? null; } },
    '@/map/graph': { ancestors: () => [], descendants: () => [] },
    './mocks': { mockBusinesses: [], mockChain: () => ({}), mockNode: () => ({}), mockPins: () => [], mockStats: () => ({}) },
  };
  const api = loadTs(path.join(root, 'src/api/client.ts'), stubs, {
    fetch: async (...args) => {
      calls.push(args);
      return fetch(...args);
    },
    FormData: FakeFormData,
  });
  return { api, calls, tokenCalls };
}

// The real SDK 58 converter, with only its blob util stubbed for Node.
const convertFormDataAsync = loadTs(
  path.join(root, 'node_modules/expo/src/winter/fetch/convertFormData.ts'),
  { '../../utils/blobUtils': { blobToArrayBufferAsync: async (blob) => blob.arrayBuffer() } },
).convertFormDataAsync;

test('mocks: returns stub response without touching fetch or auth', async () => {
  const { api, calls, tokenCalls } = loadClient({ mocks: true });
  assert.deepEqual(await api.uploadPhoto('file:///x.jpg'), { id: 1, status: 'PENDING' });
  assert.equal(calls.length, 0);
  assert.equal(tokenCalls.length, 0, 'mock branch returns before any token lookup');
});

test('native: appends expo-file-system File, not a { uri, name, type } object', async () => {
  const { api, calls } = loadClient({
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: 7, status: 'PENDING' }) }),
  });
  const result = await api.uploadPhoto('file:///data/photos/cat.png');
  assert.deepEqual(result, { id: 7, status: 'PENDING' });

  assert.equal(calls.length, 1);
  const [target, init] = calls[0];
  assert.equal(target, 'https://api.test/api/photos');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-Device-Id'], 'dev-test');
  assert.ok(!('Content-Type' in init.headers), 'boundary must be set by fetch, not us');

  const parts = [...init.body.entries()];
  assert.equal(parts.length, 1);
  const [name, part] = parts[0];
  assert.equal(name, 'file');
  assert.ok(part instanceof FakeFile, `expected File, got ${JSON.stringify(part)}`);
  assert.equal(part.uri, 'file:///data/photos/cat.png');
  assert.equal(part.name, 'cat.png');
  assert.equal(part.type, 'image/png');
  assert.deepEqual(await part.bytes(), FILE_BYTES);
});

test('native: Expo converter encodes filename/type headers and real file bytes', async () => {
  const { api, calls } = loadClient({
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: 1 }) }),
  });
  await api.uploadPhoto('file:///data/photos/cat.png');
  const form = calls[0][1].body;

  const { body } = await convertFormDataAsync(form, 'TESTBOUNDARY');
  const text = new TextDecoder('latin1').decode(body);
  assert.match(text, /--TESTBOUNDARY\r\ncontent-disposition: form-data; name="file"; filename="cat\.png"\r\ncontent-type: image\/png\r\n\r\n/);
  assert.ok(text.endsWith('--TESTBOUNDARY--\r\n'));
  const head = text.indexOf('\r\n\r\n') + 4;
  assert.deepEqual(new Uint8Array(body.buffer, body.byteOffset + head, FILE_BYTES.length), FILE_BYTES);
});

test('regression: legacy { uri, name, type } part is rejected by the converter', async () => {
  const form = new FakeFormData();
  form._parts.push(['file', { uri: 'file:///x.jpg', name: 'kindred-1.jpg', type: 'image/jpeg' }]);
  await assert.rejects(convertFormDataAsync(form, 'B'), /Unsupported FormDataPart implementation/);
});

test('web: uploads fetched Blob under generated jpg filename', async () => {
  platform.OS = 'web';
  try {
    const { api, calls } = loadClient({
      fetchImpl: async (target) =>
        target === 'https://cdn.test/pic.png'
          ? { ok: true, blob: async () => new Blob([FILE_BYTES], { type: 'image/png' }) }
          : { ok: true, json: async () => ({ id: 9 }) },
    });
    assert.deepEqual(await api.uploadPhoto('https://cdn.test/pic.png'), { id: 9 });
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], 'https://cdn.test/pic.png');

    const [[name, part]] = [...calls[1][1].body.entries()];
    assert.equal(name, 'file');
    assert.ok(part instanceof Blob);
    assert.match(part.name, /^kindred-\d+\.jpg$/);

    const { body } = await convertFormDataAsync(calls[1][1].body, 'B');
    const text = new TextDecoder('latin1').decode(body);
    assert.match(text, /filename="kindred-\d+\.jpg"\r\ncontent-type: image\/png/);
  } finally {
    platform.OS = 'android';
  }
});

test('web: fails fast when the photo source cannot be fetched', async () => {
  platform.OS = 'web';
  try {
    const { api, calls } = loadClient({
      fetchImpl: async () => ({ ok: false, status: 404, statusText: 'Not Found' }),
    });
    await assert.rejects(api.uploadPhoto('https://cdn.test/gone.png'), /Failed to read photo: 404/);
    assert.equal(calls.length, 1, 'API endpoint must not be called');
  } finally {
    platform.OS = 'android';
  }
});

test('native authenticated upload: Bearer + device id, real File, no Content-Type', async () => {
  const { api, calls } = loadClient({
    token: 'session-tok',
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: 4 }) }),
  });
  await api.uploadPhoto('file:///x.png');
  const [, init] = calls[0];
  assert.equal(init.headers.Authorization, 'Bearer session-tok');
  assert.equal(init.headers['X-Device-Id'], 'dev-test');
  assert.ok(!('Content-Type' in init.headers));
  assert.ok([...init.body.entries()][0][1] instanceof FakeFile, 'File part preserved with auth');
});

test('anonymous upload sends no Authorization header', async () => {
  const { api, calls } = loadClient({ fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  await api.uploadPhoto('file:///x.png');
  assert.ok(!('Authorization' in calls[0][1].headers), 'null token must not produce a header');
});

test('JSON requests carry Bearer + device id when a session exists', async () => {
  const { api, calls } = loadClient({
    token: 'json-tok',
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: 5 }) }),
  });
  await api.getNode(5);
  const [, init] = calls[0];
  assert.equal(init.headers.Authorization, 'Bearer json-tok');
  assert.equal(init.headers['X-Device-Id'], 'dev-test');
  assert.equal(init.headers['Content-Type'], 'application/json');
});

test('api error response propagates as ApiError', async () => {
  const { api } = loadClient({
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ title: 'boom', detail: 'broken' }),
    }),
  });
  const err = await api.uploadPhoto('file:///x.png').catch((e) => e);
  assert.ok(err instanceof api.ApiError);
  assert.equal(err.message, 'broken');
  assert.equal(err.problem.status, 500);
});

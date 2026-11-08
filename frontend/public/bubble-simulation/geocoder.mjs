// Address lookup UI: queries the app's geocoding endpoint, previews a candidate
// as a temporary map pin, and only on explicit confirm moves the selected sim
// business. A generation counter plus invalidate() discards results/previews
// the moment the business, query, or API base changes.
const FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_API_BASE = 'http://localhost:8080';

export function createGeocoder({ root, api, onConfirm }) {
  root.innerHTML = `
    <h2>Move selected business</h2>
    <form id="geoForm">
      <div class="field">
        <label for="geoQuery">Business address or name + city</label>
        <input id="geoQuery" type="text" maxlength="200" required
               placeholder="e.g. Bean There Cafe, Calgary">
      </div>
      <div class="field">
        <label for="geoApiBase">Address-search API base</label>
        <input id="geoApiBase" type="url" value="${DEFAULT_API_BASE}" required>
      </div>
      <button type="submit" id="geoSearch" class="geo-search">Search</button>
      <p class="hint">Address text is sent to the public Nominatim service via the app
        backend - don't enter private or confidential addresses. Search data
        &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank"
        rel="noopener">OpenStreetMap</a> contributors.</p>
      <p class="error" id="geoError" role="alert" hidden></p>
      <p class="hint" id="geoStatus" aria-live="polite"></p>
      <ul class="geo-results" id="geoResults" aria-label="Address candidates"></ul>
      <div class="btn-row" id="geoPending" hidden>
        <button type="button" id="geoConfirm" disabled>Confirm location</button>
        <button type="button" id="geoCancel">Cancel</button>
      </div>
    </form>`;

  const form = root.querySelector('#geoForm');
  const queryInput = root.querySelector('#geoQuery');
  const apiBaseInput = root.querySelector('#geoApiBase');
  const searchBtn = root.querySelector('#geoSearch');
  const errorEl = root.querySelector('#geoError');
  const statusEl = root.querySelector('#geoStatus');
  const resultsEl = root.querySelector('#geoResults');
  const pendingEl = root.querySelector('#geoPending');
  const confirmBtn = root.querySelector('#geoConfirm');
  const cancelBtn = root.querySelector('#geoCancel');

  let generation = 0;
  let candidate = null; // {id, displayName, lat, lng, gen, businessId}
  let activeCtrl = null;

  function status(msg) { statusEl.textContent = msg; }
  function fail(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
  function clearMsg() {
    errorEl.hidden = true;
    errorEl.textContent = '';
    status('');
  }

  function clearResults() {
    resultsEl.textContent = '';
    candidate = null;
    pendingEl.hidden = true;
    confirmBtn.disabled = true;
  }

  /** Everything shown or in flight is stale - drop it. Safe to call anytime. */
  function invalidate() {
    generation += 1;
    if (activeCtrl) {
      activeCtrl.abort();
      activeCtrl = null;
    }
    clearMsg();
    clearResults();
    api.clearPreview();
    searchBtn.disabled = false;
  }

  // Editing the address or API base invalidates results, preview, and in-flight work.
  queryInput.addEventListener('input', invalidate);
  apiBaseInput.addEventListener('input', invalidate);

  function isValidCandidate(c) {
    return c != null
        && typeof c.id === 'string' && c.id.trim() !== ''
        && typeof c.displayName === 'string' && c.displayName.trim() !== ''
        // Strict numbers only: Number(null)/''/false would coerce to 0,0.
        && typeof c.lat === 'number' && Number.isFinite(c.lat) && c.lat >= -90 && c.lat <= 90
        && typeof c.lng === 'number' && Number.isFinite(c.lng) && c.lng >= -180 && c.lng <= 180;
  }

  async function search(ev) {
    ev.preventDefault();
    clearMsg();
    clearResults();
    api.clearPreview();
    const gen = ++generation;
    const businessId = api.getSelectedBusinessId();
    const q = queryInput.value.trim();
    if (businessId == null) {
      fail('Load and select a business first.');
      return;
    }

    let base;
    try {
      base = new URL(apiBaseInput.value.trim());
      if (base.protocol !== 'http:' && base.protocol !== 'https:') {
        throw new Error('bad scheme');
      }
    } catch {
      fail('Search API base must be an http(s) URL, e.g. http://localhost:8080');
      return;
    }
    if (q.length < 3) {
      fail('Enter at least 3 characters to search.');
      return;
    }

    searchBtn.disabled = true;
    status('Searching...');
    const url = `${base.origin}${base.pathname.replace(/\/$/, '')}/api/geocoding/search?` +
        new URLSearchParams({ q });
    const ctrl = new AbortController();
    activeCtrl = ctrl;
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let results;
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      if (resp.status === 200) {
        results = await resp.json();
      } else {
        let title = '';
        try { title = (await resp.json()).title || ''; } catch { /* non-json */ }
        throw lookupError(resp.status, title);
      }
    } catch (e) {
      if (e.isLookupError) {
        showIfCurrent(gen, businessId, () => fail(e.message));
      } else if (e.name === 'AbortError') {
        // Abort from invalidate() is silent (generation already bumped);
        // reaching here with the same generation means the 8 s timeout fired.
        if (gen === generation) {
          fail('Search timed out - the lookup service did not answer.');
        }
      } else {
        showIfCurrent(gen, businessId, () =>
          fail('Lookup unreachable - is the backend running at that address?'));
      }
      return;
    } finally {
      clearTimeout(timer);
      if (activeCtrl === ctrl) {
        activeCtrl = null;
      }
      if (gen === generation) {
        searchBtn.disabled = false;
      }
    }

    showIfCurrent(gen, businessId, () => {
      if (!Array.isArray(results) || !results.every(isValidCandidate)) {
        fail('Unexpected response from lookup service.');
        return;
      }
      if (results.length === 0) {
        status('No matching addresses found.');
        return;
      }
      status(`${results.length} candidate(s) - pick one to preview on the map:`);
      resultsEl.textContent = '';
      for (const c of results) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = c.displayName;
        btn.addEventListener('click', () => previewCandidate(c, gen, businessId));
        li.append(btn);
        resultsEl.append(li);
      }
    });
  }

  // Runs fn only if nothing invalidated this query since it was submitted.
  function showIfCurrent(gen, businessId, fn) {
    if (gen === generation && businessId === api.getSelectedBusinessId()) {
      fn();
    }
  }

  function lookupError(statusCode, title) {
    const e = new Error();
    e.isLookupError = true;
    if (statusCode === 400) {
      e.message = `Address rejected (${title || 'invalid_address'}).`;
    } else if (statusCode === 429) {
      e.message = `Lookup rate limited - wait a second and retry (${title || 'geocoding_rate_limited'}).`;
    } else if (statusCode === 503) {
      e.message = `Lookup provider unavailable (${title || 'geocoding_unavailable'}).`;
    } else {
      e.message = `Lookup failed with HTTP ${statusCode}${title ? ' - ' + title : ''}.`;
    }
    return e;
  }

  function previewCandidate(c, gen, businessId) {
    if (gen !== generation || businessId !== api.getSelectedBusinessId()) {
      clearResults();
      status('Selection changed - search again.');
      return;
    }
    candidate = { ...c, gen, businessId };
    api.showPreview(Number(c.lat), Number(c.lng));
    pendingEl.hidden = false;
    confirmBtn.disabled = false;
    status(`Preview: ${Number(c.lat).toFixed(6)}, ${Number(c.lng).toFixed(6)} - confirm to move "${api.getSelectedBusinessName()}".`);
  }

  confirmBtn.addEventListener('click', () => {
    if (!candidate || candidate.gen !== generation
        || candidate.businessId !== api.getSelectedBusinessId()) {
      clearResults();
      api.clearPreview();
      status('Selection changed - search again.');
      return;
    }
    onConfirm(candidate);
    status('Confirmed in this simulation only - no data was written anywhere.');
    resultsEl.textContent = '';
    pendingEl.hidden = true;
    candidate = null;
  });

  cancelBtn.addEventListener('click', () => {
    invalidate();
    status('Preview cleared.');
  });

  form.addEventListener('submit', search);

  function reset() {
    invalidate();
    queryInput.value = '';
    apiBaseInput.value = DEFAULT_API_BASE;
  }

  return { invalidate, reset };
}

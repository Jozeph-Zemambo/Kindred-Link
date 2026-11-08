import { bubbleDimensions } from './bubble-dimensions.mjs';
import { createMapView } from './map-view.mjs';
import { createGeocoder } from './geocoder.mjs';
import { createActivityControls } from './activity-controls.mjs';
import { setupViewMode } from './view-mode.mjs';
import { INDIVIDUAL_RADIUS_MULTIPLIER } from './business-clusters.mjs';
import { fetchBusinesses, normalizeApiBase } from './business-catalog.mjs';

const METERS_PER_UNIT_DEFAULT = 5;
const MAX_VISITORS = 1_000_000; // UI edit cap only; loaded counts pass through.

// The catalog arrives asynchronously; everything below must be empty-safe.
let BUSINESSES = [];
let INITIAL = [];

const state = {
  selected: -1, metersPerUnit: METERS_PER_UNIT_DEFAULT, clockHours: 0,
  clustering: true, loading: false,
};
let geocoder = null;
let activity = null;

const list = document.getElementById('businessList');
const selectedName = document.getElementById('selectedName');
const locationLabel = document.getElementById('locationLabel');
const coordsReadout = document.getElementById('coordsReadout');
const visitorsInput = document.getElementById('visitorsInput');
const visitorsError = document.getElementById('visitorsError');
const sizeReadout = document.getElementById('sizeReadout');
const mpuSlider = document.getElementById('metersPerUnitSlider');
const mpuValue = document.getElementById('metersPerUnitValue');
const mapStatus = document.getElementById('mapStatus');
const clusterCheckbox = document.getElementById('clusterBusinesses');
const bubbleCount = document.getElementById('bubbleCount');
const catalogApiBase = document.getElementById('catalogApiBase');
const catalogReload = document.getElementById('catalogReload');
const catalogStatus = document.getElementById('catalogStatus');
const locateBtn = document.getElementById('locateBusiness');

const rowEls = new Map();

const mapView = createMapView(document.getElementById('map'), {
  onSelect: (id) => select(BUSINESSES.findIndex((b) => b.id === id)),
  onTileError: () => {
    mapStatus.textContent = 'Map tile provider unavailable - tiles may not load, bubbles still work.';
    mapStatus.hidden = false;
  },
  onDisplayChange: (count, total) => {
    bubbleCount.hidden = false;
    bubbleCount.textContent = `Bubbles: ${count} for ${total} businesses`;
  },
});
if (!mapView.available) {
  mapStatus.textContent = 'Map library failed to load - counts and controls below still work.';
  mapStatus.hidden = false;
}

function selected() {
  return BUSINESSES[state.selected] ?? null;
}

function catalogNote(msg) {
  catalogStatus.textContent = msg;
}

// Enable/disable controls that only make sense with a selected business.
function syncBusinessControls() {
  const off = state.loading || !selected();
  for (const el of [visitorsInput, locateBtn,
      ...document.querySelectorAll('.btn-row button')]) {
    el.disabled = off;
  }
}

function rebuildRows() {
  list.textContent = '';
  rowEls.clear();
  for (const [i, b] of BUSINESSES.entries()) {
    const li = document.createElement('li');
    const row = document.createElement('button');
    row.type = 'button';
    row.setAttribute('aria-pressed', String(i === state.selected));
    row.addEventListener('click', () => select(i));
    if (b.logoUrl) {
      const img = document.createElement('img');
      img.src = b.logoUrl;
      img.alt = `${b.name} logo`;
      img.className = 'biz-logo';
      img.loading = 'lazy';
      row.append(img);
    }
    const name = document.createElement('span');
    name.className = 'biz-name';
    name.textContent = b.name;
    const count = document.createElement('span');
    count.className = 'count';
    row.append(name, count);
    li.append(row);
    list.append(li);
    rowEls.set(b.id, row);
  }
  refreshRowCounts();
}

function refreshRowCounts() {
  for (const b of BUSINESSES) {
    const row = rowEls.get(b.id);
    if (!row) {
      continue;
    }
    const dims = bubbleDimensions(b.visitors, state.metersPerUnit);
    row.querySelector('.count').textContent =
      `${b.visitors.toLocaleString()} / ${dims.diameterUnits}u / ` +
      `${Number((dims.diameterMeters * INDIVIDUAL_RADIUS_MULTIPLIER).toFixed(1))}m`;
  }
}

function renderAll() {
  if (mapView.available) {
    mapView.render(BUSINESSES, state.metersPerUnit,
      selected()?.id ?? null, state.clockHours, state.clustering);
  }
  refreshRowCounts();
  if (activity) {
    activity.refresh(selected(), state.clockHours);
  }
}

function updateReadout() {
  const b = selected();
  if (!b) {
    sizeReadout.textContent = '';
    coordsReadout.textContent = '';
    return;
  }
  const dims = bubbleDimensions(b.visitors, state.metersPerUnit);
  sizeReadout.textContent =
    `Diameter: ${dims.diameterUnits} units = ` +
    `${(dims.diameterMeters * INDIVIDUAL_RADIUS_MULTIPLIER).toFixed(2)} m; ` +
    `radius: ${(dims.radiusMeters * INDIVIDUAL_RADIUS_MULTIPLIER).toFixed(2)} m ` +
    `at ${state.metersPerUnit} m/unit x1.3 individual scale`;
  coordsReadout.textContent =
    `${Number(b.lat).toFixed(6)}, ${Number(b.lng).toFixed(6)} - ${b.locationLabel || 'Example location'}`;
}

function clearError() {
  visitorsError.hidden = true;
  visitorsError.textContent = '';
  visitorsInput.classList.remove('invalid');
  visitorsInput.removeAttribute('aria-invalid');
}

function showError(message) {
  visitorsError.textContent = message;
  visitorsError.hidden = false;
  visitorsInput.classList.add('invalid');
  visitorsInput.setAttribute('aria-invalid', 'true');
}

function select(i) {
  const prev = selected()?.id ?? null;
  state.selected = i;
  const b = selected();
  if (prev !== (b?.id ?? null) && geocoder) {
    geocoder.invalidate(); // a pending preview/result belongs to the old business
  }
  for (const other of BUSINESSES) {
    rowEls.get(other.id)?.setAttribute('aria-pressed', String(other === b));
  }
  selectedName.textContent = b ? b.name : 'none';
  locationLabel.textContent = b ? (b.locationLabel || 'Example location') : '-';
  clearError();
  visitorsInput.value = b ? b.visitors : '';
  visitorsInput.max = String(Math.max(MAX_VISITORS, b ? b.visitors : 0));
  updateReadout();
  syncBusinessControls();
  renderAll();
  if (activity) {
    activity.refresh(b, state.clockHours, true);
  }
}

function setVisitors(i, n) {
  const b = BUSINESSES[i];
  if (!b) {
    return;
  }
  // Ordinary scans change size only - kindness recency is a separate axis
  // that visitor edits never touch.
  b.visitors = n;
  renderAll();
  updateReadout();
}

visitorsInput.addEventListener('input', () => {
  const b = selected();
  if (!b) {
    return;
  }
  const raw = visitorsInput.value.trim();
  const n = raw === '' ? NaN : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > Math.max(MAX_VISITORS, b.visitors)) {
    showError('Enter a whole number from 0 to 1,000,000 (or the loaded count).');
    return;
  }
  clearError();
  setVisitors(state.selected, n);
});

function addVisitors(delta) {
  const b = selected();
  if (!b) {
    return;
  }
  setVisitors(state.selected,
    Math.min(b.visitors + delta, Math.max(MAX_VISITORS, b.visitors)));
  clearError();
  visitorsInput.value = b.visitors;
}

document.getElementById('add1').addEventListener('click', () => addVisitors(1));
document.getElementById('add100').addEventListener('click', () => addVisitors(100));
document.getElementById('add500').addEventListener('click', () => addVisitors(500));

locateBtn.addEventListener('click', () => {
  const b = selected();
  if (b && mapView.available) {
    mapView.focusBusiness(b.id);
  }
});

clusterCheckbox.addEventListener('change', () => {
  state.clustering = clusterCheckbox.checked;
  renderAll();
});

mpuSlider.addEventListener('input', () => {
  state.metersPerUnit = Number(mpuSlider.value);
  mpuValue.textContent = String(state.metersPerUnit);
  renderAll();
  updateReadout();
});

// One explicit GET of the live catalog; reload discards local preview edits.
async function loadCatalog() {
  let base;
  try {
    base = normalizeApiBase(catalogApiBase.value);
  } catch {
    catalogNote('Business API base must be an http(s) URL, e.g. http://localhost:8080');
    return;
  }
  state.loading = true;
  // Clear stale rows/circles/selection up front: a slow or failed reload
  // must never leave the previous catalog on screen.
  BUSINESSES = [];
  INITIAL = [];
  state.selected = -1;
  rebuildRows();
  select(-1);
  syncBusinessControls();
  catalogReload.disabled = true;
  catalogApiBase.disabled = true;
  catalogNote('Loading businesses...');
  geocoder.invalidate();
  try {
    const data = await fetchBusinesses(base);
    BUSINESSES = data;
    // Reset restores a copy of each loaded record exactly as the API sent it.
    INITIAL = data.map((b) => ({ ...b }));
    rebuildRows();
    select(data.length ? 0 : -1);
    catalogNote(data.length === 0
      ? 'No businesses returned - check the API base and reload.'
      : `Loaded ${data.length} businesses. Edits are local only; ` +
        'reload restores backend data.');
    if (mapView.available) {
      mapView.fitAll();
    }
  } catch (e) {
    BUSINESSES = [];
    rebuildRows();
    select(-1);
    renderAll();
    catalogNote(`${e.message} Use "Reload businesses" to retry.`);
  } finally {
    state.loading = false;
    catalogReload.disabled = false;
    catalogApiBase.disabled = false;
    syncBusinessControls();
  }
}

catalogApiBase.value =
  `${location.protocol}//${location.hostname || 'localhost'}:8080`;
catalogReload.addEventListener('click', () => loadCatalog());

geocoder = createGeocoder({
  root: document.getElementById('geocoderPanel'),
  api: {
    getSelectedBusinessId: () => selected()?.id ?? null,
    getSelectedBusinessName: () => selected()?.name ?? '',
    showPreview: (lat, lng) => { if (mapView.available) mapView.showPreview(lat, lng); },
    clearPreview: () => { if (mapView.available) mapView.clearPreview(); },
  },
  onConfirm: (c) => {
    const b = selected();
    if (!b) {
      return;
    }
    b.lat = Number(c.lat);
    b.lng = Number(c.lng);
    b.locationLabel = 'Sim location set';
    locationLabel.textContent = b.locationLabel;
    renderAll();
    updateReadout();
    if (mapView.available) {
      mapView.clearPreview();
    }
  },
});

activity = createActivityControls({
  root: document.getElementById('activityPanel'),
  onAdvance: (hours) => {
    state.clockHours += hours;
    renderAll();
    updateReadout();
    // Clock advance rewrites the age field to the recomputed last valid value.
    activity.refresh(selected(), state.clockHours, true);
  },
  onAgeSet: (age) => simulateKindness(age, false),
  onKindness: () => simulateKindness(0, true),
});

// Simulated act of kindness ageHoursAgo in sim time - local only, never a
// checkin and independent of the visitor count. isNew counts a new act.
function simulateKindness(ageHoursAgo, isNew) {
  const b = selected();
  if (!b) {
    return;
  }
  b.lastAt = state.clockHours - ageHoursAgo;
  b.recencyKnown = true;
  b.kindnessActs = isNew ? (b.kindnessActs || 0) + 1
    : Math.max(1, b.kindnessActs || 0);
  renderAll();
  updateReadout();
  if (isNew) {
    activity.refresh(b, state.clockHours, true);
  }
}

setupViewMode({
  onChange: () => {
    if (!mapView.available) {
      return;
    }
    // The phone frame resizes the map pane; refit after the layout settles.
    requestAnimationFrame(() => {
      mapView.invalidateSize();
      mapView.fitAll();
    });
  },
});

// Reset restores the LAST LOADED catalog snapshot, not any baked-in data.
document.getElementById('reset').addEventListener('click', () => {
  state.metersPerUnit = METERS_PER_UNIT_DEFAULT;
  state.clockHours = 0;
  state.clustering = true;
  clusterCheckbox.checked = true;
  for (const [i, b] of BUSINESSES.entries()) {
    const snap = INITIAL[i];
    if (!snap) {
      continue;
    }
    Object.assign(b, snap);
  }
  mpuSlider.value = String(METERS_PER_UNIT_DEFAULT);
  mpuValue.textContent = String(METERS_PER_UNIT_DEFAULT);
  activity.clearError();
  geocoder.reset();
  if (mapView.available) {
    mapView.clearPreview();
  }
  select(BUSINESSES.length ? Math.max(state.selected, 0) : -1);
  if (mapView.available) {
    mapView.fitAll();
  }
});

renderAll();
select(-1);
if (mapView.available) {
  mapView.invalidateSize();
  mapView.fitAll();
}
loadCatalog();

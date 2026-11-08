// Leaflet map view: every visible shape is a geographic L.circle sized by
// bubbleDimensions; clusterBusinesses decides which businesses share one
// circle at the current zoom (world-coord proximity - pan never regroups).
import { bubbleDimensions } from './bubble-dimensions.mjs';
import { businessAppearance } from './business-recency.mjs';
import { regionAppearance } from './connected-regions.mjs';
import { clusterBusinesses, INDIVIDUAL_RADIUS_MULTIPLIER }
  from './business-clusters.mjs';
import { createBusinessSkins } from './business-skins.mjs';

const FIT_MAX_ZOOM = 15;
const SPLIT_ZOOM = 16;
const CLUSTER_PIXELS = 64;
const PREVIEW_COLOR = '#6d28d9';

export function createMapView(container, { onSelect, onTileError, onDisplayChange }) {
  if (typeof window === 'undefined' || !window.L) {
    return { available: false };
  }
  const L = window.L;
  const map = L.map(container, { attributionControl: true });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  })
    .on('tileerror', () => onTileError())
    .addTo(map);

  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  map.attributionControl.setPosition('bottomright');
  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

  const fitControl = L.control({ position: 'topleft' });
  fitControl.onAdd = () => {
    const btn = L.DomUtil.create('button', 'fit-control');
    btn.type = 'button';
    btn.textContent = 'Fit businesses';
    L.DomEvent.disableClickPropagation(btn);
    return btn;
  };
  fitControl.addTo(map);
  container.querySelector('.fit-control').addEventListener('click', () => fitAll());

  const circles = new Map();      // display-group id -> L.circle
  const groupsById = new Map();   // display-group id -> group
  const businessById = new Map(); // business id -> latest fixture data
  const skins = createBusinessSkins({
    map, circles, groupsById, getNowHours: () => nowHours,
  });
  let preview = null;
  let hoveredId = null; // pointer is over a display circle
  let focusedId = null; // keyboard focus is on a display circle's path
  let pinnedId = null;  // display circle last tapped/clicked
  let nowHours = 0;
  let lastArgs = null;       // inputs to re-render after zoom changes
  let lastBusinesses = [];   // originals, for fitAll extents

  // One shared on-demand label: syncTooltip() alone shows/moves/removes it.
  const tip = L.tooltip({
    permanent: true, direction: 'center', className: 'bubble-tip', interactive: false,
  });

  // Kindness recency: only linked acts refresh; ordinary scans never do.
  function recencyLine(b) {
    const app = businessAppearance(b, nowHours);
    return app.ageHours === null
      ? app.label
      : `${app.label} - last act of kindness ${app.ageHours.toFixed(1)} h ago`;
  }

  function businessTip(b) {
    const el = document.createElement('div');
    const line1 = document.createElement('div');
    line1.textContent = `${b.name} - ${b.visitors.toLocaleString()} unique visitors`;
    const line2 = document.createElement('div');
    line2.textContent = recencyLine(b);
    el.append(line1, line2);
    return el;
  }

  function clusterTip(g) {
    const el = document.createElement('div');
    const head = document.createElement('div');
    head.textContent = `${g.members.length} businesses`;
    const pop = document.createElement('div');
    pop.textContent =
      `Clustering population: ${g.totalPopulation.toLocaleString()} ` +
      '(sum across businesses)';
    const reach = document.createElement('div');
    reach.textContent =
      `Inclusion limit: ${Math.round(g.inclusionDistanceMeters)} m ` +
      `(weight ${g.weightMultiplier.toFixed(1)})`;
    el.append(head, pop, reach);
    for (const m of g.members) {
      const row = document.createElement('div');
      row.textContent =
        `${m.name} - ${m.visitors.toLocaleString()} unique visitors - ` +
        businessAppearance(m, nowHours).label;
      el.append(row);
    }
    const note = document.createElement('div');
    note.className = 'tip-note';
    note.textContent = 'Counts are per business; people may repeat.';
    el.append(note);
    return el;
  }

  // Priority: live pointer, then keyboard focus, then the remembered pin.
  function syncTooltip() {
    const id = hoveredId ?? focusedId ?? pinnedId;
    const g = id == null ? null : groupsById.get(id);
    if (!g) {
      tip.remove();
      return;
    }
    tip.setLatLng([g.lat, g.lng]);
    tip.setContent(g.members.length === 1
      ? businessTip(businessById.get(g.members[0].id))
      : clusterTip(g));
    if (!map.hasLayer(tip)) {
      tip.addTo(map);
    }
  }

  function expandCluster(g) {
    const bounds = L.latLngBounds(g.members.map((m) => [m.lat, m.lng]));
    const target = Math.min(SPLIT_ZOOM,
      Math.max(map.getZoom() + 1, map.getBoundsZoom(bounds.pad(0.4))));
    map.setView([g.lat, g.lng], target);
  }

  // Hover/focus show the label; tap selects or expands. Groups are rebuilt
  // each render, so handlers resolve the current group by id at fire time.
  function activateGroup(id, pin) {
    const g = groupsById.get(id);
    if (!g) {
      return;
    }
    if (g.members.length > 1) {
      expandCluster(g);
      return;
    }
    if (pin) {
      pinnedId = id;
      syncTooltip();
    }
    onSelect(g.members[0].id);
  }

  function bindTarget(layer, id) {
    layer.on('mouseover', () => {
      hoveredId = id;
      syncTooltip();
    });
    layer.on('mouseout', () => {
      if (hoveredId === id) {
        hoveredId = null;
      }
      syncTooltip();
    });
    layer.on('click', () => activateGroup(id, true));
  }

  function bindElement(el, id) {
    el.addEventListener('focus', () => {
      focusedId = id;
      syncTooltip();
    });
    el.addEventListener('blur', () => {
      if (focusedId === id) {
        focusedId = null;
      }
      syncTooltip();
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') {
        return;
      }
      ev.preventDefault();
      activateGroup(id);
    });
  }

  function decorate(el, g, selected, app) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-pressed', String(selected));
    // Whole-circle transparency (fill AND stroke) = kindness recency band.
    el.style.opacity = String(app.opacity);
    if (g.members.length === 1) {
      const b = businessById.get(g.members[0].id);
      el.setAttribute('aria-label',
        `${b.name}: ${b.visitors.toLocaleString()} unique visitors, ` +
        `${Math.round(g.radiusMeters * 2)} m diameter, ${app.label.toLowerCase()}`);
    } else {
      el.setAttribute('aria-label',
        `${g.members.length} businesses, zoom in to explore, ${app.label.toLowerCase()}`);
    }
  }

  function applyDisplay() {
    const { businesses, metersPerUnit, selectedId, clusterEnabled } = lastArgs;
    const seen = new Set();
    const disks = businesses.map((b) => ({
      id: b.id, name: b.name, visitors: b.visitors, lat: b.lat, lng: b.lng,
      radiusMeters: bubbleDimensions(b.visitors, metersPerUnit).radiusMeters,
      lastAt: b.lastAt, logoUrl: b.logoUrl,
      recencyKnown: b.recencyKnown, kindnessActs: b.kindnessActs,
    }));
    const groups = clusterBusinesses(disks, {
      zoom: map.getZoom(),
      project: (lat, lng, z) => map.project([lat, lng], z),
      unproject: (pt, z) => map.unproject(pt, z),
      distanceMeters: (a, b) => map.distance(a, b),
      enabled: clusterEnabled,
      pixelDistance: CLUSTER_PIXELS,
      splitZoom: SPLIT_ZOOM,
    });
    groupsById.clear();
    for (const g of groups) {
      groupsById.set(g.id, g);
      seen.add(g.id);
      for (const m of g.members) {
        businessById.set(m.id, m);
      }
      const multi = g.members.length > 1;
      const app = multi
        ? regionAppearance(g.members, nowHours)
        : businessAppearance(businessById.get(g.members[0].id), nowHours);
      const selected = multi
        ? g.members.some((m) => m.id === selectedId)
        : g.id === selectedId;
      let circle = circles.get(g.id);
      if (!circle) {
        circle = L.circle([g.lat, g.lng], {
          radius: g.radiusMeters,
          color: app.color,
          weight: selected ? 3 : 2,
          fillColor: app.color,
          fillOpacity: app.fillOpacity,
          className: multi ? 'business-circle cluster-circle' : 'business-circle',
          // Circle clicks must not reach the map's background-click handler.
          bubblingMouseEvents: false,
        });
        circle.addTo(map);
        bindTarget(circle, g.id);
        const el = circle.getElement();
        if (el) {
          bindElement(el, g.id);
        }
        circles.set(g.id, circle);
      }
      circle.setLatLng([g.lat, g.lng]);
      circle.setRadius(g.radiusMeters);
      circle.setStyle({
        stroke: true,
        color: app.color,
        fillColor: app.color,
        fillOpacity: app.fillOpacity,
        weight: selected ? 3 : 2,
      });
      const cel = circle.getElement();
      if (cel) {
        decorate(cel, g, selected, app);
      }
      if (selected) {
        circle.bringToFront();
      }
    }
    // Drop circles for stale groups and label state pointing at them -
    // a zoom change never reopens a label.
    for (const [id, circle] of circles) {
      if (!seen.has(id)) {
        circle.remove();
        circles.delete(id);
      }
    }
    for (const id of businessById.keys()) {
      if (!businesses.some((b) => b.id === id)) {
        businessById.delete(id);
      }
    }
    if (hoveredId != null && !groupsById.has(hoveredId)) {
      hoveredId = null;
    }
    if (focusedId != null && !groupsById.has(focusedId)) {
      focusedId = null;
    }
    if (pinnedId != null && !groupsById.has(pinnedId)) {
      pinnedId = null;
    }
    syncTooltip();
    // Logo skins re-seat under their circles after every native update.
    skins.render();
    if (onDisplayChange) {
      onDisplayChange(groups.length, businesses.length, map.getZoom());
    }
  }

  function render(businesses, metersPerUnit, selectedId, currentHours, clusterEnabled) {
    nowHours = currentHours;
    lastBusinesses = businesses;
    lastArgs = { businesses, metersPerUnit, selectedId, clusterEnabled };
    applyDisplay();
  }

  // Zooming can merge or split groups; the latest render inputs are reused.
  map.on('zoomend', () => {
    if (lastArgs) {
      applyDisplay();
    }
  });

  // Fit the union of ORIGINAL business extents, never cluster centroids.
  function fitAll() {
    let bounds = null;
    for (const b of lastBusinesses) {
      const r = bubbleDimensions(b.visitors,
        lastArgs ? lastArgs.metersPerUnit : 5).radiusMeters *
        INDIVIDUAL_RADIUS_MULTIPLIER;
      const bb = L.latLng(b.lat, b.lng).toBounds(r * 2);
      bounds = bounds ? bounds.extend(bb) : bb;
    }
    if (bounds) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: FIT_MAX_ZOOM });
    }
  }

  // A click on the blank map clears every label state (circle clicks do
  // not reach this handler - they do not bubble).
  map.on('click', () => {
    hoveredId = focusedId = pinnedId = null;
    syncTooltip();
  });

  function showPreview(lat, lng) {
    clearPreview();
    preview = L.circleMarker([lat, lng], {
      radius: 9,
      color: PREVIEW_COLOR,
      weight: 3,
      fillColor: PREVIEW_COLOR,
      fillOpacity: 0.25,
      dashArray: '4 3',
    }).addTo(map);
    map.panTo(preview.getLatLng());
  }

  function clearPreview() {
    if (preview) {
      preview.remove();
      preview = null;
    }
  }

  function invalidateSize() {
    map.invalidateSize();
  }

  // Center a business by id at close zoom - no pin, just the map moving.
  function focusBusiness(id) {
    const b = lastBusinesses.find((x) => x.id === id);
    if (!b) {
      return false;
    }
    map.setView([b.lat, b.lng], 18);
    return true;
  }

  map.setView([51.078, -114.13], 13);

  return { available: true, render, fitAll, showPreview, clearPreview,
    invalidateSize, focusBusiness };
}

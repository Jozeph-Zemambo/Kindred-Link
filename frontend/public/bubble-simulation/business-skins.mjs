// Business logo "skins": an SVG <image> clipped by each single-business
// circle's own path, inserted immediately before that path so the recency
// outline still paints on top. Multi-business cluster circles stay plain -
// no single brand represents a shared circle.
import { contributionAppearance } from './recency.mjs';
import { businessAppearance } from './business-recency.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createBusinessSkins({ map, circles, groupsById, getNowHours }) {
  const skins = new Map();  // display-group id -> {g, clipPath, image, url}
  const loads = new Map();  // logoUrl -> 'loading' | 'loaded' | 'failed'
  let clipSeq = 0;
  let pending = false;

  // Only API-normalized http(s) logo URLs on single-business groups qualify.
  function wantsSkin(g) {
    const url = g.members.length === 1 ? g.members[0].logoUrl : null;
    return typeof url === 'string' && /^https?:/i.test(url);
  }

  // Coalesce all sync sources (map events, async image loads) into one
  // render per animation frame.
  function refresh() {
    if (pending) {
      return;
    }
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render();
    });
  }

  function logoState(url) {
    if (loads.has(url)) {
      return loads.get(url);
    }
    loads.set(url, 'loading');
    const img = new Image();
    img.onload = () => {
      loads.set(url, 'loaded');
      refresh();
    };
    img.onerror = () => {
      loads.set(url, 'failed');
      refresh();
    };
    img.src = url;
    return 'loading';
  }

  function createSkin(id, url) {
    const gEl = document.createElementNS(SVG_NS, 'g');
    gEl.setAttribute('class', 'business-skin');
    gEl.setAttribute('pointer-events', 'none');
    gEl.setAttribute('aria-hidden', 'true');
    const clipId = `skin-clip-${++clipSeq}`;
    const defs = document.createElementNS(SVG_NS, 'defs');
    const clip = document.createElementNS(SVG_NS, 'clipPath');
    clip.setAttribute('id', clipId);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const clipPath = document.createElementNS(SVG_NS, 'path');
    clip.append(clipPath);
    defs.append(clip);
    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttribute('class', 'business-skin-image');
    image.setAttribute('href', url);
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    image.setAttribute('clip-path', `url(#${clipId})`);
    image.addEventListener('error', () => {
      loads.set(url, 'failed');
      refresh();
    });
    gEl.append(defs, image);
    const skin = { g: gEl, clipPath, image, url };
    skins.set(id, skin);
    return skin;
  }

  // Copy the circle's CURRENT path geometry; degenerate/offscreen paths
  // ('M0 0') report false so the plain fill stays visible.
  function syncGeometry(skin, el) {
    const d = el.getAttribute('d');
    if (!d) {
      return false;
    }
    let bbox;
    try {
      bbox = el.getBBox();
    } catch {
      return false;
    }
    if (!(bbox.width > 0) || !(bbox.height > 0)) {
      return false;
    }
    skin.clipPath.setAttribute('d', d);
    skin.image.setAttribute('x', bbox.x);
    skin.image.setAttribute('y', bbox.y);
    skin.image.setAttribute('width', bbox.width);
    skin.image.setAttribute('height', bbox.height);
    return true;
  }

  function restoreFill(id) {
    const circle = circles.get(id);
    const g = groupsById.get(id);
    if (!circle || !g || g.members.length !== 1) {
      return;
    }
    const m = g.members[0];
    const age = m.lastAt == null ? null : getNowHours() - m.lastAt;
    circle.setStyle({ fillOpacity: contributionAppearance(age).fillOpacity });
  }

  function render() {
    const alive = new Set();
    for (const [id, g] of groupsById) {
      const circle = circles.get(id);
      const el = circle && circle.getElement ? circle.getElement() : null;
      const url = wantsSkin(g) ? g.members[0].logoUrl : null;
      if (!el || !el.parentNode || !url || logoState(url) !== 'loaded') {
        continue;
      }
      let skin = skins.get(id);
      if (skin && skin.url !== url) {
        // The error closure is bound to its URL - never mutate it. A new
        // logo URL gets a fresh skin so a stale handler can't mis-mark it.
        skin.g.remove();
        skins.delete(id);
        skin = null;
      }
      skin ??= createSkin(id, url);
      if (!syncGeometry(skin, el)) {
        continue;
      }
      // Always re-seat directly before the circle path: bringToFront moves
      // paths, and this keeps the skin under - and only under - its circle.
      el.parentNode.insertBefore(skin.g, el);
      // Same band opacity as the circle - once on the group, never squared.
      skin.g.setAttribute('opacity', String(
        businessAppearance(g.members[0], getNowHours()).opacity));
      circle.setStyle({ fillOpacity: 0 });
      alive.add(id);
    }
    // Drop skins for gone/clustered/offscreen circles; never leave an
    // invisible disk behind when the logo went away.
    for (const [id, skin] of skins) {
      if (!alive.has(id)) {
        skin.g.remove();
        skins.delete(id);
        restoreFill(id);
      }
    }
  }

  // Leaflet re-projects paths on these events; re-sync geometry after they
  // settle (one coalesced frame).
  for (const ev of ['zoomend', 'moveend', 'viewreset', 'resize']) {
    map.on(ev, refresh);
  }

  return { render };
}

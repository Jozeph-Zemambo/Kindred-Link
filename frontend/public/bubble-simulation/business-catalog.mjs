// Live business catalog for the bubble lab: GET /api/businesses once per
// explicit load, normalize and validate the payload into sim records.
// Read-only - local preview edits never write back to the API.

const FETCH_TIMEOUT_MS = 8_000;

export function normalizeApiBase(input) {
  const url = new URL(String(input).trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RangeError('Business API base must be an http(s) URL');
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}

// Optional recency fields on newer backends. lastKindnessAt must be an ISO
// timestamp with an explicit Z/offset; absent means the server is too old to
// report it (recencyKnown false), null means none recorded (known, none).
function normalizeKindness(raw, id, nowMs) {
  const out = { lastAt: null, lastKindnessAt: null, recencyKnown: true };
  if (!('lastKindnessAt' in raw)) {
    out.recencyKnown = false;
  } else if (raw.lastKindnessAt !== null) {
    const s = raw.lastKindnessAt;
    if (typeof s !== 'string' || !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s.trim())) {
      throw new RangeError(`business ${id} lastKindnessAt must be ISO with offset`);
    }
    const ms = Date.parse(s);
    if (!Number.isFinite(ms)) {
      throw new RangeError(`business ${id} lastKindnessAt is not a valid date`);
    }
    out.lastKindnessAt = s;
    out.lastAt = -Math.max(0, (nowMs - ms) / 3_600_000);
  }
  if ('kindnessActs' in raw) {
    if (!Number.isSafeInteger(raw.kindnessActs) || raw.kindnessActs < 0) {
      throw new RangeError(`business ${id} kindnessActs must be a non-negative integer`);
    }
    out.kindnessActs = raw.kindnessActs;
  }
  if ('opacity' in raw
      && (!Number.isFinite(raw.opacity) || raw.opacity < 0 || raw.opacity > 1)) {
    throw new RangeError(`business ${id} opacity must be a number 0..1`);
  }
  return out;
}

export function normalizeBusinesses(payload, apiBase, { nowMs = Date.now() } = {}) {
  if (!Array.isArray(payload)) {
    throw new TypeError('business response must be a JSON array');
  }
  const base = normalizeApiBase(apiBase);
  const seen = new Set();
  return payload.map((raw) => {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new TypeError('business entry must be an object');
    }
    const { id, name, lat, lng, logoUrl, visitors } = raw;
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new RangeError(`business id must be a positive integer, got ${id}`);
    }
    if (seen.has(id)) {
      throw new RangeError(`duplicate business id ${id}`);
    }
    seen.add(id);
    if (typeof name !== 'string' || name.trim() === '') {
      throw new RangeError(`business ${id} name must be a non-blank string`);
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90
        || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new RangeError(`business ${id} coordinates out of range`);
    }
    if (!Number.isSafeInteger(visitors) || visitors < 0) {
      throw new RangeError(
        `business ${id} visitors must be a non-negative safe integer`);
    }
    let logo = null;
    if (logoUrl != null) {
      if (typeof logoUrl !== 'string' || logoUrl.trim() === '') {
        throw new RangeError(`business ${id} logoUrl must be a string or null`);
      }
      const resolved = new URL(logoUrl, `${base}/`);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        throw new RangeError(`business ${id} logoUrl must resolve to http(s)`);
      }
      logo = resolved.href;
    }
    // Kindness recency comes from lastKindnessAt when the backend reports it;
    // older servers get recencyKnown false instead of invented history.
    return {
      id: `business-${id}`,
      backendId: id,
      name,
      lat,
      lng,
      logoUrl: logo,
      visitors,
      kindnessActs: 0,
      locationLabel: 'Backend location - supplied coordinates',
      ...normalizeKindness(raw, id, nowMs),
    };
  });
}

class CatalogError extends Error {}

function httpError(status) {
  return new CatalogError(`Business catalog request failed (HTTP ${status}).`);
}

export async function fetchBusinesses(apiBase,
    { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const base = normalizeApiBase(apiBase);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let payload;
  try {
    const resp = await fetchImpl(`${base}/api/businesses`, { signal: ctrl.signal });
    if (!resp.ok) {
      throw httpError(resp.status);
    }
    try {
      payload = await resp.json();
    } catch (e) {
      if (e.name === 'AbortError') {
        throw e; // body read aborted by the timeout - not a JSON problem
      }
      throw new CatalogError('Business catalog returned non-JSON data.');
    }
  } catch (e) {
    if (e instanceof CatalogError) {
      throw e;
    }
    if (e.name === 'AbortError') {
      throw new CatalogError('Business catalog request timed out.');
    }
    throw new CatalogError(
      'Business catalog unreachable - is the backend running at that address?');
  } finally {
    clearTimeout(timer);
  }
  try {
    return normalizeBusinesses(payload, base);
  } catch (e) {
    throw new CatalogError(`Invalid business catalog data: ${e.message}`);
  }
}

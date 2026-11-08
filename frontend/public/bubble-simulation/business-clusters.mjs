// Zoom-based clustering: businesses whose projected centers sit within
// `pixelDistance` screen pixels display as ONE round circle, subject to a
// geographic fence: every member must lie within `inclusionDistanceMeters`
// of the group's population-weighted centroid. Membership is computed in
// world coordinates, so panning never regroups and zooming in naturally
// splits groups. At zoom >= splitZoom (or when disabled) every business
// shows as its own circle, even coincident ones. Inclusion reach is
// 200 m * populationWeight(summed visitors) - a sum across businesses,
// never a unique-people count. A cluster's display radiusMeters is
// 3.6 * sqrt(sum r^2): a display-only choice, never area-weighted.

const BASE_REACH_METERS = 200;
// Display-only scale for cluster circles; reach and membership are unaffected.
const CLUSTER_RADIUS_MULTIPLIER = 3.6;
// Display-only scale for individual business circles; never applied to the
// base member radii inside the cluster formula.
export const INDIVIDUAL_RADIUS_MULTIPLIER = 1.3;

export function populationWeight(totalPopulation) {
  if (!Number.isSafeInteger(totalPopulation) || totalPopulation < 0) {
    throw new RangeError(
      'totalPopulation must be a non-negative safe integer');
  }
  const bracket = Math.max(0, Math.ceil(totalPopulation / 5000) - 1);
  return 1 + bracket * 0.2;
}

export function clusterBusinesses(disks, {
  zoom,
  project,
  unproject,
  distanceMeters,
  enabled = true,
  pixelDistance = 64,
  splitZoom = 16,
}) {
  let grandTotal = 0;
  for (const d of disks) {
    if (!Number.isSafeInteger(d.visitors) || d.visitors < 0) {
      throw new RangeError(
        'disk visitors must be a non-negative safe integer');
    }
    grandTotal += d.visitors;
    if (!Number.isSafeInteger(grandTotal)) {
      throw new RangeError('summed visitors exceed the safe integer range');
    }
  }
  const singles = () => disks.map((d) => single(d));
  if (!enabled || zoom >= splitZoom) {
    return singles();
  }
  const pts = new Map(disks.map((d) => [d, project(d.lat, d.lng, zoom)]));

  // Population-weighted centroid in projected space (unprojected for
  // geographic distance checks); zero-total groups use the arithmetic mean.
  function groupOf(members) {
    const sorted = members.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const total = sorted.reduce((s, m) => s + m.visitors, 0);
    let sx = 0;
    let sy = 0;
    for (const m of sorted) {
      const p = pts.get(m);
      const w = total === 0 ? 1 / sorted.length : m.visitors / total;
      sx += p.x * w;
      sy += p.y * w;
    }
    return { members: sorted, ids: sorted.map((m) => m.id), total,
      center: unproject({ x: sx, y: sy }, zoom) };
  }

  // A candidate may merge only when EVERY member sits within its own
  // inclusion reach of the recalculated weighted centroid - no chained
  // groups may stretch past the fence.
  function validCandidate(g) {
    const reach = BASE_REACH_METERS * populationWeight(g.total) + 1e-9;
    return g.members.every(
      (m) => distanceMeters(m, g.center) <= reach);
  }

  function pixelLinked(a, b) {
    return a.members.some((m1) => b.members.some((m2) => {
      const p1 = pts.get(m1);
      const p2 = pts.get(m2);
      return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= pixelDistance;
    }));
  }

  let groups = disks
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((d) => groupOf([d]));

  // Greedy agglomeration: repeatedly merge the geographically closest
  // eligible pair, re-validating every member against the new centroid.
  for (;;) {
    let best = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (!pixelLinked(groups[i], groups[j])) {
          continue;
        }
        const cand = groupOf([...groups[i].members, ...groups[j].members]);
        if (!validCandidate(cand)) {
          continue;
        }
        const sep = distanceMeters(groups[i].center, groups[j].center);
        const key = JSON.stringify(cand.ids);
        if (!best || sep < best.sep || (sep === best.sep && key < best.key)) {
          best = { i, j, sep, key, cand };
        }
      }
    }
    if (!best) {
      break;
    }
    groups = groups.filter((_, k) => k !== best.i && k !== best.j);
    groups.push(best.cand);
  }

  return groups
    .map((g) => (g.members.length === 1 ? single(g.members[0]) : cluster(g)))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function single(d) {
  const weight = populationWeight(d.visitors);
  return { id: d.id, members: [d], lat: d.lat, lng: d.lng,
    radiusMeters: d.radiusMeters * INDIVIDUAL_RADIUS_MULTIPLIER,
    lastAt: d.lastAt,
    totalPopulation: d.visitors, weightMultiplier: weight,
    inclusionDistanceMeters: BASE_REACH_METERS * weight };
}

function cluster(g) {
  let lastAt = null;
  for (const m of g.members) {
    if (m.lastAt != null && (lastAt == null || m.lastAt > lastAt)) {
      lastAt = m.lastAt;
    }
  }
  const weight = populationWeight(g.total);
  return {
    id: `cluster-${JSON.stringify(g.ids)}`,
    members: g.members,
    lat: g.center.lat,
    lng: g.center.lng,
    totalPopulation: g.total,
    weightMultiplier: weight,
    inclusionDistanceMeters: BASE_REACH_METERS * weight,
    radiusMeters:
      Math.hypot(...g.members.map((m) => m.radiusMeters)) *
      CLUSTER_RADIUS_MULTIPLIER,
    lastAt,
  };
}

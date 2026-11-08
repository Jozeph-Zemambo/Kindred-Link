// Connected-region grouping for the bubble lab. Two geographic disks connect
// when their center distance <= rA + rB (touching counts); transitive chains
// form one component. Purely geometric - no counts are aggregated and no new
// radii are derived.
import { contributionAppearance } from './recency.mjs';

export function connectedRegions(disks, distanceMeters) {
  const parent = disks.map((_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let i = 0; i < disks.length; i++) {
    for (let j = i + 1; j < disks.length; j++) {
      if (distanceMeters(disks[i], disks[j])
          <= disks[i].radiusMeters + disks[j].radiusMeters) {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) {
          parent[rj] = ri;
        }
      }
    }
  }
  const byRoot = new Map();
  disks.forEach((disk, i) => {
    const root = find(i);
    if (!byRoot.has(root)) {
      byRoot.set(root, []);
    }
    byRoot.get(root).push(disk);
  });
  return [...byRoot.values()];
}

// A region shares the vibrancy and opacity of its freshest member's last act
// of kindness (smallest age); all-null groups render as 'none', or 'unknown'
// when a member's backend never reported a timestamp field. Visitor counts
// are never summed.
export function regionAppearance(group, nowHours) {
  let freshestAge = null;
  for (const disk of group) {
    if (disk.lastAt == null) {
      continue;
    }
    const age = Math.max(0, nowHours - disk.lastAt);
    if (freshestAge === null || age < freshestAge) {
      freshestAge = age;
    }
  }
  const app = contributionAppearance(freshestAge);
  if (freshestAge !== null) {
    return app;
  }
  return {
    ...app,
    label: group.some((d) => d.recencyKnown === false)
      ? 'Kindness recency unknown'
      : 'No recorded acts of kindness',
  };
}

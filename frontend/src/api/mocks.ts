import type { BusinessHub, ChainNode, ChainStats, ChainTree, NodeDetail, NodePin, Recap } from './types';

// Fake data in the exact API shapes, around UCalgary like backend DemoData.java.
// Used when EXPO_PUBLIC_USE_MOCKS=1, and for the recap screen until its endpoint exists.

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

type Seed = [id: number, parentId: number | null, lat: number, lng: number, hours: number, mine: boolean, text: string];

function tree(chainId: number, seeds: Seed[]): ChainTree {
  const depth = new Map<number, number>();
  const nodes: ChainNode[] = seeds.map(([id, parentId, lat, lng, hours, mine, description]) => {
    const d = parentId === null ? 0 : (depth.get(parentId) ?? 0) + 1;
    depth.set(id, d);
    const children = seeds.filter((s) => s[1] === id).length;
    return {
      id, parentId, depth: d, lat, lng, createdAt: hoursAgo(hours),
      openSlots: hours < 12 ? Math.max(0, 2 - children) : 0,
      hasPhoto: false, mine, description,
    };
  });
  return { chainId, status: nodes.some((n) => n.openSlots > 0) ? 'ACTIVE' : 'ENDED', nodes };
}

/** A branching net: 1 → (2, 3), 2 → 4, 3 → (5, 6), 5 → 7. Node 3 is "mine". */
export const mockNet = tree(1, [
  [1, null, 51.0802, -114.1305, 9, false, 'Paid for the coffee of the person behind me'],
  [2, 1, 51.0789, -114.1318, 8, false, 'Held the door and helped carry boxes'],
  [3, 1, 51.0771, -114.129, 7, true, 'Left a kind note on a bus seat'],
  [4, 2, 51.076, -114.1335, 5, false, "Shovelled a neighbour's walk"],
  [5, 3, 51.0748, -114.1272, 4, false, 'Bought lunch for a classmate'],
  [6, 3, 51.0735, -114.1301, 3, false, 'Returned a lost wallet'],
  [7, 5, 51.0721, -114.1255, 1, false, 'Gave away spare winter gloves'],
]);

/** A mostly straight chain I started: 10 → 11 → 12 → 13, plus 11 → 14. */
export const mockLine = tree(10, [
  [10, null, 51.0855, -114.1402, 30, true, 'Paid a parking meter about to expire'],
  [11, 10, 51.0868, -114.1371, 27, false, 'Helped someone carry groceries'],
  [12, 11, 51.0881, -114.1339, 24, false, 'Tutored a classmate for free'],
  [13, 12, 51.0897, -114.1312, 20, false, 'Brought snacks to the study room'],
  [14, 11, 51.0842, -114.1349, 22, false, 'Shared an umbrella at the bus stop'],
]);

const ACTS = [
  'Paid for a stranger’s coffee', 'Helped carry groceries up the stairs', 'Left a thank-you note for the bus driver',
  'Shovelled the sidewalk for the whole block', 'Gave directions and walked them there', 'Donated warm socks to the shelter',
  'Fixed a flat bike tire for a classmate', 'Bought a meal for someone who needed one', 'Returned a lost phone',
  'Tutored a friend before their exam', 'Picked up litter along the path', 'Shared an umbrella in the rain',
];

/** A straight line of `count` acts from `start`, one every `stepHours`, the newest `endHours` ago. */
function line(chainId: number, start: [number, number], step: [number, number], count: number, endHours: number, stepHours: number): ChainTree {
  return tree(
    chainId,
    Array.from({ length: count }, (_, i): Seed => [
      chainId + i,
      i === 0 ? null : chainId + i - 1,
      start[0] + step[0] * i,
      start[1] + step[1] * i,
      endHours + (count - 1 - i) * stepHours,
      false,
      ACTS[(chainId + i) % ACTS.length],
    ]),
  );
}

/** Other open lines around campus so the find view has popular and quiet nodes to compare. */
const nearbyLines = [
  line(100, [51.089, -114.142], [0.0007, 0.0012], 12, 1.5, 0.9),
  line(200, [51.07, -114.145], [0.0006, 0.0009], 7, 2, 1),
  line(300, [51.083, -114.118], [-0.0008, 0.0004], 4, 1, 1.2),
  line(400, [51.0745, -114.1385], [0, 0], 1, 0.5, 0),
];

const allTrees = [mockNet, mockLine, ...nearbyLines];
const allNodes = allTrees.flatMap((t) => t.nodes.map((n) => ({ n, chainId: t.chainId })));

export function mockChain(chainId: number): ChainTree {
  return allTrees.find((t) => t.chainId === chainId) ?? mockNet;
}

export function mockPins(onlyMine: boolean): NodePin[] {
  return allNodes
    .filter(({ n }) => !onlyMine || n.mine)
    .map(({ n, chainId }) => ({
      id: n.id, chainId, parentId: n.parentId, lat: n.lat, lng: n.lng, openSlots: n.openSlots,
      createdAt: n.createdAt, closesAt: new Date(Date.parse(n.createdAt) + 12 * 3_600_000).toISOString(),
      hasPhoto: n.hasPhoto, mine: n.mine,
      childCount: allNodes.filter(({ n: c }) => c.parentId === n.id).length,
      depth: n.depth,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A few acts with photos (placeholder images, mixed shapes) to exercise the 4:3 crop. */
const MOCK_PHOTOS: Record<number, string> = {
  5: 'https://picsum.photos/seed/kindred-lunch/900/1200',
  7: 'https://picsum.photos/seed/kindred-gloves/1200/700',
  111: 'https://picsum.photos/seed/kindred-snow/1000/1000',
};

export function mockNode(id: number): NodeDetail {
  const found = allNodes.find(({ n }) => n.id === id) ?? allNodes[0];
  const { n, chainId } = found;
  return {
    id: n.id, chainId, parentId: n.parentId, depth: n.depth, description: n.description ?? '',
    photoUrl: MOCK_PHOTOS[n.id] ?? null, lat: n.lat, lng: n.lng, openSlots: n.openSlots, createdAt: n.createdAt,
    closesAt: new Date(Date.parse(n.createdAt) + 12 * 3_600_000).toISOString(),
    childIds: allNodes.filter(({ n: c }) => c.parentId === n.id).map(({ n: c }) => c.id),
    mine: n.mine,
  };
}

export function mockStats(chainId: number): ChainStats {
  const t = mockChain(chainId);
  return {
    chainId, status: t.status, links: t.nodes.length, totalDistanceMeters: 1840, neighbourhoodsReached: 3,
    maxDepth: Math.max(...t.nodes.map((n) => n.depth)), openSlots: t.nodes.reduce((s, n) => s + n.openSlots, 0),
    startedAt: t.nodes[0].createdAt, lastLinkAt: t.nodes[t.nodes.length - 1].createdAt,
  };
}

/** Same formula as backend BusinessBubbleSize.java, so mock bubbles grow like real ones. */
function diameterUnits(visitors: number): number {
  if (visitors <= 500) return 1 + visitors / 100;
  let remaining = visitors - 500;
  let width = 500;
  let denominator = 200;
  let diameter = 6;
  while (remaining > width) {
    remaining -= width;
    diameter += 2.5;
    width *= 2;
    denominator *= 2;
  }
  return diameter + remaining / denominator;
}

const business = (id: number, name: string, lat: number, lng: number, visitors: number, kindnessActs: number): BusinessHub => ({
  id, name, logoUrl: null, lat, lng, visitors, kindnessActs, diameterUnits: diameterUnits(visitors),
});

// Same names and spots as backend DemoData.java; visitor counts varied to show bubble growth.
export const mockBusinesses: BusinessHub[] = [
  business(1, 'Bean There Café', 51.0795, -114.1298, 2400, 310),
  business(2, 'Corner Grocer', 51.0765, -114.1325, 320, 41),
  business(3, 'Page Turner Books', 51.0812, -114.135, 40, 6),
];

const pick = (t: ChainTree, ids: number[]): ChainTree => ({ ...t, nodes: t.nodes.filter((n) => ids.includes(n.id)) });

export const mockRecap: Recap = {
  week: '2026-W45',
  longestChains: [pick(mockLine, [10, 11, 12, 13]), pick(mockNet, [1, 3, 5, 7]), pick(mockNet, [1, 3, 6])],
  largestNets: [mockNet, mockLine],
};

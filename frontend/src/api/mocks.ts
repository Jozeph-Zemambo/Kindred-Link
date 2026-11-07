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

const allNodes = [...mockNet.nodes.map((n) => ({ n, chainId: 1 })), ...mockLine.nodes.map((n) => ({ n, chainId: 10 }))];

export function mockChain(chainId: number): ChainTree {
  return chainId === 10 ? mockLine : mockNet;
}

export function mockPins(onlyMine: boolean): NodePin[] {
  return allNodes
    .filter(({ n }) => !onlyMine || n.mine)
    .map(({ n, chainId }) => ({
      id: n.id, chainId, parentId: n.parentId, lat: n.lat, lng: n.lng, openSlots: n.openSlots,
      createdAt: n.createdAt, closesAt: new Date(Date.parse(n.createdAt) + 12 * 3_600_000).toISOString(),
      hasPhoto: n.hasPhoto, mine: n.mine,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mockNode(id: number): NodeDetail {
  const found = allNodes.find(({ n }) => n.id === id) ?? allNodes[0];
  const { n, chainId } = found;
  return {
    id: n.id, chainId, parentId: n.parentId, depth: n.depth, description: n.description ?? '',
    photoUrl: null, lat: n.lat, lng: n.lng, openSlots: n.openSlots, createdAt: n.createdAt,
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

export const mockBusinesses: BusinessHub[] = [
  { id: 1, name: 'Bean There Café', logoUrl: null, lat: 51.0795, lng: -114.1298, visitors: 14, kindnessActs: 6 },
  { id: 2, name: 'Corner Grocer', logoUrl: null, lat: 51.0765, lng: -114.1325, visitors: 9, kindnessActs: 2 },
  { id: 3, name: 'Page Turner Books', logoUrl: null, lat: 51.0812, lng: -114.135, visitors: 5, kindnessActs: 1 },
];

const pick = (t: ChainTree, ids: number[]): ChainTree => ({ ...t, nodes: t.nodes.filter((n) => ids.includes(n.id)) });

export const mockRecap: Recap = {
  week: '2026-W45',
  longestChains: [pick(mockLine, [10, 11, 12, 13]), pick(mockNet, [1, 3, 5, 7]), pick(mockNet, [1, 3, 6])],
  largestNets: [mockNet, mockLine],
};

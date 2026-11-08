import { API_URL, RECAP_ENDPOINT_READY, USE_MOCKS } from './config';
import { getDeviceId } from './deviceId';
import { ancestors, descendants } from '@/map/graph';

import { mockBusinesses, mockChain, mockNode, mockPins, mockStats } from './mocks';
import type {
  ApiProblem,
  Account,
  BusinessHub,
  ChainNode,
  ChainStats,
  ChainTree,
  CheckinRequest,
  CheckinResult,
  ClaimRequest,
  ClaimResponse,
  CreateNodeRequest,
  NodeDetail,
  NodePin,
  PhotoUploadResponse,
  Recap,
} from './types';

// Every backend call goes through here. Screens import these functions, never fetch directly.

export class ApiError extends Error {
  constructor(public problem: ApiProblem) {
    super(problem.detail ?? problem.title);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': await getDeviceId(),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError({ status: res.status, title: body?.title ?? res.statusText, detail: body?.detail });
  }
  return res.json() as Promise<T>;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

/** Map pins within radius metres of a point (public, blurred locations). */
export function listNearby(lat: number, lng: number, radius = 5000): Promise<NodePin[]> {
  if (USE_MOCKS) return Promise.resolve(mockPins(false));
  return request(`/api/nodes?lat=${lat}&lng=${lng}&radius=${radius}`);
}

/** My own acts, newest first, so [0] is my latest node. */
export function listMine(): Promise<NodePin[]> {
  if (USE_MOCKS) return Promise.resolve(mockPins(true));
  return request('/api/nodes?mine=true');
}

export function getNode(id: number): Promise<NodeDetail> {
  if (USE_MOCKS) return Promise.resolve(mockNode(id));
  return request(`/api/nodes/${id}`);
}

/** Uploads a local image to the moderated photo endpoint and returns its server id. */
export async function uploadPhoto(uri: string): Promise<PhotoUploadResponse> {
  if (USE_MOCKS) return { id: 1, status: 'PENDING' };
  const form = new FormData();
  form.append('file', { uri, name: `kindred-${Date.now()}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  const res = await fetch(`${API_URL}/api/photos`, {
    method: 'POST',
    headers: { 'X-Device-Id': await getDeviceId() },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError({ status: res.status, title: body?.title ?? res.statusText, detail: body?.detail });
  }
  return res.json() as Promise<PhotoUploadResponse>;
}

/** Claim a nearby node before the user can post the next act. */
export function claimNode(nodeId: number, body: ClaimRequest): Promise<ClaimResponse> {
  if (USE_MOCKS) {
    const claimedAt = new Date().toISOString();
    return Promise.resolve({ claimedAt, finishBy: new Date(Date.now() + 12 * 3_600_000).toISOString() });
  }
  return request(`/api/nodes/${nodeId}/claim`, post(body));
}

/** Start a brand-new chain at my current GPS fix. */
export function createNode(body: CreateNodeRequest): Promise<NodeDetail> {
  if (USE_MOCKS) return Promise.resolve({ ...mockNode(3), description: body.description });
  return request('/api/nodes', post(body));
}

/** Continue a chain under parentId. Fails with ApiError titles slot_closed / own_node / too_far. */
export function continueNode(parentId: number, body: CreateNodeRequest): Promise<NodeDetail> {
  if (USE_MOCKS) return Promise.resolve({ ...mockNode(parentId), description: body.description });
  return request(`/api/nodes/${parentId}/continue`, post(body));
}

/** The entire tree for a chain (chainId = the root node's id). */
export function getChain(chainId: number): Promise<ChainTree> {
  if (USE_MOCKS) return Promise.resolve(mockChain(chainId));
  return request(`/api/chains/${chainId}`);
}

export function getChainStats(chainId: number): Promise<ChainStats> {
  if (USE_MOCKS) return Promise.resolve(mockStats(chainId));
  return request(`/api/chains/${chainId}/stats`);
}

export function listBusinesses(): Promise<BusinessHub[]> {
  if (USE_MOCKS) return Promise.resolve(mockBusinesses);
  return request('/api/businesses');
}

export function getCurrentAccount(accessToken: string): Promise<Account> {
  return request('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function checkin(businessId: number, body: CheckinRequest): Promise<CheckinResult> {
  if (USE_MOCKS) return Promise.resolve({ checkinId: 1, business: mockBusinesses[0] });
  return request(`/api/businesses/${businessId}/checkin`, post(body));
}

/** Weekly recap. Until the backend adds GET /api/me/recap, the app builds it from my nodes and their trees. */
export function getRecap(week?: string): Promise<Recap> {
  if (USE_MOCKS || !RECAP_ENDPOINT_READY) return buildRecap();
  return request(`/api/me/recap${week ? `?week=${week}` : ''}`);
}

/** Monday 00:00 local time: the start of the current kindness period (same window as Home). */
function periodStart(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** ISO week label ("2026-W45") for the week that starts on this Monday. */
function isoWeek(monday: Date): string {
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const dayOfYear = Math.round((thursday.getTime() - new Date(thursday.getFullYear(), 0, 1).getTime()) / 86_400_000);
  return `${thursday.getFullYear()}-W${String(Math.floor(dayOfYear / 7) + 1).padStart(2, '0')}`;
}

/** The node plus its longest path downward (root-to-leaf direction). */
function longestDown(nodes: ChainNode[], id: number): ChainNode[] {
  const node = nodes.find((n) => n.id === id);
  if (!node) return [];
  const below = nodes
    .filter((n) => n.parentId === id)
    .map((child) => longestDown(nodes, child.id))
    .sort((a, b) => b.length - a.length)[0];
  return [node, ...(below ?? [])];
}

const MAX_MOMENT_LOOKUPS = 12;

async function buildRecap(): Promise<Recap> {
  const start = periodStart();
  const mine = (await listMine()).filter((n) => Date.parse(n.createdAt) >= start.getTime());
  const trees = await Promise.all([...new Set(mine.map((n) => n.chainId))].map((id) => getChain(id)));
  const treeOf = (chainId: number) => trees.find((t) => t.chainId === chainId)!;

  // For each of my acts, the longest straight line through it: everyone before me, then the longest run after.
  const seen = new Set<string>();
  const lines = mine
    .map((m) => {
      const tree = treeOf(m.chainId);
      return { mineId: m.id, line: { ...tree, nodes: [...ancestors(tree.nodes, m.id).reverse(), ...longestDown(tree.nodes, m.id).slice(1)] } };
    })
    .filter(({ line }) => {
      const key = line.nodes.map((n) => n.id).join(',');
      return !seen.has(key) && seen.add(key);
    })
    .sort((a, b) => b.line.nodes.length - a.line.nodes.length);

  // Photo moments: acts that grew from my act in the featured line's tree, newest first.
  const featured = lines[0];
  const mineIds = new Set(mine.map((n) => n.id));
  const after = featured
    ? descendants(treeOf(featured.line.chainId).nodes, featured.mineId).filter((n) => !mineIds.has(n.id)).reverse()
    : [];
  const details = await Promise.all(after.slice(0, MAX_MOMENT_LOOKUPS).map((n) => getNode(n.id)));

  return {
    week: isoWeek(start),
    longestChains: lines.slice(0, 3).map(({ line }) => line),
    largestNets: [...trees].sort((a, b) => b.nodes.length - a.nodes.length).slice(0, 3),
    totalTrees: trees.length,
    totalActs: trees.reduce((sum, t) => sum + t.nodes.length, 0),
    moments: details
      .filter((d) => d.photoUrl)
      .map((d) => ({ id: d.id, chainId: d.chainId, description: d.description, photoUrl: d.photoUrl, createdAt: d.createdAt })),
  };
}

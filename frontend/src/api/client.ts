import { API_URL, RECAP_ENDPOINT_READY, USE_MOCKS } from './config';
import { getDeviceId } from './deviceId';
import { mockBusinesses, mockChain, mockNode, mockPins, mockRecap, mockStats } from './mocks';
import type {
  ApiProblem,
  BusinessHub,
  ChainStats,
  ChainTree,
  CheckinRequest,
  CheckinResult,
  ClaimRequest,
  ClaimResponse,
  CreateNodeRequest,
  NodeDetail,
  NodePin,
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

export function checkin(businessId: number, body: CheckinRequest): Promise<CheckinResult> {
  if (USE_MOCKS) return Promise.resolve({ checkinId: 1, business: mockBusinesses[0] });
  return request(`/api/businesses/${businessId}/checkin`, post(body));
}

/** Weekly recap. Mock data until the backend adds GET /api/me/recap. */
export function getRecap(week?: string): Promise<Recap> {
  if (USE_MOCKS || !RECAP_ENDPOINT_READY) return Promise.resolve(mockRecap);
  return request(`/api/me/recap${week ? `?week=${week}` : ''}`);
}

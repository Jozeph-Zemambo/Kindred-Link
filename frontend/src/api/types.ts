// Mirrors the backend DTOs in backend/src/main/java/ca/kindredlink/*/…Dtos.java.
// Change both sides together. Timestamps arrive as ISO-8601 strings.
// Coordinates from the API are always the privacy-blurred ones.

// --- /api/nodes (NodeDtos.java) ---

export type CreateNodeRequest = {
  description: string;
  /** Id returned by POST /api/photos; photos are uploaded separately for moderation. */
  photoId?: number | null;
  /** The device's real GPS fix; the server blurs it before anyone else sees it. */
  lat: number;
  lng: number;
};

export type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PhotoUploadResponse = { id: number; status: PhotoStatus };

export type NodePin = {
  id: number;
  chainId: number;
  parentId: number | null;
  lat: number;
  lng: number;
  openSlots: number;
  createdAt: string;
  closesAt: string;
  hasPhoto: boolean;
  mine: boolean;
  /**
   * Children who actually posted (max 2). A claim that isn't finished doesn't count; openSlots
   * counts claims instead. Lets the join map hide nodes that already have a child.
   */
  childCount?: number;
  /** Requested from backend (not sent yet): acts before this one. Drives "10+ acts" and the popular ripple. */
  depth?: number;
};

/** Body for POST /api/nodes/{id}/claim: coordinates associated with the claim. */
export type ClaimRequest = { lat: number; lng: number };

/** After a claim: when it started and the deadline to post your act (NodeDtos.ClaimResponse). */
export type ClaimResponse = { claimedAt: string; finishBy: string };

export type NodeDetail = {
  id: number;
  chainId: number;
  parentId: number | null;
  depth: number;
  description: string;
  photoUrl: string | null;
  lat: number;
  lng: number;
  openSlots: number;
  createdAt: string;
  closesAt: string;
  childIds: number[];
  mine: boolean;
};

// --- /api/chains (ChainDtos.java) ---

export type ChainStatus = 'ACTIVE' | 'QUIET' | 'ENDED';

export type ChainNode = {
  id: number;
  parentId: number | null;
  depth: number;
  lat: number;
  lng: number;
  createdAt: string;
  openSlots: number;
  hasPhoto: boolean;
  mine: boolean;
  /** Requested from backend (not sent yet): saves a GET /api/nodes/{id} per popup. */
  description?: string;
};

/** Whole tree as a flat list ordered by createdAt. Draw a line from each node to its parentId. */
export type ChainTree = {
  chainId: number;
  status: ChainStatus;
  nodes: ChainNode[];
};

export type ChainStats = {
  chainId: number;
  status: ChainStatus;
  links: number;
  totalDistanceMeters: number;
  /** ~1 km grid squares on the backend, not real Calgary communities. */
  neighbourhoodsReached: number;
  maxDepth: number;
  openSlots: number;
  startedAt: string;
  lastLinkAt: string;
};

// --- /api/businesses (BusinessDtos.java) ---

export type BusinessHub = {
  id: number;
  name: string;
  logoUrl: string | null;
  lat: number;
  lng: number;
  visitors: number;
  kindnessActs: number;
  /** Logical bubble diameter (BusinessBubbleSize.java). The map turns units into pixels. */
  diameterUnits: number;
  /** Requested from backend (not sent yet): total paid forward here, in cents. */
  paidForwardCents?: number;
};

export type CheckinRequest = {
  token: string;
  lat: number;
  lng: number;
  nodeId?: number | null;
};

export type CheckinResult = {
  checkinId: number;
  business: BusinessHub;
};

// --- Proposed, not on the backend yet: GET /api/me/recap?week=YYYY-Www ---

export type RecapMoment = {
  id: number;
  chainId: number;
  description: string;
  photoUrl: string | null;
  createdAt: string;
};

export type Recap = {
  week: string;
  /** Up to 3 straight lines (root → leaf paths) through my nodes, longest first. */
  longestChains: ChainTree[];
  /** Up to 3 whole trees containing my nodes, biggest node count first. */
  largestNets: ChainTree[];
  /** A small, curated set of moments downstream from the user's contribution in the featured ripple. */
  moments?: RecapMoment[];
  /** Counts across the whole period, not just the featured trees returned above. */
  totalTrees?: number;
  totalActs?: number;
};

/** Error body from the backend (Spring problem details), e.g. title "slot_closed" or "claim_expired". */
export type ApiProblem = {
  status: number;
  title: string;
  detail?: string;
};

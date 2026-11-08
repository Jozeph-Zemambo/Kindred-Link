// Pure tree helpers over the flat node lists the API returns. No React, no map library.

export type GraphNode = {
  id: number;
  parentId: number | null;
  lat: number;
  lng: number;
  mine?: boolean;
  openSlots?: number;
  description?: string;
  /** ISO time the act was logged. */
  createdAt?: string;
  /** Acts before this one in its chain (0 = started it). */
  depth?: number;
};

export type Edge<T extends GraphNode> = { from: T; to: T };

/** The node and everything below it (its children, their children, ...). */
export function descendants<T extends GraphNode>(nodes: T[], rootId: number): T[] {
  const children = new Map<number, T[]>();
  for (const n of nodes) {
    if (n.parentId !== null) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  }
  const start = nodes.find((n) => n.id === rootId);
  if (!start) return [];
  const out: T[] = [];
  const queue = [start];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    queue.push(...(children.get(n.id) ?? []));
  }
  return out;
}

/** The node and every parent above it, up to the start of the chain. */
export function ancestors<T extends GraphNode>(nodes: T[], id: number): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: T[] = [];
  let current = byId.get(id);
  while (current) {
    out.push(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return out;
}

/** Everything above the node plus everything below it: "my whole chain". */
export function lineage<T extends GraphNode>(nodes: T[], id: number): T[] {
  const seen = new Set<number>();
  return [...ancestors(nodes, id), ...descendants(nodes, id)].filter((n) => !seen.has(n.id) && seen.add(n.id));
}

/** One line per node whose parent is also in the list. */
export function edges<T extends GraphNode>(nodes: T[]): Edge<T>[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.flatMap((n) => {
    const parent = n.parentId === null ? undefined : byId.get(n.parentId);
    return parent ? [{ from: parent, to: n }] : [];
  });
}

/**
 * Steps from startId to every other node, walking links both ways (up to parents and down to
 * children). Used to draw a tree outward from one node.
 */
export function hopsFrom<T extends GraphNode>(nodes: T[], startId: number): Map<number, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const neighbours = new Map<number, number[]>();
  const link = (a: number, b: number) => neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  for (const n of nodes) {
    if (n.parentId !== null && ids.has(n.parentId)) {
      link(n.id, n.parentId);
      link(n.parentId, n.id);
    }
  }
  const hops = new Map<number, number>([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of neighbours.get(id) ?? []) {
      if (!hops.has(next)) {
        hops.set(next, hops.get(id)! + 1);
        queue.push(next);
      }
    }
  }
  return hops;
}

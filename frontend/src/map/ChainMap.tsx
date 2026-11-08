import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { BusinessBubble } from './BusinessBubble';
import { BusinessSheet } from './BusinessSheet';
import { edges, hopsFrom, type GraphNode } from './graph';
import { NodeDetailModal } from './NodeDetailModal';
import { NodeDot } from './NodeDot';
import { BASE_MAP, NODE_FILLS, palette } from './theme';
import { useBusinessBubbleScale } from './useBusinessBubbleScale';

// The only files that import react-native-maps are this one and JoinMap. Screens pass data in.

export type BusinessPin = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  logoUrl?: string | null;
  /** From the backend's bubble growth (BusinessBubbleSize.java); 1 = smallest. */
  diameterUnits?: number;
  /** Shown in the business panel when present. */
  visitors?: number;
  kindnessActs?: number;
  paidForwardCents?: number;
  /** Backend recency: ISO time of the last kindness act here, or null when never. */
  lastKindnessAt?: string | null;
  /** Backend recency fade, 0..1. Absent = fully visible. */
  opacity?: number;
  /** Display-only demo totals applied client-side; not server data. */
  demoTotals?: boolean;
};

export type ChainMapProps = {
  nodes: GraphNode[];
  /**
   * No longer drawn: the only marked node is your latest act in the chain (see youMarker).
   * Kept so existing screens that pass it still compile.
   */
  focusId?: number;
  businesses?: BusinessPin[];
  /** Screen handles taps itself (e.g. navigates). If omitted, the map opens the act's card. */
  onNodePress?: (id: number) => void;
  /** Screen handles business taps itself. If omitted, the map opens the business panel. */
  onBusinessPress?: (id: number) => void;
  /** Force the act card on or off; by default it shows only when onNodePress isn't given. */
  showDetails?: boolean;
  /** Disable the map camera animation when it is already inside another transition. */
  animateMap?: boolean;
  /**
   * Draw the tree in when the map opens: start close on your latest act, then the links grow
   * outward from it through the whole tree, slow at first and speeding up, while the camera
   * pulls back to show everything.
   */
  drawIn?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * How long the draw-in takes: about this long per step out from your node, so a small tree is
 * quick and a big one takes longer, but never more than DRAW_MAX_MS.
 */
const DRAW_MS_PER_STEP = 300;
const DRAW_MIN_MS = 600;
const DRAW_MAX_MS = 2000;
const drawMs = (steps: number) => Math.min(DRAW_MAX_MS, Math.max(DRAW_MIN_MS, steps * DRAW_MS_PER_STEP));
/** >1 = starts slow and speeds up. Higher = slower start, harder ramp at the end. */
const DRAW_RAMP = 2;
/** Wait for the screen's slide-in to finish before drawing. */
const DRAW_DELAY_MS = 350;
/** Each link is drawn as this many short pieces. */
const DRAW_PIECES = 10;

/** Close view of one node, where the draw-in starts. */
function closeRegion(p: { lat: number; lng: number }): Region {
  return { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.0012, longitudeDelta: 0.0012 };
}

/** The region that frames every point with some room around it. */
function fitRegion(points: { lat: number; lng: number }[]): Region {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 0.003) * 1.6,
    longitudeDelta: Math.max(maxLng - minLng, 0.003) * 1.6,
  };
}

const UCALGARY: Region = { latitude: 51.0784, longitude: -114.1305, latitudeDelta: 0.03, longitudeDelta: 0.03 };

/** Fill for a node: the palette cycled along the line, yours included. */
function fillFor(n: GraphNode): string {
  return NODE_FILLS[(n.depth ?? n.id) % NODE_FILLS.length];
}

/**
 * "You are here": your most recent act in this chain gets the ring. Earlier acts of yours in
 * the same chain look like everyone else's.
 */
function youMarker(nodes: GraphNode[]): number | undefined {
  const mine = nodes.filter((n) => n.mine);
  if (mine.length === 0) return undefined;
  return mine.reduce((best, n) => {
    const [a, b] = [n.createdAt ?? '', best.createdAt ?? ''];
    return a > b || (a === b && (n.depth ?? 0) > (best.depth ?? 0)) ? n : best;
  }).id;
}

/** A view a bit wider than the chain, so opening the map plays a short zoom-in onto it. */
function startRegion(points: { lat: number; lng: number }[]): Region {
  if (points.length === 0) return UCALGARY;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 0.004) * 2.6,
    longitudeDelta: Math.max(maxLng - minLng, 0.004) * 2.6,
  };
}

export function ChainMap({ nodes, businesses = [], onNodePress, onBusinessPress, showDetails, animateMap = true, drawIn = false, style }: ChainMapProps) {
  const map = useRef<MapView>(null);
  const youId = useMemo(() => youMarker(nodes), [nodes]);
  const ready = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [open, setOpen] = useState<{ id: number; accent: string } | null>(null);
  const [openBusiness, setOpenBusiness] = useState<BusinessPin | null>(null);
  const detailsOn = showDetails ?? !onNodePress;

  // Draw-in plan: where it starts (your latest act, else the tree's first act) and how many
  // steps each node is from there. The "frontier" sweeps from 0 to the farthest step.
  const plan = useMemo(() => {
    if (!drawIn || nodes.length === 0) return null;
    const start = nodes.find((n) => n.id === youId) ?? nodes.find((n) => n.parentId === null) ?? nodes[0];
    const hops = hopsFrom(nodes, start.id);
    const maxHop = Math.max(0, ...hops.values());
    for (const n of nodes) if (!hops.has(n.id)) hops.set(n.id, maxHop);
    return { start, hops, maxHop };
  }, [drawIn, nodes, youId]);
  const [frontier, setFrontier] = useState(plan ? 0 : Infinity);

  // Frame the chain, not the catalog: businesses only drive the camera when there are no
  // nodes at all, so a far-away business can't zoom the user's chain off screen.
  const cameraPoints = useMemo(() => (nodes.length ? nodes : businesses), [nodes, businesses]);
  const initialRegion = useMemo(() => (plan ? closeRegion(plan.start) : startRegion(cameraPoints)), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Zoom-responsive bubble scale via native projection (rotation-safe); states above stay put.
  const bubbleScale = useBusinessBubbleScale(map);

  useEffect(() => {
    if (!plan) {
      setFrontier(Infinity);
      return;
    }
    setFrontier(0);
    if (!mapReady) return;
    let frame = 0;
    let began = 0;
    const duration = drawMs(plan.maxHop);
    // Hold close on the start node while the screen slides in, then pull back to the whole tree
    // over the same time the links take to draw.
    map.current?.animateToRegion(closeRegion(plan.start), 0);
    const tick = (now: number) => {
      if (!began) began = now;
      const t = Math.min(1, (now - began) / duration);
      setFrontier(plan.maxHop * t ** DRAW_RAMP);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setFrontier(Infinity);
    };
    const begin = setTimeout(() => {
      map.current?.animateToRegion(fitRegion(cameraPoints), duration);
      frame = requestAnimationFrame(tick);
    }, DRAW_DELAY_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(begin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, mapReady]);

  /**
   * The part of each link drawn so far, from the end nearer the start node outward. During the
   * draw-in a link is DRAW_PIECES short fixed pieces that appear one by one: the iOS map doesn't
   * reliably redraw a line whose end point changes every frame, but it does draw new lines.
   */
  const drawnEdges = useMemo(() => {
    return edges(nodes).flatMap(({ from, to }) => {
      const key = `${from.id}-${to.id}`;
      if (!plan) return [{ key, a: from, b: to }];
      const [near, far] = (plan.hops.get(from.id) ?? 0) <= (plan.hops.get(to.id) ?? 0) ? [from, to] : [to, from];
      const f = Math.min(1, Math.max(0, frontier - (plan.hops.get(near.id) ?? 0)));
      const shown = Math.ceil(f * DRAW_PIECES);
      const at = (k: number) => ({ lat: near.lat + ((far.lat - near.lat) * k) / DRAW_PIECES, lng: near.lng + ((far.lng - near.lng) * k) / DRAW_PIECES });
      return Array.from({ length: shown }, (_, k) => ({ key: `${key}-${k}`, a: at(k), b: at(k + 1) }));
    });
  }, [nodes, plan, frontier]);

  /** Frame every camera point (nodes, or businesses when the chain is empty), animated. */
  const fit = () => {
    const coords = cameraPoints.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    if (coords.length === 1) {
      map.current?.animateToRegion({ ...coords[0], latitudeDelta: 0.006, longitudeDelta: 0.006 }, animateMap ? 700 : 0);
    } else if (coords.length > 1) {
      map.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: animateMap,
      });
    }
  };

  // Re-frame when the screen swaps in a different set of nodes (e.g. recap 1st → 2nd).
  // (The draw-in moves the camera itself.)
  useEffect(() => {
    if (ready.current && !plan) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPoints]);

  const onMapReady = () => {
    ready.current = true;
    setMapReady(true);
    if (!plan) fit();
    bubbleScale.onMapReady();
  };

  return (
    <View style={[styles.map, style]} onLayout={bubbleScale.onLayout}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={onMapReady}
        onRegionChangeComplete={bubbleScale.onRegionChangeComplete}
        showsUserLocation
        {...BASE_MAP}
      >
        {drawnEdges.map(({ key, a, b }) => (
          <Polyline
            key={key}
            coordinates={[
              { latitude: a.lat, longitude: a.lng },
              { latitude: b.lat, longitude: b.lng },
            ]}
            strokeColor={palette.blue}
            strokeWidth={4}
            lineCap="round"
          />
        ))}
        {/* Businesses join once the tree has drawn itself in, so the draw-in is just the tree. */}
        {(!plan || frontier === Infinity) && businesses.map((b) => (
          <Marker
            // Re-mount when the size changes so the native marker re-centres on its spot.
            key={`biz-${b.id}-${Math.round(bubbleScale.mapScale * 100)}`}
            coordinate={{ latitude: b.lat, longitude: b.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={b.name}
            tracksViewChanges
            onPress={() => (onBusinessPress ? onBusinessPress(b.id) : setOpenBusiness(b))}
          >
            <BusinessBubble name={b.name} logoUrl={b.logoUrl} diameterUnits={b.diameterUnits ?? 1} mapScale={bubbleScale.mapScale} />
          </Marker>
        ))}
        {nodes.map((n) => {
          // During the draw-in, a node appears once its link has reached it.
          if (plan && frontier < (plan.hops.get(n.id) ?? 0)) return null;
          const highlighted = n.id === youId;
          const fill = fillFor(n);
          return (
            <Marker
              key={n.id}
              coordinate={{ latitude: n.lat, longitude: n.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => {
                onNodePress?.(n.id);
                if (detailsOn) setOpen({ id: n.id, accent: fill });
              }}
            >
              <NodeDot fill={fill} size={highlighted ? 20 : 18} ring={highlighted} />
            </Marker>
          );
        })}
      </MapView>
      {detailsOn && <NodeDetailModal nodeId={open?.id ?? null} accent={open?.accent} onClose={() => setOpen(null)} />}
      <BusinessSheet business={openBusiness} onClose={() => setOpenBusiness(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

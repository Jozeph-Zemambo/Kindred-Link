import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { BusinessBubble } from './BusinessBubble';
import { edges, type GraphNode } from './graph';
import { NodeDetailModal } from './NodeDetailModal';
import { NodeDot } from './NodeDot';
import { BASE_MAP, NODE_FILLS, palette } from './theme';

// The only files that import react-native-maps are this one and JoinMap. Screens pass data in.

export type BusinessPin = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  logoUrl?: string | null;
  /** From the backend's bubble growth (BusinessBubbleSize.java); 1 = smallest. */
  diameterUnits?: number;
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
  onBusinessPress?: (id: number) => void;
  /** Force the act card on or off; by default it shows only when onNodePress isn't given. */
  showDetails?: boolean;
  style?: StyleProp<ViewStyle>;
};

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

export function ChainMap({ nodes, businesses = [], onNodePress, onBusinessPress, showDetails, style }: ChainMapProps) {
  const map = useRef<MapView>(null);
  const youId = useMemo(() => youMarker(nodes), [nodes]);
  const ready = useRef(false);
  const [open, setOpen] = useState<{ id: number; accent: string } | null>(null);
  const detailsOn = showDetails ?? !onNodePress;
  const initialRegion = useMemo(() => startRegion([...nodes, ...businesses]), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Frame every node (and business, if any) on screen, animated. */
  const fit = () => {
    const coords = [...nodes, ...businesses].map((p) => ({ latitude: p.lat, longitude: p.lng }));
    if (coords.length === 1) {
      map.current?.animateToRegion({ ...coords[0], latitudeDelta: 0.006, longitudeDelta: 0.006 }, 700);
    } else if (coords.length > 1) {
      map.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
  };

  // Re-frame when the screen swaps in a different set of nodes (e.g. recap 1st → 2nd).
  useEffect(() => {
    if (ready.current) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, businesses]);

  const onMapReady = () => {
    ready.current = true;
    fit();
  };

  return (
    <View style={[styles.map, style]}>
      <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={initialRegion} onMapReady={onMapReady} showsUserLocation {...BASE_MAP}>
        {edges(nodes).map(({ from, to }) => (
          <Polyline
            key={`${from.id}-${to.id}`}
            coordinates={[
              { latitude: from.lat, longitude: from.lng },
              { latitude: to.lat, longitude: to.lng },
            ]}
            strokeColor={palette.blue}
            strokeWidth={4}
          />
        ))}
        {businesses.map((b) => (
          <Marker
            key={`biz-${b.id}`}
            coordinate={{ latitude: b.lat, longitude: b.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={b.name}
            onPress={() => onBusinessPress?.(b.id)}
          >
            <BusinessBubble name={b.name} logoUrl={b.logoUrl} diameterUnits={b.diameterUnits ?? 1} />
          </Marker>
        ))}
        {nodes.map((n) => {
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
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

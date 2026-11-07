import { useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { edges, type GraphNode } from './graph';

// The only file that imports react-native-maps. Screens pass data in; this just draws it.

export type BusinessPin = { id: number; name: string; lat: number; lng: number };

export type ChainMapProps = {
  nodes: GraphNode[];
  /** The node to highlight (usually "you"). */
  focusId?: number;
  businesses?: BusinessPin[];
  onNodePress?: (id: number) => void;
  onBusinessPress?: (id: number) => void;
  style?: StyleProp<ViewStyle>;
};

const COLORS = {
  focus: '#7c3aed',
  mine: '#f59e0b',
  open: '#10b981',
  closed: '#9ca3af',
  line: '#6366f1',
  business: '#ef4444',
};

const UCALGARY = { latitude: 51.0784, longitude: -114.1305, latitudeDelta: 0.03, longitudeDelta: 0.03 };

function pinColor(n: GraphNode, focusId?: number) {
  if (n.id === focusId) return COLORS.focus;
  if (n.mine) return COLORS.mine;
  return (n.openSlots ?? 0) > 0 ? COLORS.open : COLORS.closed;
}

export function ChainMap({ nodes, focusId, businesses = [], onNodePress, onBusinessPress, style }: ChainMapProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);

  const fit = () => {
    const coords = [...nodes, ...businesses].map((p) => ({ latitude: p.lat, longitude: p.lng }));
    if (coords.length > 1) {
      map.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
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
    <MapView ref={map} style={[styles.map, style]} initialRegion={UCALGARY} onMapReady={onMapReady} showsUserLocation>
      {edges(nodes).map(({ from, to }) => (
        <Polyline
          key={`${from.id}-${to.id}`}
          coordinates={[
            { latitude: from.lat, longitude: from.lng },
            { latitude: to.lat, longitude: to.lng },
          ]}
          strokeColor={COLORS.line}
          strokeWidth={3}
        />
      ))}
      {nodes.map((n) => (
        <Marker
          key={n.id}
          coordinate={{ latitude: n.lat, longitude: n.lng }}
          pinColor={pinColor(n, focusId)}
          title={n.mine ? 'Your act' : 'Act of kindness'}
          description={n.description}
          onPress={() => onNodePress?.(n.id)}
        />
      ))}
      {businesses.map((b) => (
        <Marker
          key={`biz-${b.id}`}
          coordinate={{ latitude: b.lat, longitude: b.lng }}
          pinColor={COLORS.business}
          title={b.name}
          onPress={() => onBusinessPress?.(b.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

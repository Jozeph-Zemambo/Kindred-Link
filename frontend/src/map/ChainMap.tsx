import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

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
  /** The node to highlight (usually "you"). */
  focusId?: number;
  businesses?: BusinessPin[];
  /** Also called on tap; the act's detail card opens either way unless showDetails is false. */
  onNodePress?: (id: number) => void;
  onBusinessPress?: (id: number) => void;
  showDetails?: boolean;
  style?: StyleProp<ViewStyle>;
};

const UCALGARY = { latitude: 51.0784, longitude: -114.1305, latitudeDelta: 0.03, longitudeDelta: 0.03 };

export function ChainMap({ nodes, focusId, businesses = [], onNodePress, onBusinessPress, showDetails = true, style }: ChainMapProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  const [openId, setOpenId] = useState<number | null>(null);

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
    <View style={[styles.map, style]}>
      <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={UCALGARY} onMapReady={onMapReady} showsUserLocation {...BASE_MAP}>
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
          const highlighted = n.mine || n.id === focusId;
          return (
            <Marker
              key={n.id}
              coordinate={{ latitude: n.lat, longitude: n.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => {
                onNodePress?.(n.id);
                if (showDetails) setOpenId(n.id);
              }}
            >
              <NodeDot
                fill={n.mine ? palette.navy : NODE_FILLS[(n.depth ?? n.id) % NODE_FILLS.length]}
                size={highlighted ? 20 : 18}
                ring={highlighted}
              />
            </Marker>
          );
        })}
      </MapView>
      {showDetails && <NodeDetailModal nodeId={openId} onClose={() => setOpenId(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

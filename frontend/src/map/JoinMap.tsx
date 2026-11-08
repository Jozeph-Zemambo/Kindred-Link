import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import type { NodePin } from '@/api/types';

import { isFindable, timeLeft } from './findable';
import { JOIN_RADIUS_M } from './rules';

// The "find a node to join" map: only findable nodes, no lines, no children, no history.

export type LatLngPoint = { lat: number; lng: number };

export type JoinMapProps = {
  /** Raw pins from listNearby; this component applies the findable rule itself. */
  pins: NodePin[];
  /** Where the user is. The join radius is drawn around this point. */
  me: LatLngPoint;
  radiusMeters?: number;
  selectedId?: number | null;
  onPinPress?: (pin: NodePin) => void;
  style?: StyleProp<ViewStyle>;
};

const COLORS = {
  open: '#10b981',
  selected: '#7c3aed',
  radiusStroke: 'rgba(99, 102, 241, 0.6)',
  radiusFill: 'rgba(99, 102, 241, 0.08)',
};

export function JoinMap({ pins, me, radiusMeters = JOIN_RADIUS_M, selectedId, onPinPress, style }: JoinMapProps) {
  const span = (radiusMeters * 2.4) / 111_320;
  const region = { latitude: me.lat, longitude: me.lng, latitudeDelta: span, longitudeDelta: span };

  return (
    <MapView style={[styles.map, style]} initialRegion={region} showsUserLocation>
      <Circle
        center={{ latitude: me.lat, longitude: me.lng }}
        radius={radiusMeters}
        strokeColor={COLORS.radiusStroke}
        fillColor={COLORS.radiusFill}
      />
      {pins.filter((p) => isFindable(p)).map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.lat, longitude: p.lng }}
          pinColor={p.id === selectedId ? COLORS.selected : COLORS.open}
          title="Open act of kindness"
          description={timeLeft(p.closesAt)}
          onPress={() => onPinPress?.(p)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

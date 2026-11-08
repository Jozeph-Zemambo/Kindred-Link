import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import type { NodePin } from '@/api/types';

import { BusinessBubble } from './BusinessBubble';
import type { BusinessPin } from './ChainMap';
import { isFindable } from './findable';
import { JoinSheet } from './JoinSheet';
import { NodeDot } from './NodeDot';
import { mostPopular } from './popularity';
import { JOIN_RADIUS_M } from './rules';
import { BASE_MAP, palette, RADIUS_FILL, RADIUS_STROKE } from './theme';

// The "find a node to join" map: only findable nodes, all the same colour, the 3 most popular
// pulsing. Tapping one slides in the join panel. Businesses stay on the map as bubbles.

export type LatLngPoint = { lat: number; lng: number };

export type JoinMapProps = {
  /** Raw pins from listNearby; this component applies the findable rule itself. */
  pins: NodePin[];
  /** Where the user is. The join radius is drawn around this point. */
  me: LatLngPoint;
  radiusMeters?: number;
  businesses?: BusinessPin[];
  /** "Join this chain" in the panel. What happens next (timer, home status) is the screen's call. */
  onJoin?: (pin: NodePin) => void;
  /** Also called on tap, alongside the panel opening. */
  onPinPress?: (pin: NodePin) => void;
  onBusinessPress?: (id: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function JoinMap({ pins, me, radiusMeters = JOIN_RADIUS_M, businesses = [], onJoin, onPinPress, onBusinessPress, style }: JoinMapProps) {
  const [selected, setSelected] = useState<NodePin | null>(null);
  const findable = useMemo(() => pins.filter((p) => isFindable(p)), [pins]);
  const popular = useMemo(() => mostPopular(findable), [findable]);

  const span = (radiusMeters * 2.4) / 111_320;
  const region = { latitude: me.lat, longitude: me.lng, latitudeDelta: span, longitudeDelta: span };

  return (
    <View style={[styles.map, style]}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region} showsUserLocation {...BASE_MAP}>
        <Circle
          center={{ latitude: me.lat, longitude: me.lng }}
          radius={radiusMeters}
          strokeColor={RADIUS_STROKE}
          strokeWidth={2}
          fillColor={RADIUS_FILL}
        />
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
        {findable.map((p) => {
          const pulse = popular.has(p.id);
          const isSelected = p.id === selected?.id;
          return (
            <Marker
              key={`${p.id}-${isSelected ? 'sel' : 'n'}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              // Android renders marker views as snapshots; keep tracking only where the ripple animates.
              tracksViewChanges={pulse}
              onPress={() => {
                onPinPress?.(p);
                setSelected(p);
              }}
            >
              <NodeDot fill={isSelected ? palette.tangerine : palette.yellow} size={18} pulse={pulse} />
            </Marker>
          );
        })}
      </MapView>
      <JoinSheet pin={selected} onClose={() => setSelected(null)} onJoin={onJoin} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

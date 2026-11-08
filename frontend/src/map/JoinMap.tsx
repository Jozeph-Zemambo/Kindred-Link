import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { USE_MOCKS } from '@/api/config';
import type { NodePin } from '@/api/types';

import { BusinessBubble } from './BusinessBubble';
import { BusinessSheet } from './BusinessSheet';
import type { BusinessPin } from './ChainMap';
import { isFindable } from './findable';
import { JoinSheet } from './JoinSheet';
import { NodeDot } from './NodeDot';
import { mostPopular } from './popularity';
import { JOIN_RADIUS_M } from './rules';
import { BASE_MAP, palette, RADIUS_FILL, RADIUS_STROKE } from './theme';
import { useBusinessBubbleScale } from './useBusinessBubbleScale';

// The "find a node to join" map: only findable nodes, all the same colour, the 3 most popular
// pulsing. Tapping one slides in the join panel. Businesses stay on the map as bubbles.
// Nodes outside the radius still show: walk toward one and the radius (it follows you) reaches it.

export type LatLngPoint = { lat: number; lng: number };

export type JoinMapProps = {
  /** Raw pins from listNearby; this component applies the findable rule itself. */
  pins: NodePin[];
  /** Where the user is when the screen loads. The claim radius follows live GPS on native. */
  me: LatLngPoint;
  radiusMeters?: number;
  businesses?: BusinessPin[];
  /** "Join this chain" in the panel. What happens next (timer, home status) is the screen's call. */
  onJoin?: (pin: NodePin) => void;
  /** Screen handles pin taps itself (e.g. navigates). If omitted, the map opens the join panel. */
  onPinPress?: (pin: NodePin) => void;
  /** Screen handles taps on the map surface itself (e.g. navigates). */
  onMapPress?: () => void;
  /** Screen handles business taps itself. If omitted, the map opens the business panel. */
  onBusinessPress?: (id: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function JoinMap({ pins, me, radiusMeters = JOIN_RADIUS_M, businesses = [], onJoin, onPinPress, onMapPress, onBusinessPress, style }: JoinMapProps) {
  const [selected, setSelected] = useState<NodePin | null>(null);
  const [openBusiness, setOpenBusiness] = useState<BusinessPin | null>(null);
  // Mock data lives at UCalgary, so in mock mode keep the radius there instead of the simulator's GPS.
  const [live, setLive] = useState<LatLngPoint | null>(null);
  const centre = USE_MOCKS ? me : live ?? me;
  const findable = useMemo(() => pins.filter((p) => isFindable(p)), [pins]);
  const popular = useMemo(() => mostPopular(findable), [findable]);

  const span = (radiusMeters * 2.4) / 111_320;
  const region = { latitude: me.lat, longitude: me.lng, latitudeDelta: span, longitudeDelta: span };
  const mapRef = useRef<MapView>(null);
  const bubbleScale = useBusinessBubbleScale(mapRef);

  return (
    <View style={[styles.map, style]} onLayout={bubbleScale.onLayout}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onMapReady={bubbleScale.onMapReady}
        showsUserLocation
        onRegionChange={bubbleScale.onRegionChange}
        onRegionChangeComplete={bubbleScale.onRegionChangeComplete}
        onPress={() => onMapPress?.()}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) setLive({ lat: c.latitude, lng: c.longitude });
        }}
        {...BASE_MAP}
      >
        <Circle
          center={{ latitude: centre.lat, longitude: centre.lng }}
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
            tracksViewChanges
            onPress={() => (onBusinessPress ? onBusinessPress(b.id) : setOpenBusiness(b))}
          >
            <BusinessBubble name={b.name} logoUrl={b.logoUrl} diameterUnits={b.diameterUnits ?? 1} mapScale={bubbleScale.mapScale} />
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
              onPress={() => (onPinPress ? onPinPress(p) : setSelected(p))}
            >
              <NodeDot fill={isSelected ? palette.tangerine : palette.yellow} size={18} pulse={pulse} />
            </Marker>
          );
        })}
      </MapView>
      <JoinSheet pin={selected} onClose={() => setSelected(null)} onJoin={onJoin} />
      <BusinessSheet business={openBusiness} onClose={() => setOpenBusiness(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});

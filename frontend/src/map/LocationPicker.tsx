import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

import type { LatLngPoint } from './JoinMap';
import { NodeDot } from './NodeDot';
import { BASE_MAP, palette } from './theme';

// "Choose on map" for a new tree, on the same base map as every other view (muted Apple map on
// iOS, cream/navy Google style on Android). The node stays in the centre and the map moves under
// it: easier than long-press-dragging a small pin, and it behaves the same on both platforms.

type LocationPickerProps = {
  /** Where the map starts centred. */
  value: LatLngPoint;
  /** The point under the node, each time the map stops moving. */
  onChange: (point: LatLngPoint) => void;
};

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: value.lat, longitude: value.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        showsUserLocation
        onRegionChangeComplete={(r) => onChange({ lat: r.latitude, lng: r.longitude })}
        {...BASE_MAP}
      />
      {/* Your new act, drawn like the "you" node on the other maps. Touches pass through to the map. */}
      <View style={styles.centre} pointerEvents="none">
        <NodeDot fill={palette.tangerine} size={24} ring />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});

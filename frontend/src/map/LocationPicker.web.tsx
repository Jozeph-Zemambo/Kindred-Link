import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

type LatLngPoint = { lat: number; lng: number };

type LocationPickerProps = {
  value: LatLngPoint;
  onChange: (point: LatLngPoint) => void;
};

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [latitude, setLatitude] = useState(String(value.lat));
  const [longitude, setLongitude] = useState(String(value.lng));

  useEffect(() => {
    setLatitude(String(value.lat));
    setLongitude(String(value.lng));
  }, [value.lat, value.lng]);

  function updateLatitude(text: string) {
    setLatitude(text);
    const lat = Number(text);
    if (text.trim() && Number.isFinite(lat) && lat >= -90 && lat <= 90) {
      onChange({ lat, lng: value.lng });
    }
  }

  function updateLongitude(text: string) {
    setLongitude(text);
    const lng = Number(text);
    if (text.trim() && Number.isFinite(lng) && lng >= -180 && lng <= 180) {
      onChange({ lat: value.lat, lng });
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a location</Text>
      <Text style={styles.hint}>Enter coordinates to place your kindness on the map.</Text>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            accessibilityLabel="Latitude"
            keyboardType="decimal-pad"
            onChangeText={updateLatitude}
            style={styles.input}
            value={latitude}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            accessibilityLabel="Longitude"
            keyboardType="decimal-pad"
            onChangeText={updateLongitude}
            style={styles.input}
            value={longitude}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#FFF9E9', justifyContent: 'center', padding: 20 },
  title: { color: '#303A59', fontSize: 16, fontWeight: '700' },
  hint: { color: '#6C748A', fontSize: 12, marginTop: 6 },
  fields: { flexDirection: 'row', gap: 12, marginTop: 16 },
  field: { flex: 1 },
  label: { color: '#303A59', fontSize: 11, fontWeight: '600', marginBottom: 5 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E9DEC4', borderRadius: 8, borderWidth: 1, color: '#303A59', padding: 10 },
});

import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mockBusinesses, mockLine, mockNet, mockPins } from '@/api/mocks';
import { ChainMap, JoinMap } from '@/map';

// Map sandbox: every map view on fake data, for map styling work. Not linked from the app.
// Open it in Expo Go with the dev URL + /--/map-lab, e.g. exp://127.0.0.1:8081/--/map-lab

const ICT = { lat: 51.0802, lng: -114.1305 };

const VIEWS = ['Join', 'Net', 'Line', 'Businesses'] as const;
type LabView = (typeof VIEWS)[number];

export default function MapLab() {
  const [view, setView] = useState<LabView>('Join');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.row}>
        {VIEWS.map((v) => (
          <Pressable key={v} onPress={() => setView(v)} style={[styles.chip, view === v && styles.active]}>
            <Text>{v}</Text>
          </Pressable>
        ))}
      </View>
      {view === 'Join' && (
        <JoinMap pins={mockPins(false)} me={ICT} selectedId={selectedId} onPinPress={(p) => setSelectedId(p.id)} />
      )}
      {view === 'Net' && <ChainMap nodes={mockNet.nodes} focusId={3} onNodePress={setSelectedId} />}
      {view === 'Line' && <ChainMap nodes={mockLine.nodes} focusId={10} onNodePress={setSelectedId} />}
      {view === 'Businesses' && (
        <ChainMap nodes={mockNet.nodes} focusId={3} businesses={mockBusinesses} onNodePress={setSelectedId} />
      )}
      <Text style={styles.status}>Tapped node: {selectedId ?? 'none'}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db' },
  active: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' },
  status: { textAlign: 'center', padding: 12, color: '#6b7280' },
});

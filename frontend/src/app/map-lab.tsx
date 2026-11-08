import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mockBusinesses, mockNet, mockPins, mockRecap } from '@/api/mocks';
import { FullChainMap, JoinMap, MyKindnessMap, RecapChainMap, RecapNetMap } from '@/map';

// Map sandbox: every map view on fake data, for map styling work. Not linked from the app.
// Open it in Expo Go with the dev URL + /--/map-lab, e.g. exp://127.0.0.1:8081/--/map-lab
// The picker below is a dev tool for this sandbox only; real screens own their own buttons.

const ICT = { lat: 51.0802, lng: -114.1305 };

const VIEWS = ['Join', 'Mine', 'Chain', 'Recap line', 'Recap net'] as const;
type LabView = (typeof VIEWS)[number];

export default function MapLab() {
  const [view, setView] = useState<LabView>('Join');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [joinedId, setJoinedId] = useState<number | null>(null);

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
        <JoinMap
          pins={mockPins(false)}
          me={ICT}
          businesses={mockBusinesses}
          onPinPress={(p) => setSelectedId(p.id)}
          onJoin={(p) => setJoinedId(p.id)}
        />
      )}
      {/* Chain views get no onNodePress here, so tapping opens the act card like it will in the app. */}
      {view === 'Mine' && <MyKindnessMap tree={mockNet} latestNodeId={3} />}
      {view === 'Chain' && <FullChainMap tree={mockNet} nodeId={5} />}
      {view === 'Recap line' && <RecapChainMap chain={mockRecap.longestChains[0]} />}
      {view === 'Recap net' && <RecapNetMap net={mockRecap.largestNets[0]} />}
      <Text style={styles.status}>
        Tapped node: {selectedId ?? 'none'} · Joined: {joinedId ?? 'none'}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db' },
  active: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' },
  status: { textAlign: 'center', padding: 12, color: '#6b7280' },
});

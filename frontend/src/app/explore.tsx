import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listNearby } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { getMyLocation, isFindable, JoinMap } from '@/map';

/**
 * Nearby-tree exploration screen.
 *
 * Backend handoff: getMyLocation() supplies the user position and
 * listNearby(lat, lng, radius) supplies the nearby end-act markers. Both have
 * development fallbacks today. JoinMap owns marker rendering/filtering; this
 * screen owns the overlay and navigation after a marker is selected.
 */
export default function ExploreScreen() {
  const { data, error, loading, reload } = useLoad(async () => {
    const me = await getMyLocation();
    const pins = await listNearby(me.lat, me.lng);
    return { me, pins };
  });
  const findablePins = data?.pins.filter((pin) => isFindable(pin)) ?? [];
  const formatImpact = (count: number) => `${Math.max(5, Math.round(count / 5) * 5)}+ acts`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EXPLORE KINDNESS</Text>
          <Text style={styles.title}>Find a tree to grow</Text>
          <Text style={styles.subtitle}>Explore nearby trees, continue an existing act, or start your own.</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      {loading || error || !data ? (
        <LoadState error={error} onRetry={reload} />
      ) : (
        <View style={styles.mapCard}>
          <JoinMap pins={data.pins} me={data.me} onPinPress={(pin) => router.push({ pathname: '/chain/[id]', params: { id: String(pin.id) } })} />
          <View style={styles.mapOverlay}><Text style={styles.mapOverlayTitle}>{findablePins.length ? formatImpact(findablePins.length) : 'No trees nearby'}</Text><Text style={styles.mapOverlayText}>Nearby kindness · tap an act to continue</Text></View>
        </View>
      )}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => router.push('/')}>
          <Text style={styles.navIcon}>⌂</Text>
          <Text style={styles.navText}>Home</Text>
        </Pressable>
        <View style={styles.navItem}>
          <Text style={styles.navIcon}>◌</Text>
          <Text style={styles.navActive}>Explore</Text>
        </View>
        <Pressable style={styles.navItem} onPress={() => router.push('/recap')}>
          <Text style={styles.navIcon}>⌁</Text>
          <Text style={styles.navText}>My trees</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/settings')}>
          <Text style={styles.navIcon}>○</Text>
          <Text style={styles.navText}>Profile</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9E9', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { color: '#F49A68', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#303A59', fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#6C748A', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 290 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#303A59', fontSize: 26, lineHeight: 28 },
  mapCard: { flex: 1, minHeight: 360, overflow: 'hidden', borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9DEC4' },
  mapOverlay: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  mapOverlayTitle: { color: '#303A59', fontSize: 13, fontWeight: '800' },
  mapOverlayText: { color: '#6C748A', fontSize: 10, marginTop: 2 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', borderRadius: 20, marginTop: 18, paddingVertical: 12, borderWidth: 1, borderColor: '#E9DEC4' },
  navItem: { alignItems: 'center', minWidth: 55 },
  navIcon: { color: '#303A59', fontSize: 19, lineHeight: 22 },
  navActive: { color: '#F49A68', fontSize: 10, fontWeight: '800', marginTop: 3 },
  navText: { color: '#6C748A', fontSize: 10, marginTop: 3 },
});

import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL, USE_MOCKS } from '@/api/config';
import { getDeviceId, resetDeviceId } from '@/api/deviceId';
import { useLoad } from '@/api/useLoad';
import { BottomNav } from '@/components/BottomNav';

// Settings + "account": there are no logins yet, just this phone's id.
export default function SettingsScreen() {
  const { data: deviceId, reload } = useLoad(getDeviceId);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text>Your id: {deviceId ?? '…'}</Text>
      <Pressable style={styles.button} onPress={() => resetDeviceId().then(reload)}>
        <Text>Reset (start as a new person)</Text>
      </Pressable>
      <Text style={styles.debug}>API: {USE_MOCKS ? 'mock data' : API_URL}</Text>
      <BottomNav active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingBottom: 96, gap: 12 },
  button: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  debug: { marginTop: 'auto', color: '#6b7280' },
});

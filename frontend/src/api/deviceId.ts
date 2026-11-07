import AsyncStorage from '@react-native-async-storage/async-storage';

// No accounts yet: each install makes a random id once and sends it as X-Device-Id.
const KEY = 'kindred.deviceId';

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await AsyncStorage.getItem(KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  const fresh = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(KEY, fresh);
  cached = fresh;
  return fresh;
}

/** For the settings screen: start over as a "new person". */
export async function resetDeviceId(): Promise<string> {
  cached = null;
  await AsyncStorage.removeItem(KEY);
  return getDeviceId();
}

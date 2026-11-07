import Constants from 'expo-constants';

// Put EXPO_PUBLIC_* values in frontend/.env.local (gitignored) and restart `npx expo start`.

/** EXPO_PUBLIC_USE_MOCKS=1 serves fake data from mocks.ts, so the UI works without the backend. */
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === '1';

/** Flip to true once the backend ships GET /api/me/recap. Until then the recap screen uses mocks. */
export const RECAP_ENDPOINT_READY = false;

/**
 * EXPO_PUBLIC_API_URL wins if set. Otherwise use the laptop that is serving the Expo bundle
 * (its LAN IP is in hostUri) on port 8080, which is where Spring Boot listens.
 */
export const API_URL: string = (() => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8080`;
})();

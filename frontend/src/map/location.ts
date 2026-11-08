import * as Location from 'expo-location';

import { USE_MOCKS } from '@/api/config';

export type MyLocation = { lat: number; lng: number; real: boolean };

// ICT building, UCalgary: where the mock data and demo seed live.
const FALLBACK: MyLocation = { lat: 51.0802, lng: -114.1305, real: false };

/** The phone's GPS fix, or the UCalgary fallback in mock mode / if permission is refused. */
export async function getMyLocation(): Promise<MyLocation> {
  if (USE_MOCKS) return FALLBACK;
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return FALLBACK;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, real: true };
}

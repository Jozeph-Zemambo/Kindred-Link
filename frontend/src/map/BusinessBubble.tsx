import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { API_URL } from '@/api/config';

import { demoLogoFor } from './demoLogos';
import { OUTLINE, palette } from './theme';

// A small business on the map: a permanent cream bubble with its logo, growing with visitors.

/**
 * Cap growth at the size BusinessBubbleSize.java gives 10,000 visitors (16.625 units), so a
 * busy hub reads as bigger without swallowing the map.
 */
export const MAX_DIAMETER_UNITS = 16.625;

/** Logical units → pixels. Marker views keep this pixel size at every zoom level. */
export function bubbleSize(diameterUnits: number): number {
  const units = Math.min(Math.max(diameterUnits, 1), MAX_DIAMETER_UNITS);
  return Math.round(30 + (units - 1) * 3.8);
}

/** Backend logo (absolute, or a path like "/logos/x.png" served by the API), else the demo logo. */
export function logoSource(name: string, logoUrl?: string | null): number | { uri: string } | undefined {
  if (logoUrl) return { uri: logoUrl.startsWith('/') ? `${API_URL}${logoUrl}` : logoUrl };
  return demoLogoFor(name);
}

export function BusinessBubble({ name, logoUrl, diameterUnits }: { name: string; logoUrl?: string | null; diameterUnits: number }) {
  const size = bubbleSize(diameterUnits);
  const source = logoSource(name, logoUrl);
  const inner = size - 8;
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
      {source ? (
        <Image source={source} style={{ width: inner, height: inner, borderRadius: inner / 2 }} contentFit="cover" />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.max(12, size * 0.38) }]}>{name.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: palette.cream,
    borderWidth: 2.5,
    borderColor: OUTLINE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  initial: { color: palette.navy, fontWeight: '800' },
});

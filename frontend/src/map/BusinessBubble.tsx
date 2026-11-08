import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { assetUrl } from './assetUrl';
import { demoLogoFor } from './demoLogos';
import { OUTLINE, palette } from './theme';

// A small business on the map: a permanent cream bubble with its logo, growing with visitors.

/**
 * Cap growth at the size BusinessBubbleSize.java gives 10,000 visitors (16.625 units), so a
 * busy hub reads as bigger without swallowing the map.
 */
export const MAX_DIAMETER_UNITS = 16.625;

/** Base size at reference zoom, before map and display scaling. */
export function bubbleSize(diameterUnits: number): number {
  const units = Math.min(Math.max(diameterUnits, 1), MAX_DIAMETER_UNITS);
  return Math.round(30 + (units - 1) * 3.8);
}

/** Backend logo (absolute, or a path like "/logos/x.png" served by the API), else the demo logo. */
export function logoSource(name: string, logoUrl?: string | null): number | { uri: string } | undefined {
  if (logoUrl) return { uri: assetUrl(logoUrl) };
  return demoLogoFor(name);
}

/** Presentation size boost on top of the map zoom scale (user-requested +10%). */
export const BUSINESS_BUBBLE_DISPLAY_SCALE = 1.1;

export function BusinessBubble({ name, logoUrl, diameterUnits, mapScale = 1 }: { name: string; logoUrl?: string | null; diameterUnits: number; mapScale?: number }) {
  const scale = (Number.isFinite(mapScale) && mapScale > 0 ? mapScale : 1) * BUSINESS_BUBBLE_DISPLAY_SCALE;
  const base = bubbleSize(diameterUnits);
  const size = base * scale;
  const source = logoSource(name, logoUrl);
  const inner = (base - 8) * scale;
  return (
    <View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5 * scale,
          shadowRadius: 4 * scale,
          shadowOffset: { width: 0, height: 2 * scale },
        },
      ]}
    >
      {source ? (
        <Image source={source} style={{ width: inner, height: inner, borderRadius: inner / 2 }} contentFit="cover" />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.max(12, base * 0.38) * scale }]}>{name.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: palette.cream,
    borderColor: OUTLINE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
  },
  initial: { color: palette.navy, fontWeight: '800' },
});

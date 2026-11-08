import { Platform } from 'react-native';
import type { MapStyleElement, MapViewProps } from 'react-native-maps';

// Team palette (same values as the homepage in app/index.tsx).
export const palette = {
  cream: '#FFF9E9',
  yellow: '#FFD36D',
  blue: '#80B9E5',
  tangerine: '#F49A68',
  navy: '#303A59',
  muted: '#6C748A',
  line: '#E9DEC4',
  white: '#FFFFFF',
};

/** Dark outline on every node so the circles read clearly on the map. */
export const OUTLINE = '#1C2030';

/** Fills cycled across nodes in the chain / tree views, just for colour. */
export const NODE_FILLS = [palette.yellow, palette.blue, palette.tangerine, palette.cream];

/** Blend colour a toward b (t = 0 → a, 1 → b). Hex in, hex out. */
export function mix(a: string, b: string, t: number): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Readable text on a palette fill: cream on navy, navy on every bright colour (design rule). */
export function textOn(fill: string): string {
  return fill === palette.navy ? palette.cream : palette.navy;
}

/** Join radius: Blue outline, faint fill. */
export const RADIUS_STROKE = palette.blue;
export const RADIUS_FILL = 'rgba(128, 185, 229, 0.12)';

/** Android draws Google's map; this recolours it to the palette (iOS ignores it). */
const androidMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: palette.cream }] },
  { elementType: 'labels.text.fill', stylers: [{ color: palette.navy }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: palette.cream }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  // Keep the base cream; hide building/land-cover/terrain surfaces that can overlay it.
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: palette.cream }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: palette.cream }] },
  { featureType: 'landscape.natural.landcover', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural.terrain', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: palette.white }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F3E6C6' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: palette.muted }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE3F3' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: palette.line }] },
];

/**
 * Base map shared by every view. iPhone: Apple's muted style, no business icons or 3D buildings,
 * always light. Android: Google's map recoloured with the palette. Nodes and bubbles draw on top
 * of either one the same way.
 */
export const BASE_MAP: Partial<MapViewProps> =
  Platform.OS === 'ios'
    ? { mapType: 'mutedStandard', showsPointsOfInterests: false, showsBuildings: false, userInterfaceStyle: 'light' }
    : { mapType: 'standard', customMapStyle: androidMapStyle, showsBuildings: false, toolbarEnabled: false };

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type MapView from 'react-native-maps';

// Zoom scale for the existing business bubbles, measured with the native map projection so it
// is rotation-independent (longitudeDelta shrinks/grows with the axis-aligned bounding box and
// made bubbles shrink on rotated maps). Anchored at web-Mercator zoom 15: scale 1 there, one
// zoom in doubles, one out halves.

const LONGITUDE_STEP = 0.001;
const STEP_PX_AT_Z15 = (256 * 2 ** 15 * LONGITUDE_STEP) / 360;

/**
 * Projects an east-west pair at the camera centre and compares its pixel length to the same
 * step at zoom 15. Rotation preserves the Euclidean length. Returns null on any failure so the
 * caller can keep the last good scale - never falls back to bounding-box deltas.
 */
export async function measureBusinessBubbleScale(map: Pick<MapView, 'getCamera' | 'pointForCoordinate'>): Promise<number | null> {
  try {
    const camera = await map.getCamera();
    const { latitude, longitude } = camera.center;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    // Clamp the pair inside the world so neither point wraps the antimeridian.
    const centerLng = Math.min(Math.max(longitude, -180 + LONGITUDE_STEP / 2), 180 - LONGITUDE_STEP / 2);
    const [w, e] = await Promise.all([
      map.pointForCoordinate({ latitude, longitude: centerLng - LONGITUDE_STEP / 2 }),
      map.pointForCoordinate({ latitude, longitude: centerLng + LONGITUDE_STEP / 2 }),
    ]);
    const dist = Math.hypot(e.x - w.x, e.y - w.y);
    if (!Number.isFinite(dist) || dist <= 0) return null;
    return dist / STEP_PX_AT_Z15;
  } catch {
    return null;
  }
}

/** Tracks the projection-based scale; serializes measurements with live results and a coalesced follow-up. */
export function useBusinessBubbleScale(mapRef: RefObject<MapView | null>) {
  const [mapScale, setScale] = useState(1);
  const busy = useRef(false);
  const queued = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const requestMeasure = useCallback(() => {
    queued.current = true;
    if (busy.current) return;
    busy.current = true;
    void (async () => {
      try {
        while (queued.current && mounted.current) {
          queued.current = false;
          const map = mapRef.current;
          if (!map) break;
          const next = await measureBusinessBubbleScale(map);
          // Apply every completed measurement so bubbles update during the gesture, then drain
          // the coalesced follow-up if another request arrived while this one was in flight.
          if (mounted.current && next !== null) setScale((prev) => (Math.abs(next - prev) < 1e-6 ? prev : next));
        }
      } finally {
        busy.current = false;
      }
    })();
  }, [mapRef]);

  return {
    mapScale,
    onMapReady: requestMeasure,
    onLayout: (_e: LayoutChangeEvent) => requestMeasure(),
    onRegionChange: requestMeasure,
    onRegionChangeComplete: requestMeasure,
  };
}

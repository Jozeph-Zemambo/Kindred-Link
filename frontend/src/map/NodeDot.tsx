import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { OUTLINE, palette } from './theme';

// A node on the map: a plain outlined circle. Optional cream ring (you / focused) and an
// optional pulsing ripple underneath (the most popular nodes on the find view).

type NodeDotProps = {
  fill: string;
  size?: number;
  ring?: boolean;
  pulse?: boolean;
};

/** Marker views are a fixed pixel size at every zoom level, so this box also bounds the ripple. */
const PULSE_BOX = 72;

function Ripple({ delay }: { delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, t]);
  return (
    <Animated.View
      style={[
        styles.ripple,
        {
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        },
      ]}
    />
  );
}

export function NodeDot({ fill, size = 18, ring = false, pulse = false }: NodeDotProps) {
  const circle = (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]} />
  );
  // Ring: dark edge, cream band, then the outlined circle.
  const dot = ring ? (
    <View style={[styles.ringOuter, { borderRadius: size }]}>
      <View style={[styles.ringBand, { borderRadius: size }]}>{circle}</View>
    </View>
  ) : (
    circle
  );
  if (!pulse) return dot;
  return (
    <View style={styles.pulseBox}>
      <Ripple delay={0} />
      <Ripple delay={900} />
      {dot}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { borderWidth: 2.5, borderColor: OUTLINE },
  ringOuter: { backgroundColor: OUTLINE, padding: 2 },
  ringBand: { backgroundColor: palette.cream, padding: 3 },
  pulseBox: { width: PULSE_BOX, height: PULSE_BOX, alignItems: 'center', justifyContent: 'center' },
  ripple: {
    position: 'absolute',
    width: PULSE_BOX,
    height: PULSE_BOX,
    borderRadius: PULSE_BOX / 2,
    backgroundColor: palette.tangerine,
  },
});

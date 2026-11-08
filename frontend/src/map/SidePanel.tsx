import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from './theme';

// Right-side panel that slides in over the map. Used by the join panel and the business panel.

export const PANEL_WIDTH = Math.min(380, Dimensions.get('window').width * 0.88);

type SidePanelProps = {
  visible: boolean;
  kicker: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the content (buttons). Gets `close` so a button can act, then slide out. */
  footer?: (close: () => void) => ReactNode;
};

export function SidePanel({ visible, kicker, onClose, children, footer }: SidePanelProps) {
  const x = useRef(new Animated.Value(PANEL_WIDTH)).current;
  // A Modal is its own native window, so pad by the app's insets by hand (notch / home bar).
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, x]);

  const close = () => Animated.timing(x, { toValue: PANEL_WIDTH, duration: 180, useNativeDriver: true }).start(() => onClose());

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} />
      <Animated.View style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX: x }] }]}>
        <View style={[styles.inner, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.content}>{children}</View>
          {footer && <View style={styles.footer}>{footer(close)}</View>}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(28, 32, 48, 0.25)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: palette.cream,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  inner: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  kicker: { color: palette.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  close: { color: palette.navy, fontSize: 18 },
  content: { flex: 1 },
  footer: { gap: 10, paddingVertical: 14 },
});

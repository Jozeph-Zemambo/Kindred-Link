import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getChain, getNode } from '@/api/client';
import type { NodePin } from '@/api/types';
import { useLoad } from '@/api/useLoad';

import { timeLeft } from './findable';
import { ancestors } from './graph';
import { actsInLineLabel } from './popularity';
import { OUTLINE, palette } from './theme';

// Find view: slides in from the right when a node is tapped. Shows what the latest person did,
// time left, roughly how long the line is, recent contributors, and a Join button.
// What happens after "Join" (timer, home status) is the screen's job via onJoin.

const PANEL_WIDTH = Math.min(380, Dimensions.get('window').width * 0.88);
const RECENT = 3;

type JoinSheetProps = {
  pin: NodePin | null;
  onClose: () => void;
  onJoin?: (pin: NodePin) => void;
};

export function JoinSheet({ pin, onClose, onJoin }: JoinSheetProps) {
  const x = useRef(new Animated.Value(PANEL_WIDTH)).current;
  // A Modal is its own native window, so pad by the app's insets by hand (notch / home bar).
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (pin) Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [pin, x]);

  const close = () => Animated.timing(x, { toValue: PANEL_WIDTH, duration: 180, useNativeDriver: true }).start(() => onClose());

  const { data } = useLoad(async () => {
    if (!pin) return null;
    const [node, tree] = await Promise.all([getNode(pin.id), getChain(pin.chainId)]);
    // Everyone before this node, newest first (the node itself is the latest act).
    const before = ancestors(tree.nodes, pin.id).slice(1);
    return { node, before };
  }, [pin?.id]);

  return (
    <Modal visible={pin !== null} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} />
      <Animated.View style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX: x }] }]}>
        <View style={[styles.inner, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.kicker}>OPEN ACT NEARBY</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {pin && (
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.title}>{data?.node.description ?? ' '}</Text>
              <View style={styles.pills}>
                <Text style={[styles.pill, { backgroundColor: palette.yellow }]}>{timeLeft(pin.closesAt)}</Text>
                <Text style={[styles.pill, { backgroundColor: palette.blue }]}>{actsInLineLabel(pin.depth)}</Text>
              </View>

              <Text style={styles.section}>Who kept it going</Text>
              {data && data.before.length === 0 && <Text style={styles.muted}>This act started the line. You'd be next.</Text>}
              {data?.before.slice(0, RECENT).map((n, i) => (
                <View key={n.id} style={styles.contributor}>
                  <View style={[styles.dot, { backgroundColor: [palette.tangerine, palette.blue, palette.yellow][i % 3] }]} />
                  <Text style={styles.contributorText} numberOfLines={2}>
                    {n.description ?? 'An act of kindness'}
                  </Text>
                </View>
              ))}
              {data && data.before.length > RECENT && (
                <Text style={styles.muted}>…and {data.before.length - RECENT} more before them</Text>
              )}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.primary]}
              onPress={() => {
                if (pin) onJoin?.(pin);
                close();
              }}
            >
              <Text style={styles.primaryText}>Join this chain</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondary]} onPress={close}>
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
          </View>
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
  body: { paddingVertical: 14, gap: 10 },
  title: { color: palette.navy, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { color: palette.navy, fontSize: 12, fontWeight: '800', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  section: { color: palette.navy, fontSize: 15, fontWeight: '800', marginTop: 12 },
  muted: { color: palette.muted, fontSize: 13 },
  contributor: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.white, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: OUTLINE },
  contributorText: { flex: 1, color: palette.navy, fontSize: 13 },
  actions: { gap: 10, paddingVertical: 14 },
  button: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: palette.navy },
  primaryText: { color: palette.cream, fontSize: 15, fontWeight: '800' },
  secondary: { backgroundColor: palette.cream, borderWidth: 2, borderColor: palette.navy },
  secondaryText: { color: palette.navy, fontSize: 15, fontWeight: '800' },
});

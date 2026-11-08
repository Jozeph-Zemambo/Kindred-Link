import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getNode } from '@/api/client';
import { useLoad } from '@/api/useLoad';

import { assetUrl } from './assetUrl';
import { mix, OUTLINE, palette, textOn } from './theme';

// Chain / tree views: a friendly card for one act when its node is tapped, tinted with that
// node's colour. Photos are cropped to a fixed 4:3 frame so any image fits; acts without a
// photo get a placeholder in the node's colour.

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

type NodeDetailModalProps = {
  nodeId: number | null;
  /** The tapped node's fill; the card takes it on as its theme. */
  accent?: string;
  onClose: () => void;
};

export function NodeDetailModal({ nodeId, accent = palette.blue, onClose }: NodeDetailModalProps) {
  const { data: node } = useLoad(async () => (nodeId === null ? null : getNode(nodeId)), [nodeId]);
  // useLoad keeps the previous load's data; only trust it while it matches the tapped node.
  const current = node?.id === nodeId ? node : null;
  const onAccent = textOn(accent);
  // Navy tints go muddy fast, so tint less for it.
  const cardTint = mix(palette.cream, accent, accent === palette.navy ? 0.08 : 0.2);

  return (
    <Modal visible={nodeId !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: cardTint }]} onPress={() => {}}>
          <View style={[styles.photoFrame, { backgroundColor: accent }]}>
            {current?.photoUrl ? (
              <Image
                key={`${current.id}:${current.photoUrl}`}
                source={{ uri: assetUrl(current.photoUrl) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={[styles.placeholderMark, { color: onAccent }]}>✦</Text>
              </View>
            )}
          </View>
          <View style={[styles.band, { backgroundColor: accent }]} />
          <View style={styles.body}>
            <View style={[styles.kickerPill, { backgroundColor: accent }]}>
              <Text style={[styles.kicker, { color: onAccent }]}>{current?.mine ? 'YOUR ACT' : 'AN ACT OF KINDNESS'}</Text>
            </View>
            <Text style={styles.title}>{current?.description ?? ' '}</Text>
            {current && (
              <Text style={styles.meta}>
                {timeAgo(current.createdAt)} · {current.depth === 0 ? 'started this chain' : `${current.depth} acts before it`}
              </Text>
            )}
            <Pressable style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(28, 32, 48, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: OUTLINE },
  photoFrame: { width: '100%', aspectRatio: 4 / 3 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderMark: { fontSize: 56 },
  band: { height: 6, borderTopWidth: 2, borderColor: OUTLINE },
  body: { padding: 18, gap: 8 },
  kickerPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.5, borderColor: OUTLINE },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: palette.navy, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  meta: { color: palette.muted, fontSize: 13 },
  button: { marginTop: 8, minHeight: 46, borderRadius: 14, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: palette.cream, fontSize: 15, fontWeight: '800' },
});

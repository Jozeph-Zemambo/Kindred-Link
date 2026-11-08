import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getNode } from '@/api/client';
import { useLoad } from '@/api/useLoad';

import { OUTLINE, palette } from './theme';

// Chain / tree views: a friendly card for one act when its node is tapped. Photos are cropped
// to a fixed 4:3 frame so any image fits; acts without a photo get a palette placeholder.

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export function NodeDetailModal({ nodeId, onClose }: { nodeId: number | null; onClose: () => void }) {
  const { data: node } = useLoad(async () => (nodeId === null ? null : getNode(nodeId)), [nodeId]);

  return (
    <Modal visible={nodeId !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.photoFrame}>
            {node?.photoUrl ? (
              <Image source={{ uri: node.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderMark}>✦</Text>
              </View>
            )}
          </View>
          <View style={styles.body}>
            <Text style={styles.kicker}>{node?.mine ? 'YOUR ACT' : 'AN ACT OF KINDNESS'}</Text>
            <Text style={styles.title}>{node?.description ?? ' '}</Text>
            {node && (
              <Text style={styles.meta}>
                {timeAgo(node.createdAt)} · {node.depth === 0 ? 'started this chain' : `${node.depth} acts before it`}
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
  card: { width: '100%', maxWidth: 380, backgroundColor: palette.cream, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: OUTLINE },
  photoFrame: { width: '100%', aspectRatio: 4 / 3, backgroundColor: palette.line },
  placeholder: { flex: 1, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  placeholderMark: { color: palette.cream, fontSize: 56 },
  body: { padding: 18, gap: 8 },
  kicker: { color: palette.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: palette.navy, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  meta: { color: palette.muted, fontSize: 13 },
  button: { marginTop: 8, minHeight: 46, borderRadius: 14, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: palette.cream, fontSize: 15, fontWeight: '800' },
});

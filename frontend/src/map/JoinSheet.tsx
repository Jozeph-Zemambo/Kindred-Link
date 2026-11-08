import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getChain, getNode } from '@/api/client';
import type { NodePin } from '@/api/types';
import { useLoad } from '@/api/useLoad';

import { assetUrl } from './assetUrl';
import { ancestors } from './graph';
import { actsInLineLabel } from './popularity';
import { SidePanel } from './SidePanel';
import { OUTLINE, palette, textOn } from './theme';

// Find view: slides in from the right when a node is tapped. Shows what the latest person did,
// roughly how long the line is, recent contributors, and a Join button. Tapping a contributor
// opens their act's photo under it (one at a time). No countdown here:
// a node only starts a clock once someone claims it. What happens after "Join" (claim timer,
// home status) is the screen's job via onJoin.

const RECENT = 3;
const ROW_COLOURS = [palette.tangerine, palette.blue, palette.yellow];

type JoinSheetProps = {
  pin: NodePin | null;
  onClose: () => void;
  onJoin?: (pin: NodePin) => void;
};

export function JoinSheet({ pin, onClose, onJoin }: JoinSheetProps) {
  const { data, loading } = useLoad(async () => {
    if (!pin) return null;
    const [node, tree] = await Promise.all([getNode(pin.id), getChain(pin.chainId)]);
    // Everyone before this node, newest first (the node itself is the latest act).
    const before = ancestors(tree.nodes, pin.id).slice(1);
    return { node, before };
  }, [pin?.id]);
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => setOpenId(null), [pin?.id]);
  // useLoad keeps the previous load's data while the next one runs, so only trust it
  // when it still belongs to the pin on screen.
  const current = data?.node.id === pin?.id ? data : null;

  return (
    <SidePanel
      visible={pin !== null}
      kicker="OPEN ACT NEARBY"
      onClose={onClose}
      footer={(close) => (
        <>
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
        </>
      )}
    >
      {pin && (
        <ScrollView contentContainerStyle={styles.body}>
          {/* Only acts with an approved photo get the frame; an empty "No photo" box just pushed the act down. */}
          {current?.node.photoUrl ? <PhotoFrame photoUrl={current.node.photoUrl} colour={palette.blue} loading={false} /> : null}
          <Text style={styles.title}>{current?.node.description ?? ' '}</Text>
          <View style={styles.pills}>
            <Text style={[styles.pill, { backgroundColor: palette.blue }]}>{actsInLineLabel(pin.depth)}</Text>
          </View>

          <Text style={styles.section}>Who kept it going</Text>
          {current && current.before.length === 0 && <Text style={styles.muted}>This act started the line. You'd be next.</Text>}
          {current?.before.slice(0, RECENT).map((n, i) => {
            const colour = ROW_COLOURS[i % ROW_COLOURS.length];
            const open = openId === n.id;
            return (
              <Pressable key={n.id} style={styles.contributor} onPress={() => setOpenId(open ? null : n.id)}>
                <View style={styles.contributorRow}>
                  <View style={[styles.dot, { backgroundColor: colour }]} />
                  <Text style={styles.contributorText} numberOfLines={open ? undefined : 2}>
                    {n.description ?? 'An act of kindness'}
                  </Text>
                  <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
                </View>
                {open && <ActPhoto nodeId={n.id} colour={colour} />}
              </Pressable>
            );
          })}
          {current && current.before.length > RECENT && <Text style={styles.muted}>…and {current.before.length - RECENT} more before them</Text>}
        </ScrollView>
      )}
    </SidePanel>
  );
}

/** Fixed 4:3 photo frame: the act's approved photo, a plain colour block while loading, or a placeholder. */
function PhotoFrame({ photoUrl, colour, loading }: { photoUrl?: string | null; colour: string; loading: boolean }) {
  return (
    <View style={[styles.photo, { backgroundColor: colour }]}>
      {photoUrl ? (
        <Image key={photoUrl} source={{ uri: assetUrl(photoUrl) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        !loading && (
          <View style={styles.noPhoto}>
            <Text style={[styles.noPhotoMark, { color: textOn(colour) }]}>✦</Text>
            <Text style={[styles.noPhotoText, { color: textOn(colour) }]}>No photo available</Text>
          </View>
        )
      )}
    </View>
  );
}

/** The photo someone attached to their act, in the row's colour; fetched per contributor. */
function ActPhoto({ nodeId, colour }: { nodeId: number; colour: string }) {
  const { data: node, loading } = useLoad(() => getNode(nodeId), [nodeId]);
  const ready = node?.id === nodeId;
  return <PhotoFrame photoUrl={ready ? node?.photoUrl : null} colour={colour} loading={loading || !ready} />;
}

const styles = StyleSheet.create({
  body: { paddingVertical: 14, gap: 10 },
  title: { color: palette.navy, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { color: palette.navy, fontSize: 12, fontWeight: '800', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  section: { color: palette.navy, fontSize: 15, fontWeight: '800', marginTop: 12 },
  muted: { color: palette.muted, fontSize: 13 },
  contributor: { gap: 10, backgroundColor: palette.white, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 12 },
  contributorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevron: { color: palette.muted, fontSize: 14 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: OUTLINE },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  noPhotoMark: { fontSize: 32 },
  noPhotoText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: OUTLINE },
  contributorText: { flex: 1, color: palette.navy, fontSize: 13 },
  button: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: palette.navy },
  primaryText: { color: palette.cream, fontSize: 15, fontWeight: '800' },
  secondary: { backgroundColor: palette.cream, borderWidth: 2, borderColor: palette.navy },
  secondaryText: { color: palette.navy, fontSize: 15, fontWeight: '800' },
});

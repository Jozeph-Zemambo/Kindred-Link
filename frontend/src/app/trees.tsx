import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getChain, getNode, listMine } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { ChainMap, descendants } from '@/map';

const COLORS = { cream: '#FFF9E9', blue: '#80B9E5', navy: '#303A59', white: '#FFFFFF', muted: '#6C748A', line: '#E9DEC4', tangerine: '#F49A68' };

// This is the user's live tree view. It follows the newest contribution instead
// of showing a crowded list of every tree from the period.
export default function TreesScreen() {
  const { nodeId: nodeIdParam } = useLocalSearchParams<{ nodeId?: string }>();
  const claimedNodeId = Number(nodeIdParam);
  const [viewMode, setViewMode] = useState<'full' | 'fromMine'>('full');
  // The tree draws itself in only when the screen opens (from the My tree tab). Once the person
  // switches views, the map goes back to its usual zoom-to-fit.
  const [switched, setSwitched] = useState(false);
  const showView = (mode: 'full' | 'fromMine') => { if (mode === viewMode) return; setSwitched(true); setViewMode(mode); };
  const { data, error, loading, reload } = useLoad(async () => {
    const mine = await listMine();
    const claimed = Number.isFinite(claimedNodeId) && claimedNodeId > 0 ? await getNode(claimedNodeId) : null;
    const latest = claimed ?? mine[0];
    if (!latest) return null;
    return { latest, tree: await getChain(latest.chainId) };
  }, [claimedNodeId]);
  const tree = data?.tree;
  const viewNodes = useMemo(() => {
    if (!tree || viewMode === 'full') return tree?.nodes ?? [];
    return descendants(tree.nodes, data.latest.id);
  }, [data?.latest.id, tree, viewMode]);
  const depth = useMemo(() => {
    if (!viewNodes.length) return 0;
    const startingDepth = viewMode === 'fromMine' ? data?.latest.depth ?? 0 : 0;
    return Math.max(...viewNodes.map((node) => node.depth - startingDepth));
  }, [data?.latest.depth, viewMode, viewNodes]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}><Text style={styles.eyebrow}>YOUR KINDNESS</Text><Text style={styles.title}>My tree</Text><Text style={styles.subtitle}>The tree you contributed to most recently.</Text></View>
      {loading || error ? <LoadState error={error} onRetry={reload} /> : !tree ? <LoadState empty="Your tree will appear after your first act of kindness." /> : <View style={styles.content}>
        <View style={styles.toggle}><Pressable onPress={() => showView('full')} style={[styles.toggleOption, viewMode === 'full' && styles.toggleSelected]}><Text style={[styles.toggleText, viewMode === 'full' && styles.toggleSelectedText]}>Full tree</Text></Pressable><Pressable onPress={() => showView('fromMine')} style={[styles.toggleOption, viewMode === 'fromMine' && styles.toggleSelected]}><Text style={[styles.toggleText, viewMode === 'fromMine' && styles.toggleSelectedText]}>From my contribution</Text></Pressable></View>
        <View style={styles.mapCard}><ChainMap nodes={viewNodes} drawIn={!switched} /></View>
        <View style={styles.statsCard}><Text style={styles.statsTitle}>{viewMode === 'full' ? 'Your tree, still growing' : 'What grew from your contribution'}</Text><View style={styles.statsRow}><View><Text style={styles.statValue}>{viewNodes.length}</Text><Text style={styles.statLabel}>acts connected</Text></View><View><Text style={styles.statValue}>{depth}</Text><Text style={styles.statLabel}>steps deep</Text></View><View><Text style={styles.statValue}>{tree.status === 'ENDED' ? 'Complete' : 'Growing'}</Text><Text style={styles.statLabel}>current status</Text></View></View></View>
      </View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, padding: 20, paddingBottom: 96 }, header: { marginBottom: 16 }, eyebrow: { color: COLORS.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: COLORS.navy, fontSize: 28, fontWeight: '800', marginTop: 4 }, subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 5 }, content: { flex: 1 }, toggle: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, padding: 4, marginBottom: 12 }, toggleOption: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8 }, toggleSelected: { backgroundColor: COLORS.navy }, toggleText: { color: COLORS.muted, fontSize: 11, fontWeight: '800' }, toggleSelectedText: { color: COLORS.white }, mapCard: { flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 22, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, statsCard: { backgroundColor: COLORS.blue, borderRadius: 20, padding: 16, marginTop: 14 }, statsTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '800', marginBottom: 12 }, statsRow: { flexDirection: 'row', justifyContent: 'space-between' }, statValue: { color: COLORS.navy, fontSize: 20, fontWeight: '900' }, statLabel: { color: COLORS.navy, opacity: 0.7, fontSize: 10, marginTop: 3 },
});

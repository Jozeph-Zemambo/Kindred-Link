import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRecap } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { BottomNav } from '@/components/BottomNav';
import { ChainMap } from '@/map';

const COLORS = { cream: '#FFF9E9', blue: '#80B9E5', navy: '#303A59', white: '#FFFFFF', muted: '#6C748A', line: '#E9DEC4', tangerine: '#F49A68' };

// My Trees owns the top-three contributed trees and their selected-tree stats.
// The future full-tree / from-your-start toggle belongs here, not in the recap story.
export default function TreesScreen() {
  const { data, error, loading, reload } = useLoad(() => getRecap());
  const [selected, setSelected] = useState(0);
  const trees = data?.largestNets.slice(0, 3) ?? [];
  const tree = trees[selected];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>YOUR KINDNESS</Text><Text style={styles.title}>My trees</Text><Text style={styles.subtitle}>The three trees you helped grow this period.</Text></View></View>
      {loading || error || !data ? <LoadState error={error} onRetry={reload} /> : !tree ? <LoadState empty="No trees to show for this period yet." /> : <View style={styles.content}>
        <View style={styles.treeTabs}>{trees.map((_, index) => <Pressable key={index} onPress={() => setSelected(index)} style={[styles.treeTab, index === selected && styles.activeTreeTab]}><Text style={[styles.treeTabText, index === selected && styles.activeTreeTabText]}>Tree {index + 1}</Text></Pressable>)}</View>
        <View style={styles.mapCard}><ChainMap nodes={tree.nodes} /></View>
        <View style={styles.statsCard}><Text style={styles.statsTitle}>Tree {selected + 1} impact</Text><View style={styles.statsRow}><View><Text style={styles.statValue}>{tree.nodes.length}</Text><Text style={styles.statLabel}>acts connected</Text></View><View><Text style={styles.statValue}>{Math.max(...tree.nodes.map((node) => node.depth), 0)}</Text><Text style={styles.statLabel}>steps deep</Text></View><View><Text style={styles.statValue}>{tree.status === 'ENDED' ? 'Complete' : 'Growing'}</Text><Text style={styles.statLabel}>current status</Text></View></View></View>
      </View>}
      <BottomNav active="trees" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, padding: 20, paddingBottom: 96 }, header: { marginBottom: 16 }, eyebrow: { color: COLORS.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: COLORS.navy, fontSize: 28, fontWeight: '800', marginTop: 4 }, subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 5 }, content: { flex: 1 }, treeTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 }, treeTab: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 18, paddingVertical: 9 }, activeTreeTab: { backgroundColor: COLORS.navy, borderColor: COLORS.navy }, treeTabText: { color: COLORS.navy, fontSize: 12, fontWeight: '800' }, activeTreeTabText: { color: COLORS.white }, mapCard: { flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 22, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, statsCard: { backgroundColor: COLORS.blue, borderRadius: 20, padding: 16, marginTop: 14 }, statsTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '800', marginBottom: 12 }, statsRow: { flexDirection: 'row', justifyContent: 'space-between' }, statValue: { color: COLORS.navy, fontSize: 20, fontWeight: '900' }, statLabel: { color: COLORS.navy, opacity: 0.7, fontSize: 10, marginTop: 3 },
});

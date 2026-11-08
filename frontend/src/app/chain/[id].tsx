import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getChain, getNode } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { ChainMap, lineage } from '@/map';

// Full chain for one node: every act above it (to the start) and every act below it.
export default function ChainScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nodeId = Number(id);

  const { data, error, loading, reload } = useLoad(async () => {
    const node = await getNode(nodeId);
    const tree = await getChain(node.chainId);
    return { node, nodes: lineage(tree.nodes, nodeId) };
  }, [nodeId]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}><Text style={styles.title}>{data ? data.node.description : 'Chain'}</Text>{data && <Pressable style={styles.logButton} onPress={() => router.push({ pathname: '/explore', params: { mode: 'log', nodeId: String(nodeId) } })}><Text style={styles.logButtonText}>Log kindness</Text></Pressable>}</View>
      {loading || error || !data ? (
        <LoadState error={error} onRetry={reload} />
      ) : (
        <ChainMap nodes={data.nodes} focusId={nodeId} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12 },
  title: { flex: 1, fontSize: 18, fontWeight: '600' },
  logButton: { backgroundColor: '#F49A68', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  logButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});

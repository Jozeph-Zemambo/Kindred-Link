import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getChain, getNode } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { BottomNav } from '@/components/BottomNav';
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
      <Text style={styles.title}>{data ? data.node.description : 'Chain'}</Text>
      {loading || error || !data ? (
        <LoadState error={error} onRetry={reload} />
      ) : (
        <ChainMap nodes={data.nodes} focusId={nodeId} />
      )}
      <BottomNav active="trees" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 96 },
  title: { fontSize: 18, fontWeight: '600', padding: 16 },
});

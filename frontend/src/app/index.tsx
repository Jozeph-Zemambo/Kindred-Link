import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getChain, listBusinesses, listMine } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { ChainMap, descendants } from '@/map';

// Home: everything that grew out of my latest act.
export default function HomeScreen() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [mine, businesses] = await Promise.all([listMine(), listBusinesses()]);
    const latest = mine[0];
    if (!latest) return { latest: null, nodes: [], businesses };
    const tree = await getChain(latest.chainId);
    return { latest, nodes: descendants(tree.nodes, latest.id), businesses };
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Kindred Link</Text>
      {loading || error || !data ? (
        <LoadState error={error} onRetry={reload} />
      ) : !data.latest ? (
        <LoadState empty="No acts yet. Do one and it'll grow here." />
      ) : (
        <ChainMap
          nodes={data.nodes}
          focusId={data.latest.id}
          businesses={data.businesses}
          onNodePress={(id) => router.push({ pathname: '/chain/[id]', params: { id: String(id) } })}
        />
      )}
      <View style={styles.nav}>
        <Link href="/recap">Weekly recap</Link>
        <Link href="/settings">Settings</Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: '600', padding: 16 },
  nav: { flexDirection: 'row', justifyContent: 'space-around', padding: 16 },
});

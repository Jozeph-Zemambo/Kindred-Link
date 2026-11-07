import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRecap } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { ChainMap } from '@/map';

type RecapView = 'chains' | 'nets';

// Weekly recap: top 3 longest straight chains, or top 3 biggest nets, one on the map at a time.
export default function RecapScreen() {
  const { data, error, loading, reload } = useLoad(() => getRecap());
  const [view, setView] = useState<RecapView>('chains');
  const [rank, setRank] = useState(0);

  const list = data ? (view === 'chains' ? data.longestChains : data.largestNets) : [];
  const shown = list[Math.min(rank, list.length - 1)];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.row}>
        {(['chains', 'nets'] as const).map((v) => (
          <Pressable key={v} onPress={() => { setView(v); setRank(0); }} style={[styles.chip, view === v && styles.active]}>
            <Text>{v === 'chains' ? 'Longest chains' : 'Biggest nets'}</Text>
          </Pressable>
        ))}
      </View>
      {loading || error || !data ? (
        <LoadState error={error} onRetry={reload} />
      ) : !shown ? (
        <LoadState empty="Nothing this week yet." />
      ) : (
        <>
          <ChainMap nodes={shown.nodes} />
          <Text style={styles.caption}>{shown.nodes.length} acts</Text>
          <View style={styles.row}>
            {list.map((_, i) => (
              <Pressable key={i} onPress={() => setRank(i)} style={[styles.chip, rank === i && styles.active]}>
                <Text>{i + 1}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db' },
  active: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' },
  caption: { textAlign: 'center', paddingTop: 8 },
});

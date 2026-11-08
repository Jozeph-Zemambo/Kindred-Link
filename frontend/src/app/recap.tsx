import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRecap } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { BottomNav } from '@/components/BottomNav';
import { ChainMap } from '@/map';

const COLORS = { cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', tangerine: '#F49A68', navy: '#303A59', white: '#FFFFFF', muted: '#6C748A', line: '#E9DEC4', purple: '#9B8BE8' };

function roundedImpact(count: number) { return `${Math.max(5, Math.round(count / 5) * 5)}+`; }

function formatRecapPeriod(week?: string) {
  const match = week?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return 'This period';
  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const monday = new Date(januaryFourth);
  monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + ((weekNumber - 1) * 7));
  const month = monday.toLocaleDateString(undefined, { month: 'long' });
  return `${year} · ${month} · Week ${Math.ceil(monday.getDate() / 7)}`;
}

// End-of-period recap presented as a story sequence, similar to a wrapped experience.
export default function RecapScreen() {
  const { data, error, loading, reload } = useLoad(() => getRecap());
  const [storyIndex, setStoryIndex] = useState(0);
  const stats = useMemo(() => {
    if (!data) return { trees: 0, longest: 0 };
    return { trees: data.largestNets.length, longest: data.longestChains[0]?.nodes.length ?? 0 };
  }, [data]);
  const featured = data?.largestNets[0];
  const stories = ['intro', 'trees', 'acts', 'map'] as const;
  const story = stories[storyIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}><Text style={styles.headerTitle}>Your kindness recap</Text><Text style={styles.headerPeriod}>{formatRecapPeriod(data?.week)}</Text></View>
      {loading || error || !data ? <LoadState error={error} onRetry={reload} /> : (
        <View style={styles.storyArea}>
          <View style={styles.progressRow}>{stories.map((_, index) => <View key={index} style={[styles.progressSegment, index <= storyIndex && styles.progressActive]} />)}</View>
          <View style={[styles.storyCard, story === 'intro' && styles.introCard, story === 'trees' && styles.treesCard, story === 'acts' && styles.actsCard, story === 'map' && styles.mapStoryCard]}>
            {story === 'intro' && <><Text style={styles.kicker}>A LITTLE LOOK BACK</Text><Text style={styles.bigTitle}>Your kindness{`\n`}kept moving.</Text><Text style={styles.storyBody}>Here’s the ripple you helped create during {formatRecapPeriod(data.week)}.</Text></>}
            {story === 'trees' && <><Text style={styles.kicker}>YOUR RIPPLE</Text><Text style={styles.statNumber}>{stats.trees}</Text><Text style={styles.statTitle}>trees grew with you</Text><Text style={styles.storyBody}>Every tree is a collection of small acts that kept moving from person to person.</Text></>}
            {story === 'acts' && <><Text style={styles.kicker}>YOUR BIGGEST MOMENT</Text><Text style={styles.statNumber}>{roundedImpact(stats.longest)}</Text><Text style={styles.statTitle}>acts in your longest ripple</Text><Text style={styles.storyBody}>That’s how far one kind choice travelled through the community.</Text></>}
            {story === 'map' && featured && <><Text style={styles.kicker}>THE RIPPLE IN MOTION</Text><View style={styles.storyMap}><ChainMap nodes={featured.nodes} onNodePress={() => undefined} /></View><Text style={styles.statTitle}>{roundedImpact(featured.nodes.length)} acts connected</Text><Text style={styles.storyBody}>Your kindness became part of something bigger.</Text></>}
          </View>
          <View style={styles.navigation}><Pressable onPress={() => setStoryIndex((index) => Math.max(0, index - 1))} disabled={storyIndex === 0} style={[styles.navButton, storyIndex === 0 && styles.disabledButton]}><Text style={styles.navButtonText}>Back</Text></Pressable><Text style={styles.pageCount}>{storyIndex + 1} / {stories.length}</Text><Pressable onPress={() => setStoryIndex((index) => Math.min(stories.length - 1, index + 1))} disabled={storyIndex === stories.length - 1} style={[styles.navButton, storyIndex === stories.length - 1 && styles.disabledButton]}><Text style={styles.navButtonText}>{storyIndex === stories.length - 1 ? 'Done' : 'Next'}</Text></Pressable></View>
        </View>
      )}
      <BottomNav active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, padding: 20, paddingBottom: 96 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, headerTitle: { color: COLORS.navy, fontSize: 20, fontWeight: '800' }, headerPeriod: { color: COLORS.tangerine, fontSize: 12, fontWeight: '800' }, storyArea: { flex: 1 }, progressRow: { flexDirection: 'row', gap: 5, marginBottom: 12 }, progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.line }, progressActive: { backgroundColor: COLORS.tangerine }, storyCard: { flex: 1, minHeight: 470, borderRadius: 28, padding: 25, justifyContent: 'center', overflow: 'hidden' }, introCard: { backgroundColor: COLORS.navy }, treesCard: { backgroundColor: COLORS.blue }, actsCard: { backgroundColor: COLORS.tangerine }, mapStoryCard: { backgroundColor: COLORS.purple, justifyContent: 'flex-start' }, kicker: { color: COLORS.yellow, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, bigTitle: { color: COLORS.white, fontSize: 39, lineHeight: 43, fontWeight: '900', marginTop: 18 }, storyBody: { color: COLORS.white, opacity: 0.82, fontSize: 15, lineHeight: 22, marginTop: 16 }, statNumber: { color: COLORS.navy, fontSize: 88, lineHeight: 94, fontWeight: '900', marginTop: 18 }, statTitle: { color: COLORS.navy, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 5 }, storyMap: { height: 260, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.white, marginTop: 18, marginBottom: 15 }, navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }, navButton: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 }, disabledButton: { opacity: 0.35 }, navButtonText: { color: COLORS.navy, fontSize: 12, fontWeight: '800' }, pageCount: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
});

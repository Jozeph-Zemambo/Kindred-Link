import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRecap } from '@/api/client';
import type { RecapMoment } from '@/api/types';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { assetUrl, ChainMap } from '@/map';

const COLORS = { cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', tangerine: '#F49A68', navy: '#303A59', white: '#FFFFFF', muted: '#6C748A', line: '#E9DEC4', purple: '#9B8BE8' };

const acts = (count: number) => `${count} ${count === 1 ? 'act' : 'acts'}`;

// Shown behind photos and the map while they load: a soft tint of the card instead of a white box.
const LOADING_TINT = 'rgba(255, 255, 255, 0.14)';

/**
 * Pages slide over each other: the new page comes in from the side you're moving toward (Next:
 * right, Back: left) and covers the old one, which drifts the other way underneath. Neither page
 * fades, so the background never shows through mid-transition.
 */
function StoryStage({ index, dir, renderCard }: { index: number; dir: 1 | -1; renderCard: (i: number) => ReactNode }) {
  // Each transition gets its own animated value, created in the same render that adds the new page.
  // Both pages are therefore placed in one frame: no frame where the old page moved and the new one isn't drawn yet.
  const [stage, setStage] = useState(() => ({ current: index, previous: null as number | null, t: new Animated.Value(1) }));
  if (stage.current !== index) {
    setStage({ current: index, previous: stage.current, t: new Animated.Value(0) });
  }
  const width = Dimensions.get('window').width;

  useEffect(() => {
    if (stage.previous === null) return;
    const t = stage.t;
    const anim = Animated.timing(t, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished) setStage((s) => (s.t === t ? { ...s, previous: null } : s));
    });
    return () => anim.stop();
  }, [stage.t, stage.previous]);

  const incoming = stage.t.interpolate({ inputRange: [0, 1], outputRange: [dir * width, 0] });
  const outgoing = stage.t.interpolate({ inputRange: [0, 1], outputRange: [0, -dir * width * 0.25] });
  // Same parent and stable keys, so a page keeps its state (map, count-up) when it moves to the back.
  const layers = stage.previous === null ? [stage.current] : [stage.previous, stage.current];
  return (
    <View style={styles.stage}>
      {layers.map((i) => (
        <Animated.View key={i} style={[styles.layer, { transform: [{ translateX: i === stage.current ? incoming : outgoing }] }]}>
          {renderCard(i)}
        </Animated.View>
      ))}
    </View>
  );
}

/** A progress segment that fills left to right instead of snapping. */
function ProgressSegment({ filled }: { filled: boolean }) {
  const t = useRef(new Animated.Value(filled ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: filled ? 1 : 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [filled, t]);
  return <View style={styles.progressSegment}><Animated.View style={[styles.progressFill, { width: t.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>;
}

/** Counts up from 0 to the real value when its page opens. */
function CountUp({ value, style }: { value: number; style: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = new Animated.Value(0);
    const id = t.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(t, { toValue: value, duration: Math.min(900, 250 + value * 60), easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => t.removeListener(id);
  }, [value]);
  return <Text style={style}>{shown}</Text>;
}

// End-of-period recap presented as a story sequence, similar to a wrapped experience.
export default function RecapScreen() {
  const { data, error, loading, reload } = useLoad(() => getRecap());
  const [storyIndex, setStoryIndex] = useState(0);
  // Which way the last Back/Next went, so the next page slides in from that side.
  const [dir, setDir] = useState<1 | -1>(1);
  const go = (step: 1 | -1) => {
    setDir(step);
    setStoryIndex((index) => Math.max(0, Math.min(stories.length - 1, index + step)));
  };
  const stats = useMemo(() => {
    if (!data) return { trees: 0, longest: 0 };
    return { trees: data.totalTrees ?? data.largestNets.length, longest: data.longestChains[0]?.nodes.length ?? 0 };
  }, [data]);
  // Page 3 and the final map intentionally reference the same longest ripple.
  const featured = data?.longestChains[0];
  const moments = useMemo(() => [...(data?.moments ?? [])].sort(() => Math.random() - 0.5).slice(0, 3), [data]);
  // Fetch the photos as soon as the recap loads, so a photo page is ready before you reach it.
  useEffect(() => {
    moments.forEach((m) => m.photoUrl && Image.prefetch(assetUrl(m.photoUrl)));
  }, [moments]);
  type Story = 'intro' | 'trees' | 'acts' | 'map' | { kind: 'photo'; moment: RecapMoment };
  const stories: Story[] = useMemo(() => [
    'intro', 'trees', 'acts',
    ...moments.map((moment) => ({ kind: 'photo' as const, moment })),
    'map',
  ], [moments]);
  // One story page. StoryStage keeps the previous page on screen while the next slides over it.
  const renderCard = (i: number) => {
    const story = stories[i];
    return (
          <View style={[styles.storyCard, story === 'intro' && styles.introCard, story === 'trees' && styles.treesCard, story === 'acts' && styles.actsCard, story === 'map' && styles.mapStoryCard, typeof story !== 'string' && styles.photoCard]}>
            {story === 'intro' && <><Text style={styles.kicker}>YOUR RECAP</Text><Text style={styles.bigTitle}>Your kindness{`\n`}kept moving.</Text><Text style={styles.storyBody}>Here’s the ripple you helped create.</Text></>}
            {story === 'trees' && <><Text style={styles.kicker}>YOUR RIPPLE</Text><CountUp style={styles.statNumber} value={stats.trees} /><Text style={styles.statTitle}>trees grew with you</Text><Text style={styles.storyBody}>Every tree is a collection of small acts that kept moving from person to person.</Text></>}
            {story === 'acts' && <><Text style={styles.kicker}>YOUR BIGGEST MOMENT</Text><CountUp style={styles.statNumber} value={stats.longest} /><Text style={styles.statTitle}>{stats.longest === 1 ? 'act' : 'acts'} in your longest ripple</Text><Text style={styles.storyBody}>That’s how far one kind choice travelled through the community.</Text></>}
            {typeof story !== 'string' && story.kind === 'photo' && <><Text style={styles.kicker}>A MOMENT WORTH KEEPING</Text><View style={styles.photoFrame}>{story.moment.photoUrl ? <Image source={{ uri: assetUrl(story.moment.photoUrl) }} style={styles.photo} resizeMode="cover" /> : <Text style={styles.photoFallback}>Photo coming soon</Text>}</View><Text style={styles.photoCaption}>{story.moment.description}</Text><Text style={styles.storyBody}>A glimpse of the kindness you helped set in motion.</Text></>}
            {story === 'map' && featured && <><Text style={styles.kicker}>THE RIPPLE IN MOTION</Text><View style={styles.storyMap}><ChainMap nodes={featured.nodes} onNodePress={() => undefined} /></View><Text style={styles.statTitle}>{acts(featured.nodes.length)} connected</Text><Text style={styles.storyBody}>Your kindness became part of something bigger.</Text></>}
          </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}><Text style={styles.headerTitle}>Your recap</Text></View>
      {loading || error || !data ? <LoadState error={error} onRetry={reload} /> : (
        <View style={styles.storyArea}>
          <View style={styles.progressRow}>{stories.map((_, index) => <ProgressSegment key={index} filled={index <= storyIndex} />)}</View>
          <StoryStage index={storyIndex} dir={dir} renderCard={renderCard} />
          <View style={styles.navigation}><Pressable onPress={() => go(-1)} disabled={storyIndex === 0} style={[styles.navButton, storyIndex === 0 && styles.disabledButton]}><Text style={styles.navButtonText}>Back</Text></Pressable><Text style={styles.pageCount}>{storyIndex + 1} / {stories.length}</Text><Pressable onPress={() => storyIndex === stories.length - 1 ? router.replace('/') : go(1)} style={styles.navButton}><Text style={styles.navButtonText}>{storyIndex === stories.length - 1 ? 'Done' : 'Next'}</Text></Pressable></View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, padding: 20, paddingBottom: 96 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, headerTitle: { color: COLORS.navy, fontSize: 20, fontWeight: '800' }, headerPeriod: { color: COLORS.tangerine, fontSize: 12, fontWeight: '800' }, storyArea: { flex: 1 }, stage: { flex: 1 }, layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, progressRow: { flexDirection: 'row', gap: 5, marginBottom: 12 }, progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.line, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: COLORS.tangerine }, storyCard: { flex: 1, minHeight: 470, borderRadius: 28, padding: 25, justifyContent: 'center', overflow: 'hidden' }, introCard: { backgroundColor: COLORS.navy }, treesCard: { backgroundColor: COLORS.blue }, actsCard: { backgroundColor: COLORS.tangerine }, mapStoryCard: { backgroundColor: COLORS.purple, justifyContent: 'flex-start' }, photoCard: { backgroundColor: COLORS.navy, justifyContent: 'flex-start' }, kicker: { color: COLORS.yellow, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, bigTitle: { color: COLORS.white, fontSize: 39, lineHeight: 43, fontWeight: '900', marginTop: 18 }, storyBody: { color: COLORS.white, opacity: 0.82, fontSize: 15, lineHeight: 22, marginTop: 16 }, statNumber: { color: COLORS.navy, fontSize: 88, lineHeight: 94, fontWeight: '900', marginTop: 18 }, statTitle: { color: COLORS.navy, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 5 }, storyMap: { height: 260, borderRadius: 20, overflow: 'hidden', backgroundColor: LOADING_TINT, marginTop: 18, marginBottom: 15 }, photoFrame: { height: 280, borderRadius: 20, overflow: 'hidden', backgroundColor: LOADING_TINT, marginTop: 18 }, photo: { width: '100%', height: '100%' }, photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', color: COLORS.muted }, photoCaption: { color: COLORS.white, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 16 }, navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }, navButton: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 }, disabledButton: { opacity: 0.35 }, navButtonText: { color: COLORS.navy, fontSize: 12, fontWeight: '800' }, pageCount: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
});

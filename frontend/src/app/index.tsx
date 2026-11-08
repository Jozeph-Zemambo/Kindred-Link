import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/expo';

import { getChain, listBusinesses, listMine, listNearby } from '@/api/client';
import { isClerkConfigured } from '@/auth/clerk';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { descendants, getMyLocation, isFindable, JoinMap } from '@/map';
import type { ChainTree, NodePin } from '@/api/types';

const COLORS = {
  cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', tangerine: '#F49A68', navy: '#303A59',
  white: '#FFFFFF', muted: '#6C748A', line: '#E9DEC4',
};

function formatTimeLeft(timestamp: string, now: number) {
  const difference = Math.max(0, Date.parse(timestamp) - now);
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  if (difference === 0) return 'Ended';
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  return `${hours}h ${minutes}m left`;
}

function formatImpact(count: number) {
  return `${count} ${count === 1 ? 'act' : 'acts'}`;
}

function getGreeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ClerkDisplayName() {
  const { user } = useUser();
  const name = user?.firstName ?? user?.fullName?.trim().split(/\s+/)[0] ?? 'Kind human';
  return <Text style={styles.displayName}>{name}</Text>;
}

function ClerkProfileInitial() {
  const { user } = useUser();
  const name = user?.firstName ?? user?.fullName?.trim().split(/\s+/)[0] ?? 'K';
  return <Text style={styles.profileInitial}>{name.slice(0, 1).toUpperCase()}</Text>;
}

function getPeriodWindow(now: number) {
  const end = new Date(now);
  const day = end.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  end.setDate(end.getDate() + daysUntilNextMonday);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  const total = end.getTime() - start.getTime();
  return { start, end, progress: Math.min(1, Math.max(0, (now - start.getTime()) / total)) };
}

function formatPeriodEnd(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function Metric({ value, label, accent }: { value: string | number; label: string; accent: string }) {
  return <View style={styles.metric}><View style={[styles.metricDot, { backgroundColor: accent }]} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function ActionButton({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.actionButton, primary ? styles.primaryAction : styles.secondaryAction]}><Text style={[styles.actionText, primary ? styles.primaryActionText : styles.secondaryActionText]}>{label}</Text></Pressable>;
}

function HeroCarousel({ hasRecap, recapViewed, onRecapViewed }: { hasRecap: boolean; recapViewed: boolean; onRecapViewed: () => void }) {
  const { width } = useWindowDimensions();
  const slideWidth = Math.max(1, width - 40);
  const carousel = useRef<ScrollViewInstance>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (!hasRecap || recapViewed) return;
    const timer = setTimeout(() => {
      onRecapViewed();
      carousel.current?.scrollTo({ x: slideWidth, animated: true });
    }, 4_500);
    return () => clearTimeout(timer);
  }, [hasRecap, onRecapViewed, recapViewed, slideWidth]);

  const handleScrollEnd = (offsetX: number) => {
    const nextIndex = Math.round(offsetX / slideWidth);
    setSlideIndex(nextIndex);
    if (hasRecap && nextIndex > 0) onRecapViewed();
  };

  return (
    <View>
      <ScrollView
        ref={carousel}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => handleScrollEnd(event.nativeEvent.contentOffset.x)}
      >
        {hasRecap && (
          <View style={[styles.heroSlide, { width: slideWidth }]}>
            <Pressable
              style={[styles.heroCard, styles.recapCardCompact]}
              onPress={() => { onRecapViewed(); router.push('/recap'); }}
              accessibilityRole="button"
              accessibilityLabel="Open your weekly recap"
            >
              <View style={styles.heroCopy}><Text style={styles.recapHeroKicker}>WEEKLY RECAP</Text><Text style={styles.recapHeroTitle}>See your ripple.</Text><Text style={styles.recapHeroText}>A quick look at the kindness you helped create.</Text></View><Text style={styles.heroArrow}>›</Text>
            </Pressable>
          </View>
        )}
        <View style={[styles.heroSlide, { width: slideWidth }]}>
          <View style={styles.heroCard}><View style={styles.heroCopy}><Text style={styles.heroKicker}>YOUR RIPPLE EFFECT</Text><Text style={styles.heroTitle}>Small acts can travel far.</Text></View><View style={styles.heroOrb}><Text style={styles.heroOrbText}>✦</Text></View></View>
        </View>
      </ScrollView>
      {hasRecap && <View style={styles.heroDots}>{[0, 1].map((index) => <View key={index} style={[styles.heroDot, slideIndex === index && styles.heroDotActive]} />)}</View>}
    </View>
  );
}

type TreeSummary = {
  chainId: number;
  tree: ChainTree;
  latest: NodePin;
  contributionCount: number;
};

export default function HomeScreen() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [mine, nearbyMe, businesses] = await Promise.all([
      listMine(),
      getMyLocation(),
      listBusinesses().catch(() => []),
    ]);
    const nearbyPins = await listNearby(nearbyMe.lat, nearbyMe.lng);
    const latest = mine[0];
    const chainIds = [...new Set(mine.map((node) => node.chainId))];
    const trees: TreeSummary[] = await Promise.all(chainIds.map(async (chainId) => {
      const tree = await getChain(chainId);
      const contributions = mine.filter((node) => node.chainId === chainId);
      return { chainId, tree, latest: contributions[0], contributionCount: contributions.length };
    }));
    const latestTree = latest ? trees.find((summary) => summary.chainId === latest.chainId) : undefined;
    return {
      latest: latest ?? null,
      nodes: latest && latestTree ? descendants(latestTree.tree.nodes, latest.id) : [],
      allNodes: latestTree?.tree.nodes ?? [],
      mine,
      trees,
      nearbyMe,
      nearbyPins,
      businesses,
    };
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  const period = useMemo(() => getPeriodWindow(now), [now]);
  const metrics = useMemo(() => {
    if (!data) return { acts: 0, affected: 0, reach: 0 };
    const mineIds = new Set(data.mine.map((node) => node.id));
    const affectedIds = new Set<number>();
    const periodContributions = data.mine.filter((node) => {
      const createdAt = Date.parse(node.createdAt);
      return createdAt >= period.start.getTime() && createdAt < period.end.getTime();
    });
    for (const contribution of periodContributions) {
      const tree = data.trees.find((summary) => summary.chainId === contribution.chainId)?.tree;
      if (!tree) continue;
      for (const node of descendants(tree.nodes, contribution.id)) {
        if (node.id !== contribution.id && !mineIds.has(node.id)) affectedIds.add(node.id);
      }
    }
    return { acts: data.mine.length, affected: affectedIds.size, reach: data.allNodes?.length ?? data.nodes.length };
  }, [data, period]);
  const visibleTrees = data?.trees.slice(0, 1) ?? [];
  // Same pins the join map draws, so the count matches the dots.
  const openNearby = data?.nearbyPins.filter(isFindable).length ?? 0;
  const hasPeriodActivity = Boolean(data?.mine.some((node) => {
    const createdAt = Date.parse(node.createdAt);
    return createdAt >= period.start.getTime() && createdAt < period.end.getTime();
  }));
  const recapViewKey = `kindred.recap.viewed.${period.start.getFullYear()}-${period.start.getMonth() + 1}-${period.start.getDate()}`;
  const [recapViewed, setRecapViewed] = useState(false);

  useEffect(() => {
    if (!hasPeriodActivity) return;
    AsyncStorage.getItem(recapViewKey).then((value) => setRecapViewed(value === '1')).catch(() => undefined);
  }, [hasPeriodActivity, recapViewKey]);

  const markRecapViewed = useCallback(() => {
    setRecapViewed(true);
    AsyncStorage.setItem(recapViewKey, '1').catch(() => undefined);
  }, [recapViewKey]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View><Text style={styles.eyebrow}>YOUR KINDNESS, IN MOTION</Text><Text style={styles.greeting}>{getGreeting(new Date(now).getHours())}</Text>{isClerkConfigured ? <ClerkDisplayName /> : <Text style={styles.displayName}>Kind human</Text>}</View><Pressable style={styles.profileButton} onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Open profile">{isClerkConfigured ? <ClerkProfileInitial /> : <Text style={styles.profileInitial}>K</Text>}</Pressable></View>

        <HeroCarousel hasRecap={hasPeriodActivity} recapViewed={recapViewed} onRecapViewed={markRecapViewed} />

        <View style={styles.metricsCard}><Metric value={metrics.acts} label="acts completed" accent={COLORS.tangerine} /><Metric value={metrics.affected} label="people affected" accent={COLORS.blue} /><Metric value={metrics.reach} label="nodes growing" accent={COLORS.yellow} /></View>
        <View style={styles.periodCard}><View style={styles.periodHeader}><View><Text style={styles.periodTitle}>Current kindness period</Text><Text style={styles.periodSubtitle}>Ends {formatPeriodEnd(period.end)}</Text></View><Text style={styles.periodRemaining}>{formatTimeLeft(period.end.toISOString(), now)}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${period.progress * 100}%` }]} /></View></View>
        <View style={styles.actionsRow}><ActionButton label="Start a new tree" primary onPress={() => router.push({ pathname: '/explore', params: { mode: 'start' } })} /><ActionButton label="Find a ripple" onPress={() => router.push('/recap')} /></View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Nearby kindness</Text><Text style={styles.sectionSubtitle}>A little good is happening around you</Text></View></View>
        {loading || error || !data ? <View style={styles.stateCard}><LoadState error={error} onRetry={reload} /></View> : <View style={styles.mapCard}><JoinMap pins={data.nearbyPins} me={data.nearbyMe} businesses={data.businesses} onPinPress={() => router.push('/explore')} onMapPress={() => router.push('/explore')} /><View pointerEvents="none" style={styles.mapOverlay}><Text style={styles.mapOverlayTitle}>{openNearby ? `${openNearby} open ${openNearby === 1 ? 'act' : 'acts'}` : 'No open acts nearby'}</Text><Text style={styles.mapOverlayText}>Nearby kindness</Text></View></View>}

        {data?.trees.length ? <View style={styles.section}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>My latest tree</Text><Text style={styles.sectionSubtitle}>Updates as your kindness moves</Text></View><Pressable onPress={() => router.push('/trees')}><Text style={styles.textLink}>Open</Text></Pressable></View>{visibleTrees.map((summary) => <Pressable key={summary.chainId} style={styles.treeCard} onPress={() => router.push('/trees')}><View style={styles.treeIcon}><Text style={styles.treeIconText}>↗</Text></View><View style={styles.treeCopy}><Text style={styles.treeTitle}>The tree you’re growing</Text><Text style={styles.treeDescription}>{formatImpact(summary.tree.nodes.length)} growing through this tree</Text><View style={styles.treeMetaRow}><Text style={styles.statusPill}>{summary.tree.status === 'ENDED' ? 'ENDED' : 'GROWING'}</Text></View></View><Text style={styles.chevron}>›</Text></Pressable>)}</View> : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cream }, content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, eyebrow: { color: COLORS.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, greeting: { color: COLORS.navy, fontSize: 22, fontWeight: '800', marginTop: 5 }, displayName: { color: COLORS.navy, fontSize: 22, fontWeight: '800', marginTop: -2 }, profileButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' }, profileInitial: { color: COLORS.cream, fontSize: 18, fontWeight: '800' },
  heroSlide: { paddingRight: 12 }, heroCard: { flex: 1, height: 108, backgroundColor: COLORS.navy, borderRadius: 18, padding: 14, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' }, recapCardCompact: { backgroundColor: COLORS.blue }, heroCopy: { flex: 1, paddingRight: 8 }, heroKicker: { color: COLORS.yellow, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, heroTitle: { color: COLORS.white, fontSize: 18, lineHeight: 22, fontWeight: '800', marginTop: 6 }, recapHeroKicker: { color: COLORS.navy, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, recapHeroTitle: { color: COLORS.navy, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 6 }, recapHeroText: { color: COLORS.navy, fontSize: 12, lineHeight: 16, marginTop: 8 }, heroOrb: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.tangerine, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] }, heroOrbText: { color: COLORS.cream, fontSize: 28, fontWeight: '300' }, heroArrow: { color: COLORS.navy, fontSize: 30, fontWeight: '300', marginLeft: 8 }, heroDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 7 }, heroDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.line }, heroDotActive: { width: 16, backgroundColor: COLORS.tangerine },
  metricsCard: { backgroundColor: COLORS.white, borderRadius: 20, paddingVertical: 17, paddingHorizontal: 10, marginTop: 12, flexDirection: 'row', justifyContent: 'space-around', borderWidth: 1, borderColor: COLORS.line }, metric: { alignItems: 'center', flex: 1 }, metricDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 7 }, metricValue: { color: COLORS.navy, fontSize: 22, fontWeight: '800' }, metricLabel: { color: COLORS.muted, fontSize: 11, marginTop: 3, textAlign: 'center' },
  periodCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 15, marginTop: 12, borderWidth: 1, borderColor: COLORS.line }, periodHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, periodTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '800' }, periodSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, periodRemaining: { color: COLORS.tangerine, fontSize: 12, fontWeight: '800', marginTop: 1 }, progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#F3E9D3', overflow: 'hidden', marginTop: 13 }, progressFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.tangerine }, periodFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }, periodFooterText: { color: COLORS.muted, fontSize: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 }, actionButton: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, primaryAction: { backgroundColor: COLORS.tangerine }, secondaryAction: { backgroundColor: COLORS.yellow }, actionText: { fontSize: 14, fontWeight: '800' }, primaryActionText: { color: COLORS.white }, secondaryActionText: { color: COLORS.navy },
  section: { marginTop: 25 }, sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 25, marginBottom: 11 }, sectionTitle: { color: COLORS.navy, fontSize: 19, fontWeight: '800' }, sectionSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, stateCard: { height: 220, backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden' }, mapCard: { height: 280, backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line }, mapOverlay: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, mapOverlayTitle: { color: COLORS.navy, fontSize: 13, fontWeight: '800' }, mapOverlayText: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, mapCaption: { backgroundColor: COLORS.white, paddingHorizontal: 15, paddingVertical: 10, alignItems: 'flex-start' }, mapCaptionTitle: { color: COLORS.navy, fontSize: 13, fontWeight: '800' }, mapCaptionText: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, textLink: { color: COLORS.tangerine, fontSize: 12, fontWeight: '800' },
  treeCard: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 15, flexDirection: 'row', alignItems: 'center' }, treeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' }, treeIconText: { color: COLORS.navy, fontSize: 25, fontWeight: '800' }, treeCopy: { flex: 1, marginLeft: 12 }, treeTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '800' }, treeDescription: { color: COLORS.muted, fontSize: 12, marginTop: 4 }, treeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }, statusPill: { color: COLORS.navy, backgroundColor: COLORS.yellow, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900' }, chevron: { color: COLORS.navy, fontSize: 28, fontWeight: '300', marginLeft: 8 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.white, borderRadius: 20, marginTop: 22, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.line }, navItem: { alignItems: 'center', minWidth: 55 }, navIcon: { color: COLORS.navy, fontSize: 19, lineHeight: 22 }, navActive: { color: COLORS.tangerine, fontSize: 10, fontWeight: '800', marginTop: 3 }, navText: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
});

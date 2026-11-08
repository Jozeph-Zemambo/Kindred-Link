import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth0 } from 'react-native-auth0';

import { getChain, listMine, listNearby } from '@/api/client';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { BottomNav } from '@/components/BottomNav';
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

function formatPeriodLabel(date: Date) {
  const weekOfMonth = Math.ceil(date.getDate() / 7);
  const month = date.toLocaleDateString(undefined, { month: 'long' });
  return `${date.getFullYear()} · ${month} · Week ${weekOfMonth}`;
}

function Metric({ value, label, accent }: { value: string | number; label: string; accent: string }) {
  return <View style={styles.metric}><View style={[styles.metricDot, { backgroundColor: accent }]} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function ActionButton({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.actionButton, primary ? styles.primaryAction : styles.secondaryAction]}><Text style={[styles.actionText, primary ? styles.primaryActionText : styles.secondaryActionText]}>{label}</Text></Pressable>;
}

type TreeSummary = {
  chainId: number;
  tree: ChainTree;
  latest: NodePin;
  contributionCount: number;
};

export default function HomeScreen() {
  const { user } = useAuth0();
  const { data, error, loading, reload } = useLoad(async () => {
    const [mine, nearbyMe] = await Promise.all([listMine(), getMyLocation()]);
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
    };
  }, [user?.sub]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  const metrics = useMemo(() => {
    if (!data) return { acts: 0, trees: 0, reach: 0 };
    return { acts: data.mine.length, trees: new Set(data.mine.map((node) => node.chainId)).size, reach: data.allNodes?.length ?? data.nodes.length };
  }, [data]);
  const visibleTrees = data?.trees.slice(0, 1) ?? [];
  // Same pins the join map draws, so the count matches the dots.
  const openNearby = data?.nearbyPins.filter(isFindable).length ?? 0;
  const period = useMemo(() => getPeriodWindow(now), [now]);
  const hasPeriodActivity = Boolean(data?.mine.some((node) => {
    const createdAt = Date.parse(node.createdAt);
    return createdAt >= period.start.getTime() && createdAt < period.end.getTime();
  }));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View><Text style={styles.eyebrow}>YOUR KINDNESS, IN MOTION</Text><Text style={styles.greeting}>Hello, kind human</Text></View><Pressable style={styles.profileButton} onPress={() => router.push('/settings')}><Text style={styles.profileInitial}>K</Text></Pressable></View>

        <View style={styles.heroCard}><View style={styles.heroCopy}><Text style={styles.heroKicker}>YOUR RIPPLE EFFECT</Text><Text style={styles.heroTitle}>Small acts can travel far.</Text><Text style={styles.heroBody}>Keep your kindness moving and watch it grow into something bigger.</Text></View><View style={styles.heroOrb}><Text style={styles.heroOrbText}>✦</Text></View></View>

        <View style={styles.metricsCard}><Metric value={metrics.acts} label="acts completed" accent={COLORS.tangerine} /><Metric value={metrics.trees} label="trees joined" accent={COLORS.blue} /><Metric value={metrics.reach} label="nodes growing" accent={COLORS.yellow} /></View>
        <View style={styles.periodCard}><View style={styles.periodHeader}><View><Text style={styles.periodTitle}>Current kindness period</Text><Text style={styles.periodSubtitle}>{formatPeriodLabel(period.start)}</Text></View><Text style={styles.periodRemaining}>{formatTimeLeft(period.end.toISOString(), now)}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${period.progress * 100}%` }]} /></View><View style={styles.periodFooter}><Text style={styles.periodFooterText}>{Math.round(period.progress * 100)}% elapsed</Text><Text style={styles.periodFooterText}>Ends {formatPeriodEnd(period.end)}</Text></View></View>
        <View style={styles.actionsRow}><ActionButton label="Start a new tree" primary onPress={() => router.push({ pathname: '/explore', params: { mode: 'start' } })} /><ActionButton label="Find a ripple" onPress={() => router.push('/recap')} /></View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Nearby kindness</Text><Text style={styles.sectionSubtitle}>A little good is happening around you</Text></View><Text style={styles.mapLegend}>● live map</Text></View>
<<<<<<<<< Temporary merge branch 1
        {loading || error || !data ? <View style={styles.stateCard}><LoadState error={error} onRetry={reload} /></View> : <Pressable style={styles.mapCard} onPress={() => router.push('/explore')} accessibilityRole="button" accessibilityLabel="Explore nearby kindness"><JoinMap pins={data.nearbyPins} me={data.nearbyMe} onPinPress={() => router.push('/explore')} /><View style={styles.mapOverlay}><Text style={styles.mapOverlayTitle}>{data.nearbyPins.length ? formatImpact(data.nearbyPins.length) : 'No acts nearby'}</Text><Text style={styles.mapOverlayText}>Nearby kindness</Text></View><View style={styles.mapCaption}><Text style={styles.mapCaptionTitle}>Explore nearby kindness</Text><Text style={styles.mapCaptionText}>Tap the map to see more</Text></View></Pressable>}
=========
        {!user ? <View style={styles.signInCard}><Text style={styles.stateMessage}>Sign in to see your kindness history and keep your progress across devices.</Text><ActionButton label="Log in or create account" primary onPress={() => router.push('/settings')} /></View> : loading || error || !data ? <View style={styles.stateCard}><LoadState error={error} onRetry={reload} /></View> : !data.latest ? <View style={styles.stateCard}><LoadState empty="No acts yet. Start one and it will grow here." /></View> : <Pressable style={styles.mapCard} onPress={() => router.push('/explore')} accessibilityRole="button" accessibilityLabel="Explore nearby kindness"><ChainMap nodes={data.nodes} focusId={data.latest.id} businesses={data.businesses} onNodePress={(id) => router.push({ pathname: '/chain/[id]', params: { id: String(id) } })} /><View style={styles.mapOverlay}><Text style={styles.mapOverlayTitle}>{formatImpact(data.nodes.length)}</Text><Text style={styles.mapOverlayText}>Your ripple</Text></View><View style={styles.mapCaption}><Text style={styles.mapCaptionTitle}>Your latest ripple</Text><Text style={styles.mapCaptionText}>Tap to explore nearby kindness</Text></View></Pressable>}
>>>>>>>>> Temporary merge branch 2

        {data?.trees.length ? <View style={styles.section}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>My latest tree</Text><Text style={styles.sectionSubtitle}>Updates as your kindness moves</Text></View><Pressable onPress={() => router.push('/trees')}><Text style={styles.textLink}>Open</Text></Pressable></View>{visibleTrees.map((summary) => <Pressable key={summary.chainId} style={styles.treeCard} onPress={() => router.push('/trees')}><View style={styles.treeIcon}><Text style={styles.treeIconText}>↗</Text></View><View style={styles.treeCopy}><Text style={styles.treeTitle}>The tree you’re growing</Text><Text style={styles.treeDescription}>{formatImpact(summary.tree.nodes.length)} growing through this tree</Text><View style={styles.treeMetaRow}><Text style={styles.statusPill}>{summary.tree.status === 'ENDED' ? 'ENDED' : 'GROWING'}</Text><Text style={styles.treeTime}>{formatTimeLeft(summary.latest.closesAt, now)}</Text></View></View><Text style={styles.chevron}>›</Text></Pressable>)}</View> : null}

        {hasPeriodActivity && <Pressable style={styles.recapCard} onPress={() => router.push('/recap')}><View style={styles.recapBadge}><Text style={styles.recapBadgeText}>WEEKLY</Text></View><View style={styles.recapCopy}><Text style={styles.recapTitle}>Your kindness recap</Text><Text style={styles.recapText}>See the ripples you helped create this period.</Text></View><Text style={styles.chevron}>›</Text></Pressable>}
      </ScrollView>
      <BottomNav active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cream }, content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, eyebrow: { color: COLORS.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, greeting: { color: COLORS.navy, fontSize: 28, fontWeight: '800', marginTop: 4 }, profileButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' }, profileInitial: { color: COLORS.cream, fontSize: 18, fontWeight: '800' },
  heroCard: { backgroundColor: COLORS.navy, borderRadius: 24, minHeight: 170, padding: 22, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' }, heroCopy: { flex: 1, paddingRight: 10 }, heroKicker: { color: COLORS.yellow, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, heroTitle: { color: COLORS.white, fontSize: 25, lineHeight: 30, fontWeight: '800', marginTop: 10 }, heroBody: { color: '#DCE4F1', fontSize: 13, lineHeight: 19, marginTop: 9 }, heroOrb: { width: 92, height: 92, borderRadius: 46, backgroundColor: COLORS.tangerine, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] }, heroOrbText: { color: COLORS.cream, fontSize: 48, fontWeight: '300' },
  metricsCard: { backgroundColor: COLORS.white, borderRadius: 20, paddingVertical: 17, paddingHorizontal: 10, marginTop: 12, flexDirection: 'row', justifyContent: 'space-around', borderWidth: 1, borderColor: COLORS.line }, metric: { alignItems: 'center', flex: 1 }, metricDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 7 }, metricValue: { color: COLORS.navy, fontSize: 22, fontWeight: '800' }, metricLabel: { color: COLORS.muted, fontSize: 11, marginTop: 3, textAlign: 'center' },
  periodCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 15, marginTop: 12, borderWidth: 1, borderColor: COLORS.line }, periodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, periodTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '800' }, periodSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, periodRemaining: { color: COLORS.tangerine, fontSize: 12, fontWeight: '800' }, progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#F3E9D3', overflow: 'hidden', marginTop: 13 }, progressFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.tangerine }, periodFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }, periodFooterText: { color: COLORS.muted, fontSize: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 }, actionButton: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, primaryAction: { backgroundColor: COLORS.tangerine }, secondaryAction: { backgroundColor: COLORS.yellow }, actionText: { fontSize: 14, fontWeight: '800' }, primaryActionText: { color: COLORS.white }, secondaryActionText: { color: COLORS.navy },
  section: { marginTop: 25 }, sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 25, marginBottom: 11 }, sectionTitle: { color: COLORS.navy, fontSize: 19, fontWeight: '800' }, sectionSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, mapLegend: { color: COLORS.tangerine, fontSize: 11, fontWeight: '700' }, stateCard: { height: 220, backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden' }, signInCard: { height: 220, backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 18 }, stateMessage: { color: COLORS.muted, textAlign: 'center', lineHeight: 20 }, mapCard: { height: 280, backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line }, mapOverlay: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, mapOverlayTitle: { color: COLORS.navy, fontSize: 13, fontWeight: '800' }, mapOverlayText: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, mapCaption: { backgroundColor: COLORS.white, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, mapCaptionTitle: { color: COLORS.navy, fontSize: 13, fontWeight: '800' }, mapCaptionText: { color: COLORS.muted, fontSize: 11 }, textLink: { color: COLORS.tangerine, fontSize: 12, fontWeight: '800' },
  treeCard: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 15, flexDirection: 'row', alignItems: 'center' }, treeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' }, treeIconText: { color: COLORS.navy, fontSize: 25, fontWeight: '800' }, treeCopy: { flex: 1, marginLeft: 12 }, treeTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '800' }, treeDescription: { color: COLORS.muted, fontSize: 12, marginTop: 4 }, treeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }, statusPill: { color: COLORS.navy, backgroundColor: COLORS.yellow, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900' }, treeTime: { color: COLORS.tangerine, fontSize: 11, fontWeight: '700' }, chevron: { color: COLORS.navy, fontSize: 28, fontWeight: '300', marginLeft: 8 },
  recapCard: { backgroundColor: COLORS.blue, borderRadius: 20, padding: 16, marginTop: 18, flexDirection: 'row', alignItems: 'center' }, recapBadge: { backgroundColor: COLORS.cream, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 10 }, recapBadgeText: { color: COLORS.navy, fontSize: 10, fontWeight: '900' }, recapCopy: { flex: 1, marginLeft: 12 }, recapTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '800' }, recapText: { color: COLORS.navy, opacity: 0.75, fontSize: 12, lineHeight: 17, marginTop: 3 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.white, borderRadius: 20, marginTop: 22, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.line }, navItem: { alignItems: 'center', minWidth: 55 }, navIcon: { color: COLORS.navy, fontSize: 19, lineHeight: 22 }, navActive: { color: COLORS.tangerine, fontSize: 10, fontWeight: '800', marginTop: 3 }, navText: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
});

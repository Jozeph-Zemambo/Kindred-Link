import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { claimNode, continueNode, createNode, getNode, listBusinesses, listNearby, uploadPhoto } from '@/api/client';
import type { NodePin } from '@/api/types';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';
import { getMyLocation, JoinMap, LocationPicker, requireMyLocation } from '@/map';

const ACTIVE_CLAIM_KEY = '@kindred-link/active-claim';
type ActiveClaim = { nodeId: number; finishBy: string };

function getPeriodWindow(now: number) {
  const end = new Date(now);
  const day = end.getDay();
  end.setDate(end.getDate() + (day === 0 ? 1 : 8 - day));
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return { start, end, progress: Math.min(1, Math.max(0, (now - start.getTime()) / (end.getTime() - start.getTime()))) };
}

function formatTimeLeft(timestamp: string, now: number) {
  const difference = Math.max(0, Date.parse(timestamp) - now);
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  return difference === 0 ? 'Period ended' : `${hours}h ${minutes}m left`;
}

/**
 * Nearby-tree exploration screen.
 *
 * Backend handoff: getMyLocation() supplies the user position and
 * listNearby(lat, lng, radius) supplies the nearby end-act markers. Both have
 * development fallbacks today. JoinMap owns marker rendering/filtering; this
 * screen owns the overlay and navigation after a marker is selected.
 */
export default function ExploreScreen() {
  const { mode, nodeId: nodeIdParam } = useLocalSearchParams<{ mode?: string; nodeId?: string }>();
  const routeLogMode = mode === 'log';
  const routeStartMode = mode === 'start';
  const routeNodeId = Number(nodeIdParam);
  const [storedClaim, setStoredClaim] = useState<ActiveClaim | null>(null);
  const [claimLoaded, setClaimLoaded] = useState(false);
  const [description, setDescription] = useState('');
  const [locationMode, setLocationMode] = useState<'current' | 'map'>('current');
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const period = getPeriodWindow(now);
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_CLAIM_KEY).then((value) => {
      if (!value) return;
      const parsed = JSON.parse(value) as ActiveClaim;
      if (parsed.nodeId > 0 && Date.parse(parsed.finishBy) > Date.now()) setStoredClaim(parsed);
      else AsyncStorage.removeItem(ACTIVE_CLAIM_KEY);
    }).catch(() => undefined).finally(() => setClaimLoaded(true));
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const activeClaim = storedClaim && Date.parse(storedClaim.finishBy) > now ? storedClaim : null;
  const logMode = routeLogMode || Boolean(activeClaim);
  const startMode = routeStartMode && !logMode;
  const claimedNodeId = Number.isFinite(routeNodeId) && routeNodeId > 0
    ? routeNodeId
    : activeClaim?.nodeId ?? NaN;
  const { data, error, loading, reload } = useLoad(async () => {
    if (!claimLoaded) return null;
    if (logMode && Number.isFinite(claimedNodeId) && claimedNodeId > 0) {
      const [claimed, me] = await Promise.all([getNode(claimedNodeId), getMyLocation()]);
      return { mode: 'log' as const, claimed, me };
    }
    if (startMode) {
      return { mode: 'start' as const, me: await getMyLocation() };
    }
    const me = await getMyLocation();
    const [pins, businesses] = await Promise.all([
      listNearby(me.lat, me.lng),
      listBusinesses().catch(() => []),
    ]);
    return { mode: 'explore' as const, me, pins, businesses };
  }, [claimLoaded, logMode, startMode, claimedNodeId]);
  useEffect(() => {
    // Both a new tree and a continuation can choose a pin location. Claiming still
    // Claiming is independent of the location used for the eventual contribution.
    if ((data?.mode === 'start' || data?.mode === 'log') && !mapLocation) setMapLocation(data.me);
  }, [data, mapLocation]);
  async function submitKindness() {
    if (!description.trim() || !data || (data.mode !== 'log' && data.mode !== 'start')) return;
    setSubmitting(true);
    try {
      const location = locationMode === 'current'
        ? await requireMyLocation()
        : mapLocation;
      if (!location) return;
      const uploadedPhoto = photoUri ? await uploadPhoto(photoUri) : null;
      if (data.mode === 'log') {
        await continueNode(claimedNodeId, { description: description.trim(), lat: location.lat, lng: location.lng, photoId: uploadedPhoto?.id ?? null });
        await AsyncStorage.removeItem(ACTIVE_CLAIM_KEY);
        setStoredClaim(null);
        Alert.alert('Kindness logged', 'Your act has been added to the tree.', [{ text: 'View my tree', onPress: () => router.replace({ pathname: '/trees', params: { nodeId: String(claimedNodeId) } }) }]);
      } else {
        const created = await createNode({ description: description.trim(), lat: location.lat, lng: location.lng, photoId: uploadedPhoto?.id ?? null });
        Alert.alert('Tree started', 'Your first act is now the beginning of a new tree.', [{ text: 'View my tree', onPress: () => router.replace({ pathname: '/trees', params: { nodeId: String(created.id) } }) }]);
      }
    } catch (submitError) {
      Alert.alert('Could not log kindness', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function addPhoto(source: 'camera' | 'library') {
    setPhotoBusy(true);
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? null);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleClaim(pin: NodePin) {
    setClaiming(true);
    try {
      // Claiming must happen from within the map's visible radius. The later
      // kindness submission is intentionally not distance-restricted.
      const location = await requireMyLocation();
      const result = await claimNode(pin.id, { lat: location.lat, lng: location.lng });
      const nextClaim = { nodeId: pin.id, finishBy: result.finishBy };
      await AsyncStorage.setItem(ACTIVE_CLAIM_KEY, JSON.stringify(nextClaim));
      setStoredClaim(nextClaim);
      router.replace({ pathname: '/explore', params: { mode: 'log', nodeId: String(pin.id) } });
    } catch (claimError) {
      Alert.alert('Could not claim this node', claimError instanceof Error ? claimError.message : 'Please try again.');
    } finally {
      setClaiming(false);
    }
  }

  function cancelNewTree() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EXPLORE KINDNESS</Text>
          <Text style={styles.title}>{logMode ? 'Log your kindness' : startMode ? 'Start a new tree' : 'Find a tree to grow'}</Text>
          <Text style={styles.subtitle}>{logMode ? 'Capture what you did and where it happened.' : startMode ? 'Begin a new ripple with a kind act of your own.' : 'Find a nearby act to continue. See My tree for your current tree and status.'}</Text>
        </View>
      </View>

      <View style={styles.periodCard}><View><Text style={styles.periodTitle}>Current kindness period</Text><Text style={styles.periodSubtitle}>Ends {period.end.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text></View><Text style={styles.periodRemaining}>{formatTimeLeft(period.end.toISOString(), now)}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${period.progress * 100}%` }]} /></View></View>

      {(logMode && data?.mode === 'log') || (startMode && data?.mode === 'start') ? (
        <ScrollView style={styles.logContent} contentContainerStyle={styles.logContentInner} keyboardShouldPersistTaps="handled">
          {data.mode === 'log' ? <View style={styles.claimedCard}><Text style={styles.claimedEyebrow}>CONTINUING FROM</Text><Text style={styles.claimedText}>{data.claimed.description || 'Your claimed kindness node'}</Text><Text style={styles.claimedHint}>Complete within {activeClaim ? formatTimeLeft(activeClaim.finishBy, now) : '12 hours'} to keep your claim active.</Text></View> : <View style={styles.startCard}><Text style={styles.claimedEyebrow}>A NEW RIPPLE</Text><Text style={styles.claimedText}>Your kindness can start somewhere new.</Text><Text style={styles.claimedHint}>This act will become the root of a new tree.</Text></View>}
          <Text style={styles.fieldLabel}>What did you do?</Text><TextInput value={description} onChangeText={setDescription} placeholder="Share the kind deed" placeholderTextColor="#9AA0B1" multiline style={[styles.input, styles.descriptionInput]} />
          <Text style={styles.fieldLabel}>Add a photo <Text style={styles.optionalText}>optional</Text></Text><View style={styles.photoActions}><Pressable onPress={() => addPhoto('camera')} disabled={photoBusy} style={styles.photoButton}><Text style={styles.photoButtonText}>Take photo</Text></Pressable><Pressable onPress={() => addPhoto('library')} disabled={photoBusy} style={styles.photoButton}><Text style={styles.photoButtonText}>Choose image</Text></Pressable></View>{photoUri && <View style={styles.photoPreviewWrap}><Image source={{ uri: photoUri }} style={styles.photoPreview} /><Pressable onPress={() => setPhotoUri(null)} style={styles.removePhoto}><Text style={styles.removePhotoText}>Remove</Text></Pressable></View>}
          <Text style={styles.fieldLabel}>Where did it happen?</Text><View style={styles.locationToggle}><Pressable onPress={() => setLocationMode('current')} style={[styles.locationOption, locationMode === 'current' && styles.locationSelected]}><Text style={[styles.locationText, locationMode === 'current' && styles.locationSelectedText]}>Use current location</Text></Pressable><Pressable onPress={() => setLocationMode('map')} style={[styles.locationOption, locationMode === 'map' && styles.locationSelected]}><Text style={[styles.locationText, locationMode === 'map' && styles.locationSelectedText]}>Choose on map</Text></Pressable></View>
          {locationMode === 'current' ? <Text style={styles.locationHint}>Your current location will be used when you submit.</Text> : <View style={styles.pickerMap}><LocationPicker value={mapLocation ?? data.me} onChange={setMapLocation} /><View style={styles.mapPickerHint}><Text style={styles.mapPickerHintText}>Move the map to where it happened</Text></View></View>}
          <Pressable onPress={submitKindness} disabled={submitting || !description.trim()} style={[styles.submitButton, (submitting || !description.trim()) && styles.submitDisabled]}><Text style={styles.submitText}>{submitting ? 'Saving…' : startMode ? 'Start tree' : 'Log kindness'}</Text></Pressable>
          {startMode && <Pressable onPress={cancelNewTree} disabled={submitting} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>}
        </ScrollView>
      ) : loading || !claimLoaded || error || !data ? (
        <LoadState error={error} onRetry={reload} />
      ) : data.mode === 'explore' ? (
        <View style={styles.mapCard}>
          <JoinMap pins={data.pins} me={data.me} businesses={data.businesses} onJoin={handleClaim} />
          <View style={styles.mapOverlay}><Text style={styles.mapOverlayTitle}>Choose a kindness marker</Text><Text style={styles.mapOverlayText}>Tap a marker to view this tree’s act</Text></View>
          {claiming && <View style={styles.claimingOverlay}><Text style={styles.claimingText}>Claiming node…</Text></View>}
        </View>
      ) : <LoadState empty="This kindness node is no longer available." />}
      {!logMode && !startMode && data?.mode === 'explore' && <Pressable style={styles.newTreeButton} onPress={() => router.replace({ pathname: '/explore', params: { mode: 'start' } })}><Text style={styles.newTreeButtonText}>Start a new tree instead</Text></Pressable>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9E9', padding: 20, paddingBottom: 96 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { color: '#F49A68', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#303A59', fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#6C748A', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 290 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#303A59', fontSize: 26, lineHeight: 28 },
  periodCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E9DEC4', padding: 13, marginBottom: 12 },
  periodTitle: { color: '#303A59', fontSize: 12, fontWeight: '800' },
  periodSubtitle: { color: '#6C748A', fontSize: 10, marginTop: 3 },
  periodRemaining: { position: 'absolute', top: 14, right: 13, color: '#F49A68', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#F2EAD8', overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', backgroundColor: '#F49A68', borderRadius: 3 },
  mapCard: { flex: 1, minHeight: 360, overflow: 'hidden', borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9DEC4' },
  mapOverlay: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  mapOverlayTitle: { color: '#303A59', fontSize: 13, fontWeight: '800' },
  mapOverlayText: { color: '#6C748A', fontSize: 10, marginTop: 2 },
  claimingOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', backgroundColor: 'rgba(48,58,89,0.9)', paddingVertical: 12 },
  claimingText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  logContent: { flex: 1 },
  logContentInner: { paddingBottom: 12 },
  claimedCard: { backgroundColor: '#80B9E5', borderRadius: 20, padding: 17, marginBottom: 18 },
  startCard: { backgroundColor: '#FFD36D', borderRadius: 20, padding: 17, marginBottom: 18 },
  claimedEyebrow: { color: '#303A59', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  claimedText: { color: '#303A59', fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 8 },
  claimedHint: { color: '#303A59', opacity: 0.7, fontSize: 12, marginTop: 8 },
  fieldLabel: { color: '#303A59', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9DEC4', borderRadius: 14, color: '#303A59', paddingHorizontal: 13, paddingVertical: 11, fontSize: 14 },
  descriptionInput: { minHeight: 100, textAlignVertical: 'top', marginBottom: 18 },
  optionalText: { color: '#6C748A', fontSize: 11, fontWeight: '500' },
  photoActions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  photoButton: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9DEC4', borderRadius: 13, paddingVertical: 11 },
  photoButtonText: { color: '#303A59', fontSize: 11, fontWeight: '800' },
  photoPreviewWrap: { height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 18, backgroundColor: '#E7EEF2' },
  photoPreview: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', right: 9, bottom: 9, backgroundColor: 'rgba(48,58,89,0.9)', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  removePhotoText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  locationToggle: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9DEC4', borderRadius: 14, padding: 4, marginBottom: 8 },
  locationOption: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 10 },
  locationSelected: { backgroundColor: '#303A59' },
  locationText: { color: '#6C748A', fontSize: 11, fontWeight: '800' },
  locationSelectedText: { color: '#FFFFFF' },
  locationHint: { color: '#6C748A', fontSize: 11, marginBottom: 18 },
  pickerMap: { height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 18, backgroundColor: '#E7EEF2' },
  mapPickerHint: { position: 'absolute', left: 10, right: 10, bottom: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, paddingVertical: 7 },
  mapPickerHintText: { color: '#303A59', fontSize: 11, fontWeight: '800' },
  submitButton: { alignItems: 'center', backgroundColor: '#F49A68', borderRadius: 15, paddingVertical: 14, marginTop: 4 },
  submitDisabled: { opacity: 0.45 },
  cancelButton: { alignItems: 'center', paddingVertical: 13, marginTop: 2 },
  cancelText: { color: '#6C748A', fontSize: 13, fontWeight: '800' },
  submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  newTreeButton: { alignItems: 'center', backgroundColor: '#FFD36D', borderRadius: 15, paddingVertical: 13, marginTop: 12 },
  newTreeButtonText: { color: '#303A59', fontSize: 12, fontWeight: '900' },
});

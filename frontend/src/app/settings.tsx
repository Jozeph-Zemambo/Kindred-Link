import { useMemo } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listMine } from '@/api/client';
import { API_URL, USE_MOCKS } from '@/api/config';
import { getDeviceId, resetDeviceId } from '@/api/deviceId';
import { useLoad } from '@/api/useLoad';
import { LoadState } from '@/components/LoadState';

const COLORS = { cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', tangerine: '#F49A68', navy: '#303A59', white: '#FFFFFF', muted: '#6C748A', line: '#E9DEC4' };

function NativeAuthControls() {
  const { account, accountLoading, activeConnection, error, isLoading, login, logout, user } = useAuth0Account();

  if (isLoading) return <ActivityIndicator />;

  return (
    <View style={styles.authControls}>
      {user ? (
        <>
          <Text style={styles.authMessage}>Signed in as {user.name || user.email || user.sub}</Text>
          {accountLoading ? <ActivityIndicator /> : account ? (
            <Text style={styles.authMessage}>Backend account #{account.id} · {account.email}</Text>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.signInButton} onPress={() => void logout()}>
            <Text style={styles.signInText}>Log out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.authMessage}>Sign in to connect your profile to Kindred Link.</Text>
          <Pressable
            accessibilityRole="button"
            disabled={activeConnection !== null}
            style={[styles.signInButton, activeConnection !== null && styles.disabled]}
            onPress={() => void login('google-oauth2')}
          >
            <Text style={styles.signInText}>{activeConnection === 'google-oauth2' ? 'Connecting…' : 'Continue with Google'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={activeConnection !== null}
            style={[styles.signInButton, activeConnection !== null && styles.disabled]}
            onPress={() => void login('github')}
          >
            <Text style={styles.signInText}>{activeConnection === 'github' ? 'Connecting…' : 'Continue with GitHub'}</Text>
          </Pressable>
        </>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [deviceId, mine] = await Promise.all([getDeviceId(), listMine()]);
    return { deviceId, mine };
  });

  const trees = useMemo(() => new Set(data?.mine.map((node) => node.chainId) ?? []).size, [data]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
        <Text style={styles.title}>Profile</Text>

        {loading || error || !data ? <LoadState error={error} onRetry={reload} /> : <>
          <View style={styles.profileCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>K</Text></View>
            <View style={styles.identity}><Text style={styles.name}>Kind human</Text><Text style={styles.email}>Profile and impact</Text><Text style={styles.authStatus}>KINDRED LINK</Text></View>
          </View>

          <View style={styles.statsCard}><Text style={styles.sectionTitle}>Your impact</Text><View style={styles.statsRow}><View style={styles.stat}><Text style={styles.statValue}>{data.mine.length}</Text><Text style={styles.statLabel}>acts completed</Text></View><View style={styles.stat}><Text style={styles.statValue}>{trees}</Text><Text style={styles.statLabel}>trees joined</Text></View></View></View>

          <Text style={styles.sectionHeading}>Account</Text>
          <View style={styles.menuCard}>
            <Pressable style={styles.menuRow} onPress={() => Alert.alert('Notifications', 'Notification preferences will be connected here.')}><View><Text style={styles.menuTitle}>Notifications</Text><Text style={styles.menuSubtitle}>Period reminders and kindness updates</Text></View><Text style={styles.chevron}>›</Text></Pressable>
            <Pressable style={styles.menuRow} onPress={() => Alert.alert('Privacy', 'Privacy controls will be connected here.')}><View><Text style={styles.menuTitle}>Privacy</Text><Text style={styles.menuSubtitle}>Location and profile visibility</Text></View><Text style={styles.chevron}>›</Text></Pressable>
            <Pressable style={styles.menuRow} onPress={() => Alert.alert('Help', 'Help and support content will be added here.')}><View><Text style={styles.menuTitle}>Help and support</Text><Text style={styles.menuSubtitle}>Questions about Kindred Link</Text></View><Text style={styles.chevron}>›</Text></Pressable>
          </View>

          {Platform.OS === 'web' ? (
            <Text style={styles.authMessage}>Sign in with Google or GitHub using the Kindred Link mobile app.</Text>
          ) : <NativeAuthControls />}
          <Pressable style={styles.resetButton} onPress={() => resetDeviceId().then(reload)}><Text style={styles.resetText}>Reset anonymous device</Text></Pressable>
          <Text style={styles.debug}>Anonymous id: {data.deviceId}{'\n'}API: {USE_MOCKS ? 'mock data' : API_URL}</Text>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream }, content: { padding: 20, paddingBottom: 110 }, eyebrow: { color: COLORS.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: COLORS.navy, fontSize: 30, fontWeight: '800', marginTop: 5, marginBottom: 18 }, profileCard: { backgroundColor: COLORS.navy, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.tangerine, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: COLORS.white, fontSize: 24, fontWeight: '900' }, identity: { flex: 1, marginLeft: 13 }, name: { color: COLORS.white, fontSize: 17, fontWeight: '800' }, email: { color: '#DCE4F1', fontSize: 11, marginTop: 4 }, authStatus: { color: COLORS.yellow, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 }, editButton: { backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 }, editButtonText: { color: COLORS.navy, fontSize: 11, fontWeight: '800' }, statsCard: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginTop: 14 }, sectionTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '800' }, statsRow: { flexDirection: 'row', marginTop: 14, gap: 36 }, stat: { alignItems: 'center' }, statValue: { color: COLORS.navy, fontSize: 24, fontWeight: '900' }, statLabel: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, sectionHeading: { color: COLORS.navy, fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 9 }, menuCard: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' }, menuRow: { minHeight: 65, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.line }, menuTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '800' }, menuSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, chevron: { color: COLORS.navy, fontSize: 28, fontWeight: '300' }, authControls: { gap: 8, marginTop: 8 }, authMessage: { color: COLORS.muted, fontSize: 12, lineHeight: 18 }, error: { color: '#B42318', fontSize: 12 }, disabled: { opacity: 0.6 }, signInButton: { backgroundColor: COLORS.tangerine, borderRadius: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, signInText: { color: COLORS.white, fontSize: 14, fontWeight: '800' }, resetButton: { alignItems: 'center', paddingVertical: 14 }, resetText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' }, debug: { color: COLORS.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 8 },
});

import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';

import { listMine } from '@/api/client';
import { API_URL, USE_MOCKS } from '@/api/config';
import { getDeviceId, resetDeviceId } from '@/api/deviceId';
import { useLoad } from '@/api/useLoad';
import { isClerkConfigured } from '@/auth/clerk';
import { LoadState } from '@/components/LoadState';

const COLORS = { cream: '#FFF9E9', yellow: '#FFD36D', blue: '#80B9E5', tangerine: '#F49A68', navy: '#303A59', white: '#FFFFFF', muted: '#6C748A', line: '#E9DEC4' };

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
          {isClerkConfigured ? <ClerkProfile /> : <AnonymousProfile />}

          <View style={styles.statsCard}><Text style={styles.sectionTitle}>Your impact</Text><View style={styles.statsRow}><View style={styles.stat}><Text style={styles.statValue}>{data.mine.length}</Text><Text style={styles.statLabel}>acts completed</Text></View><View style={styles.stat}><Text style={styles.statValue}>{trees}</Text><Text style={styles.statLabel}>trees joined</Text></View></View></View>

          <Text style={styles.sectionHeading}>Account</Text>
          <View style={styles.menuCard}>
            <Pressable style={styles.menuRow} onPress={() => Alert.alert('Notifications', 'Notification preferences will be connected here.')}><View><Text style={styles.menuTitle}>Notifications</Text><Text style={styles.menuSubtitle}>Period reminders and kindness updates</Text></View><Text style={styles.chevron}>›</Text></Pressable>
            <Pressable style={styles.menuRow} onPress={() => Alert.alert('Privacy', 'Privacy controls will be connected here.')}><View><Text style={styles.menuTitle}>Privacy</Text><Text style={styles.menuSubtitle}>Location and profile visibility</Text></View><Text style={styles.chevron}>›</Text></Pressable>
            <Pressable style={styles.menuRow} onPress={() => Alert.alert('Help', 'Help and support content will be added here.')}><View><Text style={styles.menuTitle}>Help and support</Text><Text style={styles.menuSubtitle}>Questions about Kindred Link</Text></View><Text style={styles.chevron}>›</Text></Pressable>
          </View>

          {!isClerkConfigured && <Pressable style={styles.signInButton} onPress={() => Alert.alert('Clerk is not configured', 'Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to frontend/.env.local, then restart Expo.')}>
            <Text style={styles.signInText}>Set up Google sign-in</Text>
          </Pressable>}
          {!isClerkConfigured && <Pressable style={styles.resetButton} onPress={() => resetDeviceId().then(reload)}><Text style={styles.resetText}>Reset anonymous device</Text></Pressable>}
          <Text style={styles.debug}>Identity: {isClerkConfigured ? 'Clerk account or anonymous' : 'anonymous'}{'\n'}API: {USE_MOCKS ? 'mock data' : API_URL}</Text>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function ClerkProfile() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const { startHostedAuth } = useHostedAuth();

  const signIn = async () => {
    try {
      await startHostedAuth();
    } catch (error) {
      Alert.alert('Sign-in failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const logOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Sign-out failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const name = user?.fullName ?? user?.username ?? 'Kind human';
  const email = user?.primaryEmailAddress?.emailAddress ?? 'No email address';
  const initial = name.slice(0, 1).toUpperCase();

  return <>
    <View style={styles.profileCard}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
      <View style={styles.identity}>
        <Text style={styles.name}>{isLoaded && isSignedIn ? name : 'Kind human'}</Text>
        <Text style={styles.email}>{isLoaded && isSignedIn ? email : 'Sign in to connect your account'}</Text>
        <Text style={styles.authStatus}>{!isLoaded ? 'LOADING' : isSignedIn ? 'CLERK ACCOUNT' : 'ANONYMOUS'}</Text>
      </View>
    </View>
    {isLoaded && (isSignedIn
      ? <Pressable style={styles.resetButton} onPress={logOut}><Text style={styles.resetText}>Sign out</Text></Pressable>
      : <Pressable style={styles.signInButton} onPress={signIn}><Text style={styles.signInText}>Sign in with Google</Text></Pressable>)}
  </>;
}

function AnonymousProfile() {
  return <View style={styles.profileCard}>
    <View style={styles.avatar}><Text style={styles.avatarText}>K</Text></View>
    <View style={styles.identity}>
      <Text style={styles.name}>Kind human</Text>
      <Text style={styles.email}>Sign in to connect your account</Text>
      <Text style={styles.authStatus}>ANONYMOUS</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream }, content: { padding: 20, paddingBottom: 110 }, eyebrow: { color: COLORS.tangerine, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: COLORS.navy, fontSize: 30, fontWeight: '800', marginTop: 5, marginBottom: 18 }, profileCard: { backgroundColor: COLORS.navy, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.tangerine, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: COLORS.white, fontSize: 24, fontWeight: '900' }, identity: { flex: 1, marginLeft: 13 }, name: { color: COLORS.white, fontSize: 17, fontWeight: '800' }, email: { color: '#DCE4F1', fontSize: 11, marginTop: 4 }, authStatus: { color: COLORS.yellow, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 }, statsCard: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginTop: 14 }, sectionTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '800' }, statsRow: { flexDirection: 'row', marginTop: 14, gap: 36 }, stat: { flex: 1 }, statValue: { color: COLORS.navy, fontSize: 24, fontWeight: '900' }, statLabel: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, sectionHeading: { color: COLORS.navy, fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 9 }, menuCard: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' }, menuRow: { minHeight: 65, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.line }, menuTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '800' }, menuSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, chevron: { color: COLORS.navy, fontSize: 28, fontWeight: '300' }, signInButton: { backgroundColor: COLORS.tangerine, borderRadius: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, signInText: { color: COLORS.white, fontSize: 14, fontWeight: '800' }, resetButton: { alignItems: 'center', paddingVertical: 14 }, resetText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' }, debug: { color: COLORS.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 8 },
});

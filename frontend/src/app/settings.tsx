import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth0 } from 'react-native-auth0';

import { AUTH0_AUDIENCE, AUTH0_SCHEME, AUTH0_SCOPE } from '@/api/authConfig';
import { API_URL, USE_MOCKS } from '@/api/config';

/** Auth0 hosts password forms and social sign-in. No passwords are collected in the app. */
export default function SettingsScreen() {
  const { user, isLoading, authorize, clearSession } = useAuth0();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const login = async (connection?: 'google-oauth2' | 'facebook', signup = false) => {
    setBusy(true);
    setMessage('');
    try {
      await authorize(
        {
          audience: AUTH0_AUDIENCE,
          scope: AUTH0_SCOPE,
          ...(connection ? { connection } : {}),
          ...(signup ? { screen_hint: 'signup' } : {}),
        },
        { customScheme: AUTH0_SCHEME },
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setMessage('');
    try {
      await clearSession({}, { customScheme: AUTH0_SCHEME });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not sign out');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.title}>Kindred-Link account</Text>
      {isLoading ? <ActivityIndicator /> : user ? (
        <View style={styles.section}>
          <Text style={styles.description}>Signed in as</Text>
          <Text style={styles.account}>{user.name || user.email || 'Kindred-Link member'}</Text>
          <Text style={styles.description}>Your kindness history stays linked to this Auth0 account.</Text>
          <Pressable disabled={busy} style={styles.button} onPress={logout}>
            <Text style={styles.buttonText}>Log out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.description}>Sign in to create kindness nodes, reserve slots, upload photos and keep your progress across devices.</Text>
          <Pressable disabled={busy} style={styles.button} onPress={() => login()}>
            <Text style={styles.buttonText}>Log in with email or password</Text>
          </Pressable>
          <Pressable disabled={busy} style={styles.button} onPress={() => login(undefined, true)}>
            <Text style={styles.buttonText}>Create an account</Text>
          </Pressable>
          <Pressable disabled={busy} style={styles.button} onPress={() => login('google-oauth2')}>
            <Text style={styles.buttonText}>Continue with Google</Text>
          </Pressable>
          <Pressable disabled={busy} style={styles.button} onPress={() => login('facebook')}>
            <Text style={styles.buttonText}>Continue with Facebook</Text>
          </Pressable>
        </View>
      )}
      {busy ? <ActivityIndicator /> : null}
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <Text style={styles.debug}>API: {USE_MOCKS ? 'mock data' : API_URL}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 14 },
  title: { fontWeight: '800', fontSize: 23 },
  section: { gap: 12 },
  description: { color: '#475569', fontSize: 14, lineHeight: 21 },
  account: { fontSize: 17, fontWeight: '700' },
  button: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, backgroundColor: '#183153', alignItems: 'center' },
  buttonText: { fontWeight: '700', color: '#fff' },
  error: { color: '#b91c1c' },
  debug: { marginTop: 'auto', color: '#6b7280', fontSize: 12 },
});

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth0 } from 'react-native-auth0';

const auth0Audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE!;
const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
const customScheme = 'kindredlink';

type Account = {
  id: number;
  email: string;
  createdAt: string;
};

type SocialConnection = 'google-oauth2' | 'github';

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected authentication error occurred.';
}

function WebNotice() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Kindred Link</Text>
      <Text style={styles.body}>Google and GitHub sign-in is currently available in the iOS and Android apps.</Text>
    </SafeAreaView>
  );
}

function NativeLoginScreen() {
  const { authorize, clearSession, getCredentials, isLoading, user } = useAuth0();
  const [activeConnection, setActiveConnection] = useState<SocialConnection | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!user) {
      return;
    }

    async function loadAccount() {
      setAccountLoading(true);
      setErrorMessage(null);
      try {
        const credentials = await getCredentials('openid profile email', 0, {
          audience: auth0Audience,
        });
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/auth/me`, {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Account request failed (${response.status}).`);
        }
        const currentAccount = (await response.json()) as Account;
        if (active) setAccount(currentAccount);
      } catch (error) {
        if (active) setErrorMessage(messageFrom(error));
      } finally {
        if (active) setAccountLoading(false);
      }
    }

    void loadAccount();
    return () => {
      active = false;
    };
  }, [getCredentials, user]);

  async function login(connection: SocialConnection) {
    setActiveConnection(connection);
    setAccount(null);
    setErrorMessage(null);
    try {
      await authorize(
        {
          audience: auth0Audience,
          scope: 'openid profile email',
          connection,
        },
        { customScheme },
      );
    } catch (error) {
      setErrorMessage(messageFrom(error));
    } finally {
      setActiveConnection(null);
    }
  }

  async function logout() {
    setErrorMessage(null);
    try {
      await clearSession({}, { customScheme });
      setAccount(null);
    } catch (error) {
      setErrorMessage(messageFrom(error));
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Kindred Link</Text>
        {user ? (
          <>
            <Text style={styles.body}>Signed in as {user.name || user.email || user.sub}</Text>
            {accountLoading ? (
              <ActivityIndicator />
            ) : account ? (
              <Text style={styles.body}>Account #{account.id} · {account.email}</Text>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.button}>
              <Text style={styles.buttonText}>Log out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>Sign in to continue with Google or GitHub.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={activeConnection !== null}
              onPress={() => void login('google-oauth2')}
              style={[styles.button, activeConnection !== null && styles.disabledButton]}
            >
              <Text style={styles.buttonText}>
                {activeConnection === 'google-oauth2' ? 'Connecting…' : 'Continue with Google'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={activeConnection !== null}
              onPress={() => void login('github')}
              style={[styles.button, activeConnection !== null && styles.disabledButton]}
            >
              <Text style={styles.buttonText}>
                {activeConnection === 'github' ? 'Connecting…' : 'Continue with GitHub'}
              </Text>
            </Pressable>
          </>
        )}
        {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

export default function HomeScreen() {
  return Platform.OS === 'web' ? <WebNotice /> : <NativeLoginScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f7f8fa',
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: 16,
  },
  title: {
    color: '#18202a',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: '#394654',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#18202a',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#b42318',
    fontSize: 14,
    textAlign: 'center',
  },
});

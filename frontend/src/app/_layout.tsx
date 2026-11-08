import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { Auth0Provider, useAuth0 } from 'react-native-auth0';

import {
  AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_CONFIGURED, AUTH0_DOMAIN, AUTH0_SCOPE,
} from '@/api/authConfig';
import { setAccessTokenProvider } from '@/api/authToken';

function AppStack() {
  const colorScheme = useColorScheme();
  const { getCredentials, isLoading, user } = useAuth0();
  const [bridgeReady, setBridgeReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setAccessTokenProvider(user ? async () => {
      // On web, passing audience again ensures a JWT for our API, not an opaque token.
      const result = await getCredentials(AUTH0_SCOPE, 0, { audience: AUTH0_AUDIENCE });
      return result.accessToken;
    } : null);
    setBridgeReady(true);
    return () => setAccessTokenProvider(null);
  }, [getCredentials, isLoading, user]);

  if (isLoading || !bridgeReady) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="chain/[id]" />
        <Stack.Screen name="recap" />
        <Stack.Screen name="settings" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  if (!AUTH0_CONFIGURED) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: 20 }}>Auth0 setup required</Text>
        <Text>Copy frontend/.env.example to frontend/.env.local and set your Auth0 domain, client ID and API audience. Then rebuild the app.</Text>
      </View>
    );
  }
  return (
    <Auth0Provider domain={AUTH0_DOMAIN} clientId={AUTH0_CLIENT_ID}>
      <AppStack />
    </Auth0Provider>
  );
}

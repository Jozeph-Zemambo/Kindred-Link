import { Stack } from 'expo-router';
import { Auth0Provider } from 'react-native-auth0';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AppRoutes() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <AppRoutes />
      </SafeAreaProvider>
    );
  }

  return (
    <Auth0Provider
      domain={process.env.EXPO_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!}
      useDPoP={false}
    >
      <SafeAreaProvider>
        <AppRoutes />
      </SafeAreaProvider>
    </Auth0Provider>
  );
}

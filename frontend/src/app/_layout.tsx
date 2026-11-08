import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useColorScheme, Platform, View } from 'react-native';
import { Auth0Provider } from 'react-native-auth0';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomNav, type BottomNavTab } from '@/components/BottomNav';

function AppLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const active: BottomNavTab = pathname === '/explore'
    ? 'explore'
    : pathname === '/trees' || pathname.startsWith('/chain/')
      ? 'trees'
      : pathname === '/settings'
        ? 'profile'
        : pathname === '/recap'
          ? 'recap'
          : 'home';
  const showNav = pathname === '/' || pathname === '/explore' || pathname === '/trees' || pathname.startsWith('/chain/') || pathname === '/settings' || pathname === '/recap';

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={({ route }) => {
              const back = (route.params as { navDir?: string } | undefined)?.navDir === 'back';
              return { headerShown: false, animation: back ? 'slide_from_left' : 'slide_from_right', animationTypeForReplace: back ? 'pop' : 'push' };
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="chain/[id]" />
            <Stack.Screen name="recap" />
            <Stack.Screen name="settings" />
          </Stack>
          {showNav && <BottomNav active={active} />}
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const app = <AppLayout />;
  if (Platform.OS === 'web') return app;

  return (
    <Auth0Provider
      domain={process.env.EXPO_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!}
      useDPoP={false}
    >
      {app}
    </Auth0Provider>
  );
}

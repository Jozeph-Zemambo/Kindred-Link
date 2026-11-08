import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useColorScheme, View } from 'react-native';

import { BottomNav, type BottomNavTab } from '@/components/BottomNav';

export default function RootLayout() {
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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={({ route }) => {
            // Bottom-nav taps pass navDir: tabs to the right slide in from the right, tabs to the left from the left.
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
  );
}

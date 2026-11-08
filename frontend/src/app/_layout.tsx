import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { Auth0Provider } from 'react-native-auth0';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AppLayout() {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={({ route }) => {
            const back = (route.params as { navDir?: string } | undefined)?.navDir === 'back';
            return {
              headerShown: false,
              animation: back ? 'slide_from_left' : 'slide_from_right',
              animationTypeForReplace: back ? 'pop' : 'push',
            };
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="chain/[id]" />
          <Stack.Screen name="recap" />
          <Stack.Screen name="settings" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  if (Platform.OS === 'web') {
    return <AppLayout />;
  }

  return (
    <Auth0Provider
      domain={process.env.EXPO_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!}
      useDPoP={false}
    >
      <AppLayout />
    </Auth0Provider>
  );
}

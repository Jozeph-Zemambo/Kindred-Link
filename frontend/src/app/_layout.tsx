import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
    </ThemeProvider>
  );
}

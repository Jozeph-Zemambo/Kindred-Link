import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/map/theme';

// Slim retry notice for when the business catalog fails. The kindness map underneath still
// works, so this must stay small and never block map gestures (box-none wrapper).
export function BusinessMapStatus({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  if (!error) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.message}
        onPress={(event) => { event.stopPropagation(); onRetry(); }}
        accessibilityRole="button"
        accessibilityLabel="Retry loading businesses"
      >
        <Text style={styles.text}>Businesses unavailable. Tap to retry.</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
  message: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, paddingVertical: 7 },
  text: { color: palette.navy, fontSize: 11, fontWeight: '800' },
});

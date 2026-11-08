import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

/** Full-screen spinner / error / empty message while a screen's data loads. */
export function LoadState({ error, empty, onRetry }: { error?: Error | null; empty?: string; onRetry?: () => void }) {
  return (
    <View style={styles.box}>
      {error ? (
        <>
          <Text style={styles.text}>Couldn't load: {error.message}</Text>
          {onRetry && (
            <Pressable onPress={onRetry} style={styles.button}>
              <Text>Try again</Text>
            </Pressable>
          )}
        </>
      ) : empty ? (
        <Text style={styles.text}>{empty}</Text>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { textAlign: 'center' },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});

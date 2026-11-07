import { StyleSheet, Text, View } from 'react-native';

import type { ChainMapProps } from './ChainMap';

// react-native-maps has no web support; this stand-in keeps `expo start --web` from crashing.
export function ChainMap({ nodes, style }: ChainMapProps) {
  return (
    <View style={[styles.box, style]}>
      <Text>Map is phone-only ({nodes.length} nodes). Open the app in Expo Go.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

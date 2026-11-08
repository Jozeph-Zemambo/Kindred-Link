import { StyleSheet, Text, View } from 'react-native';

import { isFindable } from './findable';
import type { JoinMapProps } from './JoinMap';

// react-native-maps has no web support; this stand-in keeps `expo start --web` from crashing.
export function JoinMap({ pins, style }: JoinMapProps) {
  return (
    <View style={[styles.box, style]}>
      <Text>Map is phone-only ({pins.filter((p) => isFindable(p)).length} open nodes). Open the app in Expo Go.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

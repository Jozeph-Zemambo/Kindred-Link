import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type BottomNavTab = 'home' | 'explore' | 'trees' | 'profile';

export function BottomNav({ active }: { active: BottomNavTab }) {
  const tabs = [
    { key: 'home' as const, icon: '⌂', label: 'Home', path: '/' },
    { key: 'explore' as const, icon: '◌', label: 'Explore', path: '/explore' },
    { key: 'trees' as const, icon: '⌁', label: 'My trees', path: '/trees' },
    { key: 'profile' as const, icon: '○', label: 'Profile', path: '/settings' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => active === tab.key ? (
        <View key={tab.key} style={styles.item}>
          <Text style={styles.icon}>{tab.icon}</Text>
          <Text style={styles.activeLabel}>{tab.label}</Text>
        </View>
      ) : (
        <Pressable key={tab.key} style={styles.item} onPress={() => router.push(tab.path as never)} accessibilityRole="button" accessibilityLabel={tab.label}>
          <Text style={styles.icon}>{tab.icon}</Text>
          <Text style={styles.label}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 20, right: 20, bottom: 12, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, borderWidth: 1, borderColor: '#E9DEC4', zIndex: 10, elevation: 8 },
  item: { alignItems: 'center', minWidth: 55 },
  icon: { color: '#303A59', fontSize: 19, lineHeight: 22 },
  activeLabel: { color: '#F49A68', fontSize: 10, fontWeight: '800', marginTop: 3 },
  label: { color: '#6C748A', fontSize: 10, marginTop: 3 },
});

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type BottomNavTab = 'home' | 'explore' | 'trees' | 'profile' | 'recap';

const NAVY = '#303A59';
const TANGERINE = '#F49A68';

const TABS = [
  { key: 'home' as const, label: 'Home', path: '/' },
  { key: 'explore' as const, label: 'Explore', path: '/explore' },
  { key: 'trees' as const, label: 'My tree', path: '/trees' },
  { key: 'profile' as const, label: 'Profile', path: '/settings' },
];

// Icons are drawn from plain Views (no icon font), 22pt boxes with 2pt strokes.

function HomeIcon({ color }: { color: string }) {
  return (
    <View style={icon.box}>
      <View style={[icon.roof, { borderColor: color }]} />
      <View style={[icon.house, { borderColor: color }]} />
    </View>
  );
}

function ExploreIcon({ color }: { color: string }) {
  return (
    <View style={icon.box}>
      <View style={[icon.compass, { borderColor: color }]}>
        <View style={[icon.needle, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Three connected nodes, like a chain on the map. */
function TreeIcon({ color }: { color: string }) {
  return (
    <View style={icon.box}>
      <View style={[icon.branch, { backgroundColor: color, left: 6.5, transform: [{ rotate: '26.6deg' }] }]} />
      <View style={[icon.branch, { backgroundColor: color, left: 13.5, transform: [{ rotate: '-26.6deg' }] }]} />
      <View style={[icon.node, { backgroundColor: color, left: 8, top: 1 }]} />
      <View style={[icon.node, { backgroundColor: color, left: 1, top: 15 }]} />
      <View style={[icon.node, { backgroundColor: color, left: 15, top: 15 }]} />
    </View>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <View style={icon.box}>
      <View style={[icon.head, { borderColor: color }]} />
      <View style={[icon.shoulders, { borderColor: color }]} />
    </View>
  );
}

const ICONS = { home: HomeIcon, explore: ExploreIcon, trees: TreeIcon, profile: ProfileIcon };

export function BottomNav({ active }: { active: BottomNavTab }) {
  const activeIndex = TABS.findIndex((t) => t.key === active);

  return (
    <View style={styles.container}>
      {TABS.map((tab, index) => {
        const Icon = ICONS[tab.key];
        return active === tab.key ? (
          <View key={tab.key} style={styles.item}>
            <Icon color={TANGERINE} />
            <Text style={styles.activeLabel}>{tab.label}</Text>
          </View>
        ) : (
          <Pressable
            key={tab.key}
            style={styles.item}
            // Replace, not push: tabs don't pile up history. navDir tells the layout which side to slide from.
            onPress={() => router.replace({ pathname: tab.path as never, params: { navDir: index > activeIndex ? 'forward' : 'back' } })}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <Icon color={NAVY} />
            <Text style={styles.label}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 20, right: 20, bottom: 12, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, borderWidth: 1, borderColor: '#E9DEC4', zIndex: 10, elevation: 8 },
  item: { alignItems: 'center', minWidth: 55 },
  activeLabel: { color: TANGERINE, fontSize: 10, fontWeight: '800', marginTop: 4 },
  label: { color: '#6C748A', fontSize: 10, marginTop: 4 },
});

const icon = StyleSheet.create({
  box: { width: 22, height: 22 },
  roof: { position: 'absolute', left: 4, top: 3, width: 14, height: 14, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 2, transform: [{ rotate: '45deg' }] },
  house: { position: 'absolute', left: 5, top: 10, width: 12, height: 11, borderWidth: 2, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  compass: { position: 'absolute', left: 1, top: 1, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  needle: { width: 4, height: 11, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  branch: { position: 'absolute', top: 3.2, width: 2, height: 15.6, borderRadius: 1 },
  node: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  head: { position: 'absolute', left: 7, top: 1, width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
  shoulders: { position: 'absolute', left: 3, top: 12, width: 16, height: 9, borderWidth: 2, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
});

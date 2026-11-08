import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { logoSource } from './BusinessBubble';
import type { BusinessPin } from './ChainMap';
import { SidePanel } from './SidePanel';
import { OUTLINE, palette } from './theme';

// Tapping a business bubble: slides in from the right with its logo, roughly how many people
// have joined in there, and how much has been paid forward (or acts, if no dollar figure yet).

/** Rough "N+" so counts read as a size, not an exact figure: 3, 15+, 350+, 2,400+. */
export function roundedPlus(n: number): string {
  if (n < 5) return String(n);
  const step = n < 100 ? 5 : n < 1000 ? 50 : 100;
  return `${(Math.floor(n / step) * step).toLocaleString('en-CA')}+`;
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-CA')}`;
}

export function BusinessSheet({ business, onClose }: { business: BusinessPin | null; onClose: () => void }) {
  const source = business ? logoSource(business.name, business.logoUrl) : undefined;
  return (
    <SidePanel
      visible={business !== null}
      kicker="SMALL BUSINESS"
      onClose={onClose}
      footer={(close) => (
        <Pressable style={styles.button} onPress={close}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      )}
    >
      {business && (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              {source ? (
                <Image source={source} style={styles.logo} contentFit="cover" />
              ) : (
                <Text style={styles.initial}>{business.name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.name}>{business.name}</Text>
          </View>

          <View style={styles.stats}>
            {business.visitors !== undefined && (
              <View style={[styles.stat, { backgroundColor: palette.blue }]}>
                <Text style={styles.statValue}>{business.demoTotals ? business.visitors.toLocaleString('en-CA') : roundedPlus(business.visitors)}</Text>
                <Text style={styles.statLabel}>people joined in here</Text>
              </View>
            )}
            {business.paidForwardCents !== undefined && !business.demoTotals ? (
              <View style={[styles.stat, { backgroundColor: palette.yellow }]}>
                <Text style={styles.statValue}>{dollars(business.paidForwardCents)}</Text>
                <Text style={styles.statLabel}>paid forward</Text>
              </View>
            ) : (
              business.kindnessActs !== undefined && (
                <View style={[styles.stat, { backgroundColor: palette.yellow }]}>
                  <Text style={styles.statValue}>{business.demoTotals ? business.kindnessActs.toLocaleString('en-CA') : roundedPlus(business.kindnessActs)}</Text>
                  <Text style={styles.statLabel}>acts of kindness</Text>
                </View>
              )
            )}
          </View>

          <Text style={styles.note}>
            Every act paid forward here supports a local small business, and keeps a chain going for the next person.
          </Text>
        </ScrollView>
      )}
    </SidePanel>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: 16, gap: 16 },
  hero: { alignItems: 'center', gap: 12 },
  logoRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: palette.cream,
    borderWidth: 3,
    borderColor: OUTLINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 104, height: 104, borderRadius: 52 },
  initial: { color: palette.navy, fontSize: 44, fontWeight: '800' },
  name: { color: palette.navy, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: OUTLINE },
  statValue: { color: palette.navy, fontSize: 24, fontWeight: '800' },
  statLabel: { color: palette.navy, fontSize: 12, fontWeight: '700', marginTop: 2 },
  note: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  button: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.navy },
  buttonText: { color: palette.cream, fontSize: 15, fontWeight: '800' },
});

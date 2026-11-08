import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError, checkin } from '@/api/client';
import { requireMyLocation } from '@/map/location';
import type { CheckinResult } from '@/api/types';

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

function tokenFromBusinessQr(data: string, businessId: number): string {
  const parsed = Linking.parse(data);
  if (parsed.scheme !== 'kindredlink' || parsed.hostname !== 'checkin') {
    throw new Error('This is not a Kindred Link business check-in QR code.');
  }
  const qrBusinessId = parsed.queryParams?.business;
  const token = parsed.queryParams?.token;
  if (qrBusinessId !== String(businessId)) {
    throw new Error('This QR code belongs to a different business.');
  }
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('The business QR code does not contain a valid check-in token.');
  }
  return token;
}

export function BusinessSheet({ business, onClose }: { business: BusinessPin | null; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const handledScan = useRef(false);
  const source = business ? logoSource(business.name, business.logoUrl) : undefined;

  useEffect(() => {
    setScanning(false);
    setCheckinError(null);
    setCheckinResult(null);
    handledScan.current = false;
  }, [business?.id]);

  async function startScan() {
    setCheckinError(null);
    setCheckinResult(null);
    handledScan.current = false;
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          setCheckinError('Allow camera access to scan the business QR code.');
          return;
        }
      }
      setScanning(true);
    } catch (error) {
      setCheckinError(error instanceof Error ? error.message : 'Could not access the camera.');
    }
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (!business || handledScan.current || checkinBusy) return;
    handledScan.current = true;
    setCheckinBusy(true);
    setCheckinError(null);
    try {
      const token = tokenFromBusinessQr(data, business.id);
      const location = await requireMyLocation();
      const result = await checkin(business.id, { token, lat: location.lat, lng: location.lng });
      setCheckinResult(result);
      setScanning(false);
    } catch (error) {
      setCheckinError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Check-in failed.');
      handledScan.current = false;
    } finally {
      setCheckinBusy(false);
    }
  }

  return (
    <SidePanel
      visible={business !== null}
      kicker="SMALL BUSINESS"
      onClose={onClose}
      footer={(close) => (
        <>
          {Platform.OS !== 'web' && (
            <Pressable style={[styles.button, styles.checkinButton]} disabled={checkinBusy} onPress={() => scanning ? setScanning(false) : void startScan()}>
              <Text style={styles.buttonText}>{scanning ? 'Cancel scan' : checkinBusy ? 'Checking in…' : 'Scan QR to check in'}</Text>
            </Pressable>
          )}
          <Pressable style={styles.button} onPress={close}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </>
      )}
    >
      {business && (
        <ScrollView contentContainerStyle={styles.body}>
          {scanning ? (
            <View style={styles.scanner}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={checkinBusy ? undefined : handleBarcodeScanned}
              />
              {checkinBusy && <View style={styles.scannerMessage}><Text style={styles.scannerMessageText}>Verifying check-in…</Text></View>}
            </View>
          ) : null}
          {Platform.OS === 'web' && <Text style={styles.note}>Business check-in is available in the mobile app.</Text>}
          {checkinError ? <Text accessibilityRole="alert" style={styles.error}>{checkinError}</Text> : null}
          {checkinResult ? (
            <Text accessibilityRole="status" style={styles.success}>
              Checked in at {checkinResult.business.name}. {checkinResult.business.visitors} people have joined in here.
            </Text>
          ) : null}
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
                <Text style={styles.statValue}>{roundedPlus(business.visitors)}</Text>
                <Text style={styles.statLabel}>people joined in here</Text>
              </View>
            )}
            {business.paidForwardCents !== undefined ? (
              <View style={[styles.stat, { backgroundColor: palette.yellow }]}>
                <Text style={styles.statValue}>{dollars(business.paidForwardCents)}</Text>
                <Text style={styles.statLabel}>paid forward</Text>
              </View>
            ) : (
              business.kindnessActs !== undefined && (
                <View style={[styles.stat, { backgroundColor: palette.yellow }]}>
                  <Text style={styles.statValue}>{roundedPlus(business.kindnessActs)}</Text>
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
  scanner: { width: '100%', height: 240, overflow: 'hidden', borderRadius: 16, backgroundColor: '#111827' },
  scannerMessage: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  scannerMessageText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  error: { color: '#B42318', fontSize: 13 },
  success: { color: '#067647', fontSize: 13, fontWeight: '700' },
  button: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.navy },
  checkinButton: { backgroundColor: palette.tangerine },
  buttonText: { color: palette.cream, fontSize: 15, fontWeight: '800' },
});

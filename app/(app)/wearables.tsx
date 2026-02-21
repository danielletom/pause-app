import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import BackButton from '@/components/BackButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { useHealthData } from '@/lib/useHealthData';

/* ─── Device list ──────────────────────────────────────── */
interface Device {
  key: string;
  icon: string;
  name: string;
  status: 'connected' | 'available' | 'coming_soon';
}

const DEVICES: Device[] = [
  { key: 'apple_watch', icon: '⌚', name: 'Apple Watch', status: 'connected' },
  { key: 'oura', icon: '💍', name: 'Oura Ring', status: 'available' },
  { key: 'fitbit', icon: '📟', name: 'Fitbit', status: 'coming_soon' },
];

/* ─── Enrichment cards ─────────────────────────────────── */
const ENRICHMENTS = [
  { icon: '🎯', title: 'Readiness score', desc: 'Now uses HRV and resting heart rate' },
  { icon: '😴', title: 'Sleep card', desc: 'Shows sleep stages from your watch' },
  { icon: '📈', title: 'Pattern detection', desc: 'Correlates heart rate with symptoms' },
  { icon: '🔥', title: 'Hot flash prediction', desc: 'Uses overnight temperature data' },
];

export default function WearablesScreen() {
  const health = useHealthData();

  const formatLastSynced = () => {
    if (!health.lastSynced) return 'Just now';
    const mins = Math.round((Date.now() - health.lastSynced.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.nav}>
        <BackButton />
        <Text style={styles.navTitle}>Wearable devices</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Devices */}
        <Text style={styles.sectionLabel}>Your devices</Text>
        <View style={styles.deviceList}>
          {DEVICES.map((device) => {
            const isConnected = health.connected && health.source === device.key;
            const isComingSoon = device.status === 'coming_soon';

            return (
              <View key={device.key} style={styles.deviceCard}>
                <Text style={styles.deviceIcon}>{device.icon}</Text>
                <View style={styles.deviceContent}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  {isConnected && (
                    <Text style={styles.deviceSynced}>
                      Last synced: {formatLastSynced()}
                    </Text>
                  )}
                  {isComingSoon && (
                    <Text style={styles.deviceComingSoon}>Coming soon</Text>
                  )}
                </View>
                {isConnected ? (
                  <View style={styles.statusRow}>
                    <View style={styles.connectedBadge}>
                      <View style={styles.connectedDot} />
                      <Text style={styles.connectedText}>Connected</Text>
                    </View>
                    <AnimatedPressable
                      onPress={() => { hapticLight(); health.disconnect(); }}
                      scaleDown={0.95}
                      style={styles.disconnectButton}
                    >
                      <Text style={styles.disconnectText}>Disconnect</Text>
                    </AnimatedPressable>
                  </View>
                ) : isComingSoon ? (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText}>Soon</Text>
                  </View>
                ) : (
                  <AnimatedPressable
                    onPress={async () => {
                      hapticMedium();
                      await health.connect(device.key);
                    }}
                    scaleDown={0.95}
                    style={styles.connectButton}
                  >
                    <Text style={styles.connectButtonText}>Connect</Text>
                  </AnimatedPressable>
                )}
              </View>
            );
          })}
        </View>

        {/* Enrichment section — only show if connected */}
        {health.connected && (
          <>
            <Text style={styles.sectionLabel}>What your watch data unlocked</Text>
            <View style={styles.enrichGrid}>
              {ENRICHMENTS.map((e) => (
                <View key={e.title} style={styles.enrichCard}>
                  <Text style={styles.enrichIcon}>{e.icon}</Text>
                  <Text style={styles.enrichTitle}>{e.title}</Text>
                  <Text style={styles.enrichDesc}>{e.desc}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Privacy note */}
        <View style={styles.privacyCard}>
          <Text style={styles.privacyText}>
            Your health data stays on your device. We read from Apple Health to improve your insights but never write or share your data.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scroll: { paddingBottom: 40 },

  /* Nav */
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
  },
  navSpacer: { width: 50 },

  /* Section label */
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 10,
  },

  /* Device cards */
  deviceList: {
    gap: 8,
    marginHorizontal: 24,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  deviceIcon: { fontSize: 24 },
  deviceContent: { flex: 1 },
  deviceName: { fontSize: 15, fontWeight: '600', color: '#1c1917' },
  deviceSynced: { fontSize: 12, color: '#78716c', marginTop: 2 },
  deviceComingSoon: { fontSize: 12, color: '#a8a29e', marginTop: 2 },

  /* Status badges */
  statusRow: {
    alignItems: 'flex-end',
    gap: 6,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#059669',
  },
  disconnectButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  disconnectText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ef4444',
  },
  connectButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1c1917',
  },
  connectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  comingSoonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f4',
  },
  comingSoonBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#a8a29e',
  },

  /* Enrichment grid */
  enrichGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 24,
  },
  enrichCard: {
    width: '47%' as any,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  enrichIcon: { fontSize: 20, marginBottom: 8 },
  enrichTitle: { fontSize: 13, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  enrichDesc: { fontSize: 12, color: '#78716c', lineHeight: 16 },

  /* Privacy card */
  privacyCard: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  privacyText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
    textAlign: 'center',
  },
});

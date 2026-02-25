import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import BackButton from '@/components/BackButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { useHealthData } from '@/lib/useHealthData';
import { useSleepTracking } from '@/lib/useSleepTracking';

/* ─── Enrichment cards ─────────────────────────────────── */
const ENRICHMENTS = [
  { icon: '😴', title: 'Auto sleep tracking', desc: 'Sleep detected from phone stillness overnight' },
  { icon: '🎯', title: 'Readiness score', desc: 'Now uses HRV and resting heart rate' },
  { icon: '📈', title: 'Pattern detection', desc: 'Correlates heart rate with symptoms' },
  { icon: '🔥', title: 'Hot flash prediction', desc: 'Uses overnight temperature data' },
];

export default function WearablesScreen() {
  const health = useHealthData();
  const { sleep } = useSleepTracking();

  const formatLastSynced = () => {
    if (!health.lastSynced) return 'Just now';
    const mins = Math.round((Date.now() - health.lastSynced.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  };

  const formatSleepTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.nav}>
        <BackButton />
        <Text style={styles.navTitle}>Health data</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Apple Health connection */}
        <Text style={styles.sectionLabel}>Data source</Text>
        <View style={styles.deviceCard}>
          <Text style={styles.deviceIcon}>❤️</Text>
          <View style={styles.deviceContent}>
            <Text style={styles.deviceName}>Apple Health</Text>
            {health.connected && (
              <Text style={styles.deviceSynced}>
                Last synced: {formatLastSynced()}
              </Text>
            )}
            {!health.available && (
              <Text style={styles.deviceComingSoon}>
                {Platform.OS !== 'ios' ? 'iOS only' : 'Not available'}
              </Text>
            )}
          </View>
          {health.connected ? (
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
          ) : health.available ? (
            <AnimatedPressable
              onPress={async () => {
                hapticMedium();
                await health.connect('apple_health');
              }}
              scaleDown={0.95}
              style={styles.connectButton}
            >
              <Text style={styles.connectButtonText}>Connect</Text>
            </AnimatedPressable>
          ) : (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonBadgeText}>N/A</Text>
            </View>
          )}
        </View>

        {/* Live sleep data — show if connected and sleep detected */}
        {health.connected && sleep && (
          <>
            <Text style={styles.sectionLabel}>Last night's sleep</Text>
            <View style={styles.sleepCard}>
              <View style={styles.sleepMain}>
                <Text style={styles.sleepHours}>{sleep.hours}h</Text>
                <Text style={styles.sleepLabel}>detected</Text>
              </View>
              <View style={styles.sleepTimes}>
                <View style={styles.sleepTimeRow}>
                  <Text style={styles.sleepTimeIcon}>🌙</Text>
                  <Text style={styles.sleepTimeText}>
                    Asleep ~{formatSleepTime(sleep.sleepStart)}
                  </Text>
                </View>
                <View style={styles.sleepTimeRow}>
                  <Text style={styles.sleepTimeIcon}>☀️</Text>
                  <Text style={styles.sleepTimeText}>
                    Awake ~{formatSleepTime(sleep.sleepEnd)}
                  </Text>
                </View>
              </View>
              <Text style={styles.sleepNote}>
                Based on phone activity gaps — adjust in your morning check-in if needed.
              </Text>
            </View>
          </>
        )}

        {/* Live health data — show if connected */}
        {health.connected && (health.data.steps || health.data.hrv || health.data.rhr) && (
          <>
            <Text style={styles.sectionLabel}>Today's data</Text>
            <View style={styles.dataGrid}>
              {health.data.steps != null && (
                <View style={styles.dataCard}>
                  <Text style={styles.dataIcon}>🚶</Text>
                  <Text style={styles.dataValue}>{health.data.steps.toLocaleString()}</Text>
                  <Text style={styles.dataLabel}>Steps</Text>
                </View>
              )}
              {health.data.hrv != null && (
                <View style={styles.dataCard}>
                  <Text style={styles.dataIcon}>📊</Text>
                  <Text style={styles.dataValue}>{health.data.hrv}ms</Text>
                  <Text style={styles.dataLabel}>HRV</Text>
                </View>
              )}
              {health.data.rhr != null && (
                <View style={styles.dataCard}>
                  <Text style={styles.dataIcon}>❤️</Text>
                  <Text style={styles.dataValue}>{health.data.rhr}</Text>
                  <Text style={styles.dataLabel}>Resting HR</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Enrichment section — only show if connected */}
        {health.connected && (
          <>
            <Text style={styles.sectionLabel}>What your health data unlocks</Text>
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

  /* Device card */
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
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

  /* Sleep card */
  sleepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  sleepMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  sleepHours: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1c1917',
  },
  sleepLabel: {
    fontSize: 14,
    color: '#78716c',
  },
  sleepTimes: {
    gap: 6,
    marginBottom: 10,
  },
  sleepTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sleepTimeIcon: { fontSize: 14 },
  sleepTimeText: {
    fontSize: 13,
    color: '#57534e',
  },
  sleepNote: {
    fontSize: 11,
    color: '#a8a29e',
    lineHeight: 16,
    marginTop: 4,
  },

  /* Data grid */
  dataGrid: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 24,
  },
  dataCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  dataIcon: { fontSize: 18, marginBottom: 6 },
  dataValue: { fontSize: 18, fontWeight: '700', color: '#1c1917' },
  dataLabel: { fontSize: 11, color: '#78716c', marginTop: 2 },

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

import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import ProgressBar from '@/components/onboarding/ProgressBar';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useOnboarding } from '@/lib/onboarding-context';
import { useHealthData } from '@/lib/useHealthData';

/* ─── Data types we request from Apple Health ──────────── */
const DATA_TYPES = [
  { icon: '🚶', label: 'Steps & activity', desc: 'Used to detect your sleep window' },
  { icon: '🌙', label: 'Sleep', desc: 'Auto-tracked from phone stillness' },
  { icon: '❤️', label: 'Heart rate', desc: 'Resting and active' },
  { icon: '📊', label: 'HRV', desc: 'Heart rate variability' },
];

/* ─── Before / after enrichment examples ───────────────── */
const ENRICHMENTS = [
  { before: 'You manually enter sleep hours', after: 'Sleep auto-detected from phone activity' },
  { before: 'Readiness score from logs only', after: 'Readiness score with HRV and resting heart rate' },
  { before: 'Symptom patterns from check-ins', after: 'Symptoms correlated with heart rate changes' },
  { before: 'Hot flash tracking by hand', after: 'Predicted flashes using overnight temperature' },
];

type ScreenState = 'initial' | 'syncing' | 'connected' | 'unavailable';

export default function HealthConnectScreen() {
  const router = useRouter();
  const { updateData } = useOnboarding();
  const health = useHealthData();
  const [state, setState] = useState<ScreenState>(
    health.available ? 'initial' : 'unavailable'
  );

  const handleConnect = async () => {
    hapticMedium();
    setState('syncing');
    try {
      await health.connect('apple_health');
      if (health.connected) {
        setState('connected');
        updateData({ healthConnect: { connected: true, source: 'apple_health' } });
      } else {
        // User may have denied — treat as connected anyway since
        // iOS doesn't tell us the actual permission result
        setState('connected');
        updateData({ healthConnect: { connected: true, source: 'apple_health' } });
      }
    } catch {
      setState('initial');
    }
  };

  const handleSkip = () => {
    hapticLight();
    updateData({ healthConnect: { connected: false, source: null } });
    router.push('/(onboarding)/done');
  };

  const handleContinue = () => {
    hapticMedium();
    router.push('/(onboarding)/done');
  };

  /* ─── Unavailable (Android / simulator) ────────────── */
  if (state === 'unavailable') {
    return (
      <SafeAreaView style={styles.container}>
        <ProgressBar step={6} total={7} />
        <View style={styles.centerWrap}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📱</Text>
          <Text style={styles.connectedTitle}>Not available</Text>
          <Text style={styles.connectedDesc}>
            {Platform.OS !== 'ios'
              ? 'Auto sleep tracking uses Apple Health and is only available on iOS.'
              : 'Apple Health is not available on this device.'}
          </Text>
        </View>
        <View style={styles.footer}>
          <OnboardingButton onPress={handleContinue}>
            Continue
          </OnboardingButton>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── Syncing state ──────────────────────────────────── */
  if (state === 'syncing') {
    return (
      <SafeAreaView style={styles.container}>
        <ProgressBar step={6} total={7} />
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1c1917" />
          <Text style={styles.syncTitle}>Connecting to Apple Health...</Text>
          <Text style={styles.syncSubtitle}>Requesting access to your activity data</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── Connected state ────────────────────────────────── */
  if (state === 'connected') {
    return (
      <SafeAreaView style={styles.container}>
        <ProgressBar step={6} total={7} />
        <View style={styles.centerWrap}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.connectedTitle}>Connected</Text>
          <Text style={styles.connectedSource}>Apple Health</Text>
          <Text style={styles.connectedDesc}>
            Your sleep will be auto-tracked from phone activity each morning. No need to wear anything or start a session.
          </Text>
        </View>
        <View style={styles.footer}>
          <OnboardingButton onPress={handleContinue}>
            Continue
          </OnboardingButton>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── Initial state ──────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={6} total={7} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Auto-track your sleep</Text>
        <Text style={styles.subheading}>
          Pause reads your phone's activity data to figure out when you fell asleep and woke up — no wearable needed.
        </Text>

        {/* Data types list */}
        <View style={styles.dataTypeList}>
          {DATA_TYPES.map((dt) => (
            <View key={dt.label} style={styles.dataTypeRow}>
              <Text style={styles.dataTypeIcon}>{dt.icon}</Text>
              <View style={styles.dataTypeContent}>
                <Text style={styles.dataTypeLabel}>{dt.label}</Text>
                <Text style={styles.dataTypeDesc}>{dt.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* How it works card */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          <Text style={styles.howStep}>1. Your iPhone tracks steps all day via the motion chip</Text>
          <Text style={styles.howStep}>2. When you sleep, step activity stops</Text>
          <Text style={styles.howStep}>3. Each morning, Pause finds that gap and logs your sleep</Text>
          <Text style={styles.howStep}>4. Your morning check-in is pre-filled automatically</Text>
        </View>

        {/* Why this helps card */}
        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>What this unlocks</Text>
          {ENRICHMENTS.map((e, i) => (
            <View key={i} style={styles.enrichRow}>
              <View style={styles.enrichBefore}>
                <Text style={styles.enrichBeforeText}>{e.before}</Text>
              </View>
              <Text style={styles.enrichArrow}>→</Text>
              <View style={styles.enrichAfter}>
                <Text style={styles.enrichAfterText}>{e.after}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Privacy note */}
        <Text style={styles.privacyNote}>
          Your data stays on your device. We read, never write. You can disconnect anytime in settings.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton onPress={handleConnect}>
          Connect Apple Health
        </OnboardingButton>
        <AnimatedPressable onPress={handleSkip} scaleDown={0.98} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  /* Heading */
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    color: '#78716c',
    marginBottom: 24,
    lineHeight: 20,
  },

  /* Data types */
  dataTypeList: {
    gap: 0,
    marginBottom: 24,
  },
  dataTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
    gap: 12,
  },
  dataTypeIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  dataTypeContent: {
    flex: 1,
  },
  dataTypeLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1917',
  },
  dataTypeDesc: {
    fontSize: 13,
    color: '#78716c',
    marginTop: 1,
  },

  /* How it works card */
  howCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 16,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 10,
  },
  howStep: {
    fontSize: 13,
    color: '#0c4a6e',
    lineHeight: 20,
    marginBottom: 4,
  },

  /* Why this helps card */
  whyCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 16,
  },
  whyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 12,
  },
  enrichRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  enrichBefore: {
    flex: 1,
  },
  enrichBeforeText: {
    fontSize: 12,
    color: '#a8a29e',
    lineHeight: 16,
  },
  enrichArrow: {
    fontSize: 12,
    color: '#d6d3d1',
    marginTop: 1,
  },
  enrichAfter: {
    flex: 1,
  },
  enrichAfterText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
    lineHeight: 16,
  },

  /* Privacy note */
  privacyNote: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Syncing state */
  syncTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1c1917',
    marginTop: 20,
  },
  syncSubtitle: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 4,
  },

  /* Connected state */
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkMark: {
    fontSize: 28,
    color: '#059669',
    fontWeight: '700',
  },
  connectedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
  },
  connectedSource: {
    fontSize: 14,
    color: '#78716c',
    marginBottom: 12,
  },
  connectedDesc: {
    fontSize: 14,
    color: '#57534e',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  skipText: {
    fontSize: 14,
    color: '#78716c',
    fontWeight: '500',
  },
});

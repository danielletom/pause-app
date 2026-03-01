import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
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
      setState('connected');
      updateData({ healthConnect: { connected: true, source: 'apple_health' } });
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

  /* Unavailable (Android / simulator) */
  if (state === 'unavailable') {
    return (
      <SafeAreaView style={styles.container}>
        <ProgressBar step={6} total={7} />
        <View style={styles.centerWrap}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>{'\uD83D\uDCF1'}</Text>
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

  /* Syncing state */
  if (state === 'syncing') {
    return (
      <SafeAreaView style={styles.container}>
        <ProgressBar step={6} total={7} />
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1c1917" />
          <Text style={styles.syncTitle}>Connecting...</Text>
          <Text style={styles.syncSubtitle}>Requesting access to your health data</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* Connected state */
  if (state === 'connected') {
    return (
      <SafeAreaView style={styles.container}>
        <ProgressBar step={6} total={7} />
        <View style={styles.centerWrap}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>{'\u2713'}</Text>
          </View>
          <Text style={styles.connectedTitle}>Connected</Text>
          <Text style={styles.connectedDesc}>
            Your sleep will be auto-tracked each morning. No need to wear anything.
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

  /* Initial state — simplified */
  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={6} total={7} />
      <View style={styles.centerWrap}>
        <Text style={{ fontSize: 48, marginBottom: 20 }}>{'\uD83C\uDF19'}</Text>
        <Text style={styles.heading}>Auto-track your sleep</Text>
        <Text style={styles.subheading}>
          Connect Apple Health and we'll log your sleep automatically. No wearable needed.
        </Text>

        {/* Single benefit card */}
        <View style={styles.benefitCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 14 }}>{'\u2728'}</Text>
            <Text style={styles.benefitTitle}>What changes</Text>
          </View>
          <Text style={styles.benefitDesc}>
            Your morning check-in fills in sleep hours automatically {'\u2014'} one less thing to think about.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton onPress={handleConnect}>
          Connect Apple Health
        </OnboardingButton>
        <AnimatedPressable onPress={handleSkip} scaleDown={0.98} style={styles.skipButton}>
          <Text style={styles.skipText}>I'll do it later</Text>
        </AnimatedPressable>
        <Text style={styles.privacyNote}>
          We only read {'\u2014'} never write to your health data
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1c1917',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: 28,
  },
  benefitCard: {
    backgroundColor: '#f0fdfa',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    width: '100%',
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
  },
  benefitDesc: {
    fontSize: 13,
    color: '#57534e',
    lineHeight: 19,
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
    marginBottom: 8,
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
    alignItems: 'center',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  skipText: {
    fontSize: 14,
    color: '#78716c',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  privacyNote: {
    fontSize: 12,
    color: '#d6d3d1',
    marginTop: 12,
  },
});

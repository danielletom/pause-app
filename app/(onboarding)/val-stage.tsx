import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingButton from '@/components/onboarding/OnboardingButton';

const steps = [
  {
    number: '1',
    title: 'Estrogen drops',
    desc: 'Your ovaries produce less estrogen, sometimes in unpredictable surges and dips',
  },
  {
    number: '2',
    title: 'Your body reacts',
    desc: "Your brain's thermostat, sleep center, and mood regulation are all affected by this shift",
  },
  {
    number: '3',
    title: "But it's manageable",
    desc: 'Understanding your patterns is the first step. Tracking reveals what your body is telling you.',
  },
];

export default function ValStageScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🧬</Text>
          </View>

          <Text style={styles.heading}>
            Here's what's happening{'\n'}in your body
          </Text>
          <Text style={styles.subheading}>
            Your estrogen levels are shifting. This is the root cause of almost
            every symptom you're feeling — from hot flashes to brain fog to
            sleepless nights.
          </Text>

          <View style={styles.steps}>
            {steps.map((step) => (
              <View key={step.number} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{step.number}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          You're not broken. Your body is changing.{'\n'}And we can help you
          navigate it.
        </Text>
        <OnboardingButton onPress={() => router.push('/(onboarding)/symptoms')}>
          Tell us your symptoms →
        </OnboardingButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1917',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#292524',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 28,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 14,
    lineHeight: 34,
  },
  subheading: {
    fontSize: 14,
    color: '#a8a29e',
    lineHeight: 22,
    marginBottom: 28,
  },
  steps: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#292524',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 13,
    color: '#78716c',
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  footerNote: {
    fontSize: 12,
    color: '#57534e',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
});

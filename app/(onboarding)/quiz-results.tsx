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
import { useOnboarding } from '@/lib/onboarding-context';

export default function QuizResultsScreen() {
  const router = useRouter();
  const { data } = useOnboarding();
  const name = data.name || 'there';

  // Focus areas from quiz symptoms
  const focusAreas = [
    { emoji: '\uD83D\uDD25', label: 'Hot flashes' },
    { emoji: '\uD83D\uDE34', label: 'Sleep' },
    { emoji: '\uD83C\uDF2B\uFE0F', label: 'Brain fog' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={{ fontSize: 28, marginBottom: 10 }}>{'\u2726'}</Text>
          <Text style={styles.heroTitle}>We see you, {name}</Text>
          <Text style={styles.heroSub}>Based on what you told us, here's your plan</Text>
        </View>

        {/* Focus Areas */}
        <View style={styles.focusCard}>
          <Text style={styles.focusLabel}>YOUR FOCUS AREAS</Text>
          <View style={styles.focusPills}>
            {focusAreas.map((area) => (
              <View key={area.label} style={styles.focusPill}>
                <Text style={{ fontSize: 12 }}>{area.emoji}</Text>
                <Text style={styles.focusPillText}>{area.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.focusDesc}>
            82% of women in perimenopause experience these.{'\n'}
            You're not alone {'\u2014'} and now we know what to watch for.
          </Text>
        </View>

        {/* Program card */}
        <View style={styles.programCard}>
          <View style={styles.programRow}>
            <View style={styles.programIcon}>
              <Text style={{ fontSize: 16 }}>{'\uD83D\uDCCA'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.programTitle}>Your 14-day program starts now</Text>
              <Text style={styles.programSub}>Daily lessons + check-ins. Patterns in 7 days.</Text>
            </View>
          </View>
        </View>

        {/* User quote */}
        <View style={styles.quoteWrap}>
          <Text style={styles.quoteText}>
            "I finally understood <Text style={{ fontStyle: 'italic' }}>why</Text> I was waking at 3am."
          </Text>
          <Text style={styles.quoteAuthor}>{'\u2014'} Sarah, 47</Text>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <OnboardingButton
          onPress={() => router.push('/(onboarding)/notif-setup')}
          style={{ backgroundColor: '#f59e0b' }}
          textStyle={{ color: '#1c1917' }}
        >
          Get started free
        </OnboardingButton>
        <Text style={styles.footerNote}>Free for 20 days {'\u00B7'} No credit card needed</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1c1917',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 6,
    textAlign: 'center',
  },
  focusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  focusLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#f59e0b',
    marginBottom: 12,
  },
  focusPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  focusPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
  focusDesc: {
    fontSize: 13,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 19,
  },
  programCard: {
    backgroundColor: '#fafaf9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  programIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1917',
  },
  programSub: {
    fontSize: 13,
    color: '#a8a29e',
    marginTop: 2,
  },
  quoteWrap: {
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
  },
  quoteText: {
    fontSize: 14,
    color: '#78716c',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  quoteAuthor: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 13,
    color: '#a8a29e',
    marginTop: 8,
  },
});

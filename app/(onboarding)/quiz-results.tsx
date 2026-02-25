import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import AnimatedPressable from '@/components/AnimatedPressable';

const features = [
  'Daily symptom + mood tracking',
  'AI pattern analysis — your unique triggers',
  'Sleep Score + Readiness Score',
  'Doctor-ready reports you can print',
];

export default function QuizResultsScreen() {
  const router = useRouter();
  const [waitlisted, setWaitlisted] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Based on your symptoms & answers</Text>
          <Text style={styles.headerTitle}>Your Pause plan</Text>
        </View>

        {/* What's Going On Card */}
        <View style={styles.darkCard}>
          <Text style={styles.darkCardLabel}>WHAT'S GOING ON</Text>
          <Text style={styles.darkCardText}>
            Your estrogen is declining, and that's behind the{' '}
            <Text style={styles.amber}>hot flashes</Text>,{' '}
            <Text style={styles.amber}>sleep disruption</Text>, and{' '}
            <Text style={styles.amber}>brain fog</Text> you told us about.
            This is biological — not in your head.
          </Text>
        </View>

        {/* Part 1: Free App */}
        <Text style={styles.sectionLabel}>Here's how Pause helps:</Text>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEmoji}>📊</Text>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Understand your body</Text>
              <Text style={styles.cardSubtitle}>The Pause app — free for 20 days</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            Track your symptoms daily and within 14 days, Pause shows you{' '}
            <Text style={styles.bold}>exactly why</Text> you feel the way you do
            — your triggers, your patterns, what makes things better and worse.
          </Text>
          <View style={styles.featureList}>
            {features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Waitlist Card */}
        <View style={styles.waitlistCard}>
          <Text style={styles.waitlistIcon}>✦</Text>
          <Text style={styles.waitlistHeadline}>Something's in the works</Text>
          <Text style={styles.waitlistBody}>
            We're developing a supplement matched to profiles like yours. Based
            on Pueraria mirifica — a natural phytoestrogen shown to reduce hot
            flashes by 40-60%. Want to know when it's ready?
          </Text>
          {!waitlisted ? (
            <AnimatedPressable
              onPress={() => setWaitlisted(true)}
              scaleDown={0.97}
              style={styles.waitlistButton}
            >
              <Text style={styles.waitlistButtonText}>Notify me</Text>
            </AnimatedPressable>
          ) : (
            <View style={styles.waitlistConfirmed}>
              <Text style={styles.waitlistConfirmedText}>
                ✓ You're on the list — we'll let you know
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <OnboardingButton
          onPress={() => router.push('/(onboarding)/notif-setup')}
        >
          Continue
        </OnboardingButton>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerLabel: {
    fontSize: 14,
    color: '#78716c',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1c1917',
  },
  darkCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  darkCardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 1,
    marginBottom: 8,
  },
  darkCardText: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 22,
  },
  amber: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#44403c',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#1c1917',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1917',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 1,
  },
  cardDesc: {
    fontSize: 16,
    color: '#78716c',
    lineHeight: 20,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#44403c',
  },
  featureList: {
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureCheck: {
    fontSize: 14,
    color: '#78716c',
  },
  featureText: {
    fontSize: 16,
    color: '#78716c',
  },

  // Waitlist card
  waitlistCard: {
    backgroundColor: '#fefbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  waitlistIcon: {
    fontSize: 20,
    color: '#f59e0b',
    marginBottom: 8,
  },
  waitlistHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 6,
  },
  waitlistBody: {
    fontSize: 14,
    color: '#78716c',
    lineHeight: 20,
    marginBottom: 14,
  },
  waitlistButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  waitlistButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
  },
  waitlistConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waitlistConfirmedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#166534',
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
});

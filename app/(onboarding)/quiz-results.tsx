import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingButton from '@/components/onboarding/OnboardingButton';

const periods = [
  { key: '1mo', label: '1 month', price: '$59', per: 'per month', total: '$59 total' },
  { key: '3mo', label: '3 months', price: '$49', per: 'per month', total: '$147 upfront' },
  { key: '6mo', label: '6 months', price: '$39', per: 'per month', total: '$234 upfront', best: true },
];

const features = [
  'Daily symptom + mood tracking',
  'AI pattern analysis — your unique triggers',
  'Sleep Score + Readiness Score',
  'Doctor-ready reports you can print',
];

const trustSignals = [
  'Clinically\nDosed',
  'Third-Party\nTested',
  'Made in\nUSA',
  '90-Day\nGuarantee',
];

export default function QuizResultsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('6mo');

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

        {/* Two-Part Solution */}
        <Text style={styles.sectionLabel}>Feeling better has two parts:</Text>

        {/* Part 1: Free App */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEmoji}>📊</Text>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Part 1: Understand your body</Text>
              <Text style={styles.cardSubtitle}>The Pause app — free to start</Text>
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

        {/* Part 2: Supplement */}
        <View style={[styles.card, styles.cardHighlight]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEmoji}>🌿</Text>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Part 2: Support the root cause</Text>
              <Text style={styles.cardSubtitle}>Pause+ supplement — ships to your door</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Recommended for you</Text>
          </View>
          <Text style={styles.cardDesc}>
            Tracking shows you the problem. The Pause supplement helps address it.{' '}
            <Text style={styles.bold}>Pueraria mirifica</Text> is a natural
            phytoestrogen — a plant compound that gently supports what your body
            is producing less of.
          </Text>

          {/* Science Card */}
          <View style={styles.scienceCard}>
            <Text style={styles.scienceText}>
              <Text style={styles.bold}>The science:</Text> Clinical studies show
              Pueraria mirifica can reduce hot flash frequency by 40-60% within 8
              weeks. L-theanine supports sleep quality and calm without drowsiness.
            </Text>
          </View>

          {/* What's Included */}
          <View style={styles.includes}>
            <View style={styles.includeRow}>
              <Text style={styles.includeIcon}>📦</Text>
              <View>
                <Text style={styles.includeTitle}>Monthly supplement</Text>
                <Text style={styles.includeDesc}>Clinical-dose · 30 capsules · Ships free</Text>
              </View>
            </View>
            <View style={styles.includeRow}>
              <Text style={styles.includeIcon}>📋</Text>
              <View>
                <Text style={styles.includeTitle}>Getting Started Guide</Text>
                <Text style={styles.includeDesc}>Personalized daily routine based on your symptom profile</Text>
              </View>
            </View>
            <View style={styles.includeRow}>
              <Text style={styles.includeIcon}>📖</Text>
              <View>
                <Text style={styles.includeTitle}>Printed Nutrition Guide</Text>
                <Text style={styles.includeDesc}>30-day meal plan for menopause symptom support</Text>
              </View>
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.pricingDivider} />
          <Text style={styles.pricingLabel}>Choose your commitment — paid upfront:</Text>
          <View style={styles.pricingGrid}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                activeOpacity={0.7}
                style={[
                  styles.pricingOption,
                  period === p.key && styles.pricingOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.pricingDuration,
                    period === p.key && styles.pricingDurationSelected,
                  ]}
                >
                  {p.label}
                </Text>
                <Text
                  style={[
                    styles.pricingPrice,
                    period === p.key && styles.pricingPriceSelected,
                  ]}
                >
                  {p.price}
                </Text>
                <Text
                  style={[
                    styles.pricingPer,
                    period === p.key && styles.pricingPerSelected,
                  ]}
                >
                  {p.per}
                </Text>
                <Text
                  style={[
                    styles.pricingTotal,
                    period === p.key && styles.pricingTotalSelected,
                  ]}
                >
                  {p.total}
                </Text>
                {p.best && (
                  <Text
                    style={[
                      styles.bestValue,
                      period === p.key && styles.bestValueSelected,
                    ]}
                  >
                    Best value
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trust Signals */}
        <View style={styles.trustRow}>
          {trustSignals.map((t) => (
            <Text key={t} style={styles.trustText}>
              {t}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* Footer CTAs */}
      <View style={styles.footer}>
        <OnboardingButton
          onPress={() => router.push('/(onboarding)/notif-setup')}
        >
          {period === '1mo'
            ? 'Start with Pause+ — $59'
            : `Start with Pause+ — ${
                periods.find((p) => p.key === period)?.price
              }/mo`}
        </OnboardingButton>
        <Text style={styles.guarantee}>
          90-day money-back guarantee · Cancel anytime
        </Text>
        <OnboardingButton
          variant="ghost"
          onPress={() => router.push('/(onboarding)/notif-setup')}
        >
          Start with the free app
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
    fontSize: 12,
    color: '#a8a29e',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 1,
    marginBottom: 8,
  },
  darkCardText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 22,
  },
  amber: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#44403c',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e7e5e4',
  },
  cardHighlight: {
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
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1917',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 1,
  },
  cardDesc: {
    fontSize: 13,
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
    fontSize: 12,
    color: '#a8a29e',
  },
  featureText: {
    fontSize: 13,
    color: '#78716c',
  },
  badge: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1c1917',
  },
  scienceCard: {
    backgroundColor: '#fafaf9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  scienceText: {
    fontSize: 12,
    color: '#44403c',
    lineHeight: 18,
  },
  includes: {
    gap: 12,
    marginBottom: 14,
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  includeIcon: {
    fontSize: 14,
    marginTop: 2,
  },
  includeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c1917',
  },
  includeDesc: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 1,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#f5f5f4',
    marginBottom: 14,
  },
  pricingLabel: {
    fontSize: 12,
    color: '#a8a29e',
    marginBottom: 10,
  },
  pricingGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  pricingOption: {
    flex: 1,
    backgroundColor: '#fafaf9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f5f5f4',
  },
  pricingOptionSelected: {
    backgroundColor: '#1c1917',
    borderColor: '#1c1917',
  },
  pricingDuration: {
    fontSize: 12,
    color: '#a8a29e',
    marginBottom: 4,
  },
  pricingDurationSelected: {
    color: '#a8a29e',
  },
  pricingPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
  },
  pricingPriceSelected: {
    color: '#ffffff',
  },
  pricingPer: {
    fontSize: 11,
    color: '#a8a29e',
    marginTop: 2,
  },
  pricingPerSelected: {
    color: '#a8a29e',
  },
  pricingTotal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#78716c',
    marginTop: 4,
  },
  pricingTotalSelected: {
    color: '#f59e0b',
  },
  bestValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
    marginTop: 4,
  },
  bestValueSelected: {
    color: '#f59e0b',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  trustText: {
    fontSize: 11,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
  guarantee: {
    fontSize: 12,
    color: '#d6d3d1',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
});

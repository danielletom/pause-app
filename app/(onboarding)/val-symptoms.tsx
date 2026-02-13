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

const stats = [
  {
    percent: '87%',
    bgColor: '#fef3c7',
    textColor: '#d97706',
    title: 'report sleep disruption',
    desc: 'The #1 complaint during this transition',
  },
  {
    percent: '79%',
    bgColor: '#ffe4e6',
    textColor: '#e11d48',
    title: 'say brain fog affects their daily life',
    desc: "It's hormonal, not cognitive decline",
  },
  {
    percent: '68%',
    bgColor: '#e0e7ff',
    textColor: '#4f46e5',
    title: 'felt dismissed by their doctor',
    desc: "That's exactly why we built Pause",
  },
];

export default function ValSymptomsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>💛</Text>
          </View>

          <Text style={styles.heading}>You're not alone</Text>
          <Text style={styles.subheading}>
            The combination of symptoms you selected is reported by{' '}
            <Text style={styles.bold}>73% of women</Text> in the same stage as
            you.
          </Text>

          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.percent} style={styles.statRow}>
                <View
                  style={[styles.statBadge, { backgroundColor: stat.bgColor }]}
                >
                  <Text style={[styles.statPercent, { color: stat.textColor }]}>
                    {stat.percent}
                  </Text>
                </View>
                <View style={styles.statContent}>
                  <Text style={styles.statTitle}>{stat.title}</Text>
                  <Text style={styles.statDesc}>{stat.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton onPress={() => router.push('/(onboarding)/goals')}>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 10,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 280,
  },
  bold: {
    color: '#1c1917',
    fontWeight: '600',
  },
  stats: {
    width: '100%',
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafaf9',
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  statBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1c1917',
    marginBottom: 2,
  },
  statDesc: {
    fontSize: 12,
    color: '#a8a29e',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

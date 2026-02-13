import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import ProgressBar from '@/components/onboarding/ProgressBar';
import OnboardingButton from '@/components/onboarding/OnboardingButton';

export default function QuizIntroScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={4} total={7} />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✦</Text>
        </View>

        <Text style={styles.heading}>
          Get a personalized{'\n'}supplement recommendation
        </Text>
        <Text style={styles.subheading}>
          Answer 3 quick questions and we'll tell you if the Pause supplement
          could help with your specific symptoms.
        </Text>
        <Text style={styles.hint}>Takes about 60 seconds. No obligation.</Text>
      </View>

      <View style={styles.footer}>
        <OnboardingButton onPress={() => router.push('/(onboarding)/quiz-q1')}>
          Take the quiz
        </OnboardingButton>
        <View style={{ height: 12 }} />
        <OnboardingButton
          variant="ghost"
          onPress={() => router.push('/(onboarding)/notif-setup')}
        >
          Skip for now
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
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
    color: '#1c1917',
    marginBottom: 10,
    lineHeight: 34,
  },
  subheading: {
    fontSize: 14,
    color: '#a8a29e',
    lineHeight: 22,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#d6d3d1',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

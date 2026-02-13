import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProgressBar from '@/components/onboarding/ProgressBar';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';
import { useOnboarding } from '@/lib/onboarding-context';

const goalsList = [
  {
    id: 'track',
    icon: '◉',
    label: 'Track my symptoms',
    desc: 'Understand patterns and triggers',
  },
  {
    id: 'why',
    icon: '✦',
    label: 'Understand why I feel this way',
    desc: 'AI-powered pattern analysis',
  },
  {
    id: 'hrt',
    icon: '◎',
    label: 'Manage my medications',
    desc: 'Log HRT, supplements, see what\u2019s working',
  },
  {
    id: 'doctor',
    icon: '◫',
    label: 'Prepare for doctor visits',
    desc: 'Generate shareable health reports',
  },
  {
    id: 'feel',
    icon: '☽',
    label: 'Sleep better & feel calmer',
    desc: 'Sleep tools, mindfulness, breathing',
  },
  {
    id: 'learn',
    icon: '◇',
    label: "Understand what\u2019s happening",
    desc: 'Evidence-based menopause education',
  },
];

export default function GoalsScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(new Set(data.goals));

  const toggle = (id: string) => {
    hapticLight();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    updateData({ goals: Array.from(selected) });
    router.push('/(onboarding)/quiz-intro');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={3} total={7} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>
          What matters{'\n'}most to you?
        </Text>
        <Text style={styles.subheading}>
          We'll tailor your experience. Pick as many as you'd like.
        </Text>

        <View style={styles.options}>
          {goalsList.map((goal) => (
            <AnimatedPressable
              key={goal.id}
              onPress={() => toggle(goal.id)}
              scaleDown={0.97}
              style={[
                styles.option,
                selected.has(goal.id) && styles.optionSelected,
              ]}
            >
              <Text style={styles.optionIcon}>{goal.icon}</Text>
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>{goal.label}</Text>
                <Text style={styles.optionDesc}>{goal.desc}</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  selected.has(goal.id) && styles.checkboxSelected,
                ]}
              >
                {selected.has(goal.id) && (
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                )}
              </View>
            </AnimatedPressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton onPress={handleContinue}>
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
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 8,
    lineHeight: 34,
  },
  subheading: {
    fontSize: 14,
    color: '#a8a29e',
    marginBottom: 22,
    lineHeight: 20,
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafaf9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  optionSelected: {
    borderColor: '#1c1917',
    backgroundColor: '#fafaf9',
  },
  optionIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1917',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: '#a8a29e',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: '#1c1917',
    borderColor: '#1c1917',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

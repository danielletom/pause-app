import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import ProgressBar from '@/components/onboarding/ProgressBar';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';
import { useOnboarding } from '@/lib/onboarding-context';

const symptomsList = [
  'Hot flashes',
  'Night sweats',
  'Sleep issues',
  'Mood changes',
  'Anxiety',
  'Brain fog',
  'Fatigue',
  'Weight changes',
  'Joint pain',
  'Low libido',
  'Vaginal dryness',
  'Heart palpitations',
  'Headaches',
  'Bloating',
  'Irregular periods',
];

export default function SymptomsScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(data.symptoms)
  );

  const toggle = (symptom: string) => {
    hapticLight();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symptom)) {
        next.delete(symptom);
      } else {
        next.add(symptom);
      }
      return next;
    });
  };

  const handleContinue = () => {
    updateData({ symptoms: Array.from(selected) });
    router.push('/(onboarding)/val-symptoms');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={2} total={7} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>
          What are you{'\n'}experiencing?
        </Text>
        <Text style={styles.subheading}>
          Select all that apply. You can change these anytime.
        </Text>

        <View style={styles.pills}>
          {symptomsList.map((symptom) => (
            <AnimatedPressable
              key={symptom}
              onPress={() => toggle(symptom)}
              scaleDown={0.93}
              style={[
                styles.pill,
                selected.has(symptom) && styles.pillSelected,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selected.has(symptom) && styles.pillTextSelected,
                ]}
              >
                {symptom}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        {selected.size > 0 && (
          <Text style={styles.count}>{selected.size} selected</Text>
        )}
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
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: '#f5f5f4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillSelected: {
    backgroundColor: '#1c1917',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#78716c',
  },
  pillTextSelected: {
    color: '#ffffff',
  },
  count: {
    fontSize: 13,
    color: '#a8a29e',
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

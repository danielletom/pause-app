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
import { hapticSelection } from '@/lib/haptics';
import { useOnboarding } from '@/lib/onboarding-context';

const options = [
  'Multiple times a day',
  'Daily',
  'A few times a week',
  'Weekly or less',
];

export default function QuizQ2Screen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(
    data.quizAnswers[1]
  );

  const handleSelect = (option: string) => {
    hapticSelection();
    setSelected(option);
  };

  const handleNext = () => {
    const answers = [...data.quizAnswers];
    answers[1] = selected;
    updateData({ quizAnswers: answers });
    router.push('/(onboarding)/quiz-q3');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={4} total={7} />
      <View style={styles.questionLabel}>
        <Text style={styles.questionNum}>Question 2 of 3</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>
          How often do your symptoms disrupt your daily life?
        </Text>

        <View style={styles.options}>
          {options.map((option) => (
            <AnimatedPressable
              key={option}
              onPress={() => handleSelect(option)}
              scaleDown={0.97}
              style={[
                styles.option,
                selected === option && styles.optionSelected,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  selected === option && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton onPress={handleNext} disabled={!selected}>
          Next
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
  questionLabel: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  questionNum: {
    fontSize: 13,
    color: '#a8a29e',
    fontWeight: '500',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 24,
    lineHeight: 30,
  },
  options: {
    gap: 10,
  },
  option: {
    backgroundColor: '#fafaf9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: '#1c1917',
    backgroundColor: '#fafaf9',
  },
  optionText: {
    fontSize: 15,
    color: '#78716c',
  },
  optionTextSelected: {
    color: '#1c1917',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

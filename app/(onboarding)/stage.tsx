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

const stages = [
  {
    id: 'peri',
    label: 'Perimenopause',
    desc: 'Irregular periods, new symptoms starting',
  },
  {
    id: 'meno',
    label: 'Menopause',
    desc: '12+ months without a period',
  },
  {
    id: 'post',
    label: 'Post-menopause',
    desc: 'Beyond the transition',
  },
  {
    id: 'unsure',
    label: "I'm not sure",
    desc: 'Help me figure it out',
  },
];

export default function StageScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(data.stage);

  const handleSelect = (id: string) => {
    hapticSelection();
    setSelected(id);
  };

  const handleContinue = () => {
    updateData({ stage: selected });
    router.push('/(onboarding)/val-stage');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar step={1} total={7} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>
          Where are you in{'\n'}your journey?
        </Text>
        <Text style={styles.subheading}>
          This helps us personalize everything for you.
        </Text>

        <View style={styles.options}>
          {stages.map((stage) => (
            <AnimatedPressable
              key={stage.id}
              onPress={() => handleSelect(stage.id)}
              scaleDown={0.97}
              style={[
                styles.option,
                selected === stage.id && styles.optionSelected,
              ]}
            >
              <Text style={styles.optionLabel}>{stage.label}</Text>
              <Text style={styles.optionDesc}>{stage.desc}</Text>
            </AnimatedPressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton onPress={handleContinue} disabled={!selected}>
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
    marginBottom: 24,
    lineHeight: 20,
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
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 13,
    color: '#a8a29e',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import ProgressBar from '@/components/onboarding/ProgressBar';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import { useOnboarding } from '@/lib/onboarding-context';

export default function AboutYouScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { data, updateData } = useOnboarding();

  const [name, setName] = useState(user?.firstName || data.name || '');
  const [dob, setDob] = useState(data.dateOfBirth || '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Simple date formatting helper
  const formatDateInput = (text: string) => {
    // Remove non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    // Format as MM/DD/YYYY
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
  };

  const isValid = name.trim().length > 0 && dob.length === 10;

  const handleContinue = () => {
    updateData({ name: name.trim(), dateOfBirth: dob });
    router.push('/(onboarding)/stage');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ProgressBar step={0} total={7} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>
            First, a little{'\n'}about you
          </Text>
          <Text style={styles.subheading}>
            We use this to personalize your experience.
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your first name"
                placeholderTextColor="#a8a29e"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                textContentType="givenName"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of birth</Text>
              <TextInput
                style={styles.input}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#a8a29e"
                value={dob}
                onChangeText={(text) => setDob(formatDateInput(text))}
                keyboardType="number-pad"
                maxLength={10}
              />
              <Text style={styles.hint}>
                Used for age-based comparisons and benchmarks
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <OnboardingButton onPress={handleContinue} disabled={!isValid}>
            Continue
          </OnboardingButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
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
    marginBottom: 28,
    lineHeight: 20,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#44403c',
  },
  input: {
    backgroundColor: '#fafaf9',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1c1917',
  },
  hint: {
    fontSize: 12,
    color: '#d6d3d1',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

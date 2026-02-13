import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import { hapticSuccess } from '@/lib/haptics';
import { useOnboarding } from '@/lib/onboarding-context';
import { apiRequest } from '@/lib/api';

const userStats = [
  { number: '73%', label: 'track patterns' },
  { number: '12', label: 'insights found' },
  { number: '3', label: 'reports shared' },
];

export default function DoneScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data } = useOnboarding();
  const [saving, setSaving] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    saveProfile();
  }, []);

  const saveProfile = async () => {
    try {
      setSaving(true);
      const token = await getToken();

      await apiRequest('/api/profile', token, {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          dateOfBirth: data.dateOfBirth,
          stage: data.stage,
          symptoms: data.symptoms,
          goals: data.goals,
          onboardingComplete: true,
        }),
      });

      setSaving(false);
      hapticSuccess();
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(err.message || 'Failed to save. You can still continue.');
      setSaving(false);
    }
  };

  const handleStart = () => {
    router.replace('/(app)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {saving ? (
          <ActivityIndicator size="large" color="#1c1917" />
        ) : (
          <>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={32} color="#ffffff" />
            </View>

            <Text style={styles.heading}>You're all set</Text>
            <Text style={styles.subheading}>
              Pause learns from you. The more you log, the better we can show
              you why you feel the way you do.
            </Text>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <View style={styles.statsRow}>
              {userStats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text style={styles.statNumber}>{stat.number}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.statsNote}>
              Average user stats after 30 days
            </Text>
          </>
        )}
      </View>

      {!saving && (
        <View style={styles.footer}>
          <OnboardingButton onPress={handleStart}>
            Start tracking
          </OnboardingButton>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1c1917',
    textAlign: 'center',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 14,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 28,
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c1917',
  },
  statLabel: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 2,
  },
  statsNote: {
    fontSize: 12,
    color: '#d6d3d1',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

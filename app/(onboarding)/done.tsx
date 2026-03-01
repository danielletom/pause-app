import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import OnboardingButton from '@/components/onboarding/OnboardingButton';
import { hapticSuccess } from '@/lib/haptics';
import { useOnboarding } from '@/lib/onboarding-context';
import { apiRequest } from '@/lib/api';

const JOURNEY_STEPS = ['Sign up', 'First check-in', '3-day streak', '7-day insights', 'Your report'];

export default function DoneScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data } = useOnboarding();
  const name = data.name || 'there';
  const [saving, setSaving] = useState(true);
  const [error, setError] = useState('');

  /* Ripple animation */
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    saveProfile();
  }, []);

  const startCelebration = () => {
    hapticSuccess();

    /* Staggered ripple rings */
    const createRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    Animated.parallel([
      createRipple(ripple1, 0),
      createRipple(ripple2, 600),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

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
      startCelebration();
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(err.message || 'Failed to save. You can still continue.');
      setSaving(false);
      startCelebration();
    }
  };

  const handleStart = () => {
    router.replace('/(app)' as any);
  };

  const rippleStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#f59e0b',
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {saving ? (
          <ActivityIndicator size="large" color="#1c1917" />
        ) : (
          <Animated.View style={[styles.mainContent, { opacity: fadeIn }]}>
            {/* Celebration ripple */}
            <View style={styles.celebrationWrap}>
              <Animated.View style={rippleStyle(ripple1)} />
              <Animated.View style={rippleStyle(ripple2)} />
              <View style={styles.celebrationCircle}>
                <Text style={{ fontSize: 32 }}>{'\u2728'}</Text>
              </View>
            </View>

            {/* Heading */}
            <Text style={styles.heading}>You're in, {name}</Text>
            <Text style={styles.subheading}>
              Your personalized tracking plan is ready. Let's start understanding your body.
            </Text>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {/* User quote — dark card */}
            <View style={styles.quoteCard}>
              <Text style={styles.quoteText}>
                "After two weeks I could finally explain to my doctor what was happening — with data, not just feelings."
              </Text>
              <Text style={styles.quoteAuthor}>{'\u2014'} Michelle, 44</Text>
            </View>

            {/* Journey progress */}
            <View style={styles.journeyCard}>
              <Text style={styles.journeyLabel}>YOUR JOURNEY</Text>
              <View style={styles.journeyBar}>
                {JOURNEY_STEPS.map((step, i) => (
                  <View key={step} style={styles.journeyStep}>
                    <View
                      style={[
                        styles.journeyDot,
                        i === 0 ? styles.journeyDotActive : styles.journeyDotInactive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.journeyStepText,
                        i === 0 && styles.journeyStepTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {step}
                    </Text>
                  </View>
                ))}
              </View>
              {/* Connecting line */}
              <View style={styles.journeyLine}>
                <View style={styles.journeyLineFill} />
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {!saving && (
        <View style={styles.footer}>
          <OnboardingButton
            onPress={handleStart}
            style={{ backgroundColor: '#f59e0b' }}
            textStyle={{ color: '#1c1917' }}
          >
            Start your first check-in
          </OnboardingButton>
          <Text style={styles.footerNote}>
            Free for 20 days {'\u00B7'} No credit card needed
          </Text>
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
    paddingHorizontal: 24,
  },
  mainContent: {
    alignItems: 'center',
    width: '100%',
  },

  /* Celebration */
  celebrationWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  celebrationCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Heading */
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1c1917',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 8,
  },

  /* Quote card */
  quoteCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginTop: 24,
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 14,
    color: '#e7e5e4',
    fontStyle: 'italic',
    lineHeight: 21,
    textAlign: 'center',
  },
  quoteAuthor: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
    marginTop: 10,
  },

  /* Journey */
  journeyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  journeyLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#a8a29e',
    marginBottom: 14,
    textAlign: 'center',
  },
  journeyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  journeyStep: {
    alignItems: 'center',
    flex: 1,
  },
  journeyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  journeyDotActive: {
    backgroundColor: '#f59e0b',
  },
  journeyDotInactive: {
    backgroundColor: '#e7e5e4',
  },
  journeyStepText: {
    fontSize: 10,
    color: '#a8a29e',
    textAlign: 'center',
  },
  journeyStepTextActive: {
    color: '#1c1917',
    fontWeight: '600',
  },
  journeyLine: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: 21, // align with dots center: padding(16) + dot center(6) - lineHeight(1)
    height: 2,
    backgroundColor: '#e7e5e4',
    zIndex: 0,
  },
  journeyLineFill: {
    width: '0%',
    height: '100%',
    backgroundColor: '#f59e0b',
  },

  /* Footer */
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 13,
    color: '#a8a29e',
    marginTop: 8,
  },
});

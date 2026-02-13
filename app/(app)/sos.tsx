import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Breathing phases: 4s inhale, 4s hold, 6s exhale = 14s per cycle, 6 cycles
const INHALE_MS = 4000;
const HOLD_MS = 4000;
const EXHALE_MS = 6000;
const TOTAL_CYCLES = 6;

type Step = 'intro' | 'breathing' | 'done';
type Rating = 'better' | 'same' | 'worse';

export default function SOSScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [cycle, setCycle] = useState(1);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [rating, setRating] = useState<Rating | null>(null);
  const [saving, setSaving] = useState(false);
  const [sosCount, setSosCount] = useState(0);
  const startTime = useRef(Date.now());

  // ─── Concentric circle scales ──────────────────
  const outerScale = useSharedValue(0.65);
  const middleScale = useSharedValue(0.55);
  const innerScale = useSharedValue(0.45);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
  }));
  const middleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: middleScale.value }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  const advancePhase = useCallback(() => {
    setPhase((prev) => {
      if (prev === 'inhale') return 'hold';
      if (prev === 'hold') return 'exhale';
      // exhale → next cycle or done
      setCycle((c) => {
        if (c >= TOTAL_CYCLES) {
          setStep('done');
          return c;
        }
        return c + 1;
      });
      return 'inhale';
    });
  }, []);

  // ─── Breathing animation cycle ──────────────────
  useEffect(() => {
    if (step !== 'breathing') return;

    const timingConfig = (duration: number) => ({
      duration,
      easing: Easing.inOut(Easing.ease),
    });

    if (phase === 'inhale') {
      hapticLight();
      // Expand all 3 concentric circles
      outerScale.value = withTiming(1.0, timingConfig(INHALE_MS), (finished) => {
        if (finished) runOnJS(advancePhase)();
      });
      middleScale.value = withTiming(0.85, timingConfig(INHALE_MS));
      innerScale.value = withTiming(0.65, timingConfig(INHALE_MS));
    } else if (phase === 'hold') {
      hapticSelection();
      // Hold — no animation, just wait
      const timer = setTimeout(advancePhase, HOLD_MS);
      return () => clearTimeout(timer);
    } else if (phase === 'exhale') {
      hapticLight();
      // Contract all 3 concentric circles
      outerScale.value = withTiming(0.65, timingConfig(EXHALE_MS), (finished) => {
        if (finished) runOnJS(advancePhase)();
      });
      middleScale.value = withTiming(0.55, timingConfig(EXHALE_MS));
      innerScale.value = withTiming(0.45, timingConfig(EXHALE_MS));
    }
  }, [step, phase, cycle]);

  const startBreathing = () => {
    hapticMedium();
    startTime.current = Date.now();
    setStep('breathing');
    setCycle(1);
    setPhase('inhale');
    outerScale.value = 0.65;
    middleScale.value = 0.55;
    innerScale.value = 0.45;
  };

  const finishEarly = () => {
    hapticSelection();
    setStep('done');
  };

  const submitRating = async (r: Rating) => {
    hapticSelection();
    setRating(r);
    setSaving(true);
    try {
      const token = await getToken();
      const durationSeconds = Math.round((Date.now() - startTime.current) / 1000);
      await apiRequest('/api/sos', token, {
        method: 'POST',
        body: JSON.stringify({
          completed: true,
          durationSeconds,
          rating: r,
        }),
      });
      const data = await apiRequest('/api/sos', token).catch(() => null);
      if (data?.count) setSosCount(data.count);
    } catch {
      // Non-critical
    } finally {
      setSaving(false);
    }
  };

  // ─── Step 0: Intro ──────────────────────
  if (step === 'intro') {
    return (
      <LinearGradient colors={['#f0fdfa', '#ffffff']} style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <View style={styles.centered}>
            {/* Back */}
            <AnimatedPressable
              onPress={() => { hapticLight(); router.back(); }}
              scaleDown={0.95}
              style={styles.backButton}
            >
              <Text style={styles.backText}>← Back</Text>
            </AnimatedPressable>

            {/* Large teal circle with snowflake */}
            <View style={styles.introCircle}>
              <Text style={{ fontSize: 40, color: '#ffffff' }}>❄</Text>
            </View>

            <Text style={styles.introTitle}>Hot Flash SOS</Text>
            <Text style={styles.introDesc}>
              Guided breathing to help you through it. Takes about 3 minutes.
            </Text>
            <Text style={styles.socialProof}>
              Used 847 times by Pause members this week
            </Text>
          </View>

          <View style={styles.bottomActions}>
            <AnimatedPressable
              onPress={startBreathing}
              scaleDown={0.96}
              style={styles.tealButton}
            >
              <Text style={styles.tealButtonText}>Start breathing exercise →</Text>
            </AnimatedPressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── Step 1: Breathing ────────────────────
  if (step === 'breathing') {
    const phaseLabel = phase === 'inhale' ? 'Breathe in' : phase === 'hold' ? 'Hold' : 'Breathe out';
    const phaseHint = phase === 'inhale'
      ? 'Inhale through your nose... 4 seconds'
      : phase === 'hold'
        ? 'Gently hold...'
        : 'Exhale slowly... 6 seconds';

    const CIRCLE_SIZE = SCREEN_WIDTH * 0.6;

    return (
      <SafeAreaView style={styles.darkContainer}>
        <View style={styles.centered}>
          {/* End session */}
          <AnimatedPressable
            onPress={finishEarly}
            scaleDown={0.95}
            style={styles.endSessionButton}
          >
            <Text style={styles.endSessionText}>End session ×</Text>
          </AnimatedPressable>

          {/* Concentric circles */}
          <View style={[styles.circleContainer, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}>
            {/* Outer ring */}
            <Animated.View
              style={[
                styles.concentricCircle,
                {
                  width: CIRCLE_SIZE,
                  height: CIRCLE_SIZE,
                  borderRadius: CIRCLE_SIZE / 2,
                  backgroundColor: 'rgba(45, 212, 191, 0.12)',
                },
                outerStyle,
              ]}
            />
            {/* Middle ring */}
            <Animated.View
              style={[
                styles.concentricCircle,
                {
                  width: CIRCLE_SIZE * 0.72,
                  height: CIRCLE_SIZE * 0.72,
                  borderRadius: (CIRCLE_SIZE * 0.72) / 2,
                  backgroundColor: 'rgba(45, 212, 191, 0.22)',
                },
                middleStyle,
              ]}
            />
            {/* Inner circle */}
            <Animated.View
              style={[
                styles.concentricCircle,
                {
                  width: CIRCLE_SIZE * 0.45,
                  height: CIRCLE_SIZE * 0.45,
                  borderRadius: (CIRCLE_SIZE * 0.45) / 2,
                  backgroundColor: '#2dd4bf',
                },
                innerStyle,
              ]}
            >
              <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            </Animated.View>
          </View>

          {/* Phase hint */}
          <Text style={styles.phaseHint}>{phaseHint}</Text>
        </View>

        {/* Bottom: cycle dots + finish */}
        <View style={styles.breathingBottom}>
          <View style={styles.cycleDots}>
            {Array.from({ length: TOTAL_CYCLES }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.cycleDot,
                  { backgroundColor: i < cycle ? '#2dd4bf' : '#44403c' },
                ]}
              />
            ))}
          </View>
          <Text style={styles.cycleText}>Cycle {cycle} of {TOTAL_CYCLES}</Text>
          <AnimatedPressable
            onPress={finishEarly}
            scaleDown={0.96}
            style={styles.finishEarlyButton}
          >
            <Text style={styles.finishEarlyText}>Finish early</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step 2: Done + Rating ────────────────
  return (
    <LinearGradient colors={['#f0fdfa', '#ffffff']} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.centered}>
          {/* Teal check circle */}
          <View style={styles.doneCheckCircle}>
            <Text style={styles.doneCheckMark}>✓</Text>
          </View>

          <Text style={styles.doneTitle}>You did great</Text>
          <Text style={styles.doneDesc}>
            3 minutes of calm. Your body thanks you.
          </Text>

          {/* Rating */}
          {!rating ? (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingQuestion}>How do you feel now?</Text>
              <View style={styles.ratingRow}>
                {([
                  { key: 'better' as Rating, label: 'Better', emoji: '😊' },
                  { key: 'same' as Rating, label: 'About the same', emoji: '😐' },
                  { key: 'worse' as Rating, label: 'Still rough', emoji: '😔' },
                ]).map((opt) => (
                  <AnimatedPressable
                    key={opt.key}
                    onPress={() => submitRating(opt.key)}
                    scaleDown={0.95}
                    style={[
                      styles.ratingPill,
                      rating === opt.key && styles.ratingPillSelected,
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                    <Text style={styles.ratingPillText}>{opt.label}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingThanks}>
                {saving ? 'Saving...' : 'Thanks for your feedback'}
              </Text>
            </View>
          )}

          {/* Upsell at 5+ uses — dark card */}
          {sosCount >= 5 && (
            <View style={styles.upsellCard}>
              <Text style={styles.upsellLabel}>Did you know?</Text>
              <Text style={styles.upsellTitle}>
                Women on Pause+ see 54% fewer hot flashes after 8 weeks.
              </Text>
              <Text style={styles.upsellLink}>Learn about Pause+ →</Text>
            </View>
          )}
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.back(); }}
            scaleDown={0.96}
            style={styles.doneButton}
          >
            <Text style={styles.doneButtonText}>Back to home</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              hapticLight();
              router.replace('/(app)/quick-log');
            }}
            scaleDown={0.96}
            style={styles.ghostButton}
          >
            <Text style={styles.ghostButtonText}>Log this hot flash</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkContainer: { flex: 1, backgroundColor: '#0c0a09' },

  // Back button
  backButton: { position: 'absolute', top: 16, left: 0, padding: 8 },
  backText: { fontSize: 13, color: '#a8a29e' },

  // ─── Intro ──────────────────────
  introCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#99f6e4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1c1917',
    textAlign: 'center',
    marginBottom: 8,
  },
  introDesc: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  socialProof: {
    fontSize: 12,
    color: '#d6d3d1',
    textAlign: 'center',
  },

  // Bottom actions area
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 8,
  },
  tealButton: {
    backgroundColor: '#0d9488',
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  tealButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  // ─── Breathing ──────────────────
  endSessionButton: { position: 'absolute', top: 16, left: 0, padding: 8 },
  endSessionText: { fontSize: 13, color: '#57534e' },

  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  concentricCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  phaseHint: {
    fontSize: 12,
    color: '#57534e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  breathingBottom: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 12,
  },
  cycleDots: {
    flexDirection: 'row',
    gap: 12,
  },
  cycleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cycleText: {
    fontSize: 12,
    color: '#57534e',
  },
  finishEarlyButton: {
    backgroundColor: '#0d9488',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  finishEarlyText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  // ─── Done ───────────────────────
  doneCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneCheckMark: {
    fontSize: 24,
    color: '#0d9488',
    fontWeight: '700',
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 8,
  },
  doneDesc: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Rating
  ratingSection: { alignSelf: 'stretch', marginBottom: 20 },
  ratingQuestion: {
    fontSize: 13,
    color: '#a8a29e',
    textAlign: 'center',
    marginBottom: 12,
  },
  ratingRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  ratingPill: {
    alignItems: 'center',
    gap: 4,
    padding: 12,
    borderRadius: 16,
    minWidth: 80,
  },
  ratingPillSelected: {
    backgroundColor: '#ccfbf1',
  },
  ratingPillText: { fontSize: 11, color: '#78716c', fontWeight: '500' },
  ratingThanks: { fontSize: 14, color: '#a8a29e', textAlign: 'center' },

  // Upsell — dark card per wireframe
  upsellCard: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    padding: 16,
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  upsellLabel: { fontSize: 12, color: '#78716c' },
  upsellTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginTop: 4,
  },
  upsellLink: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '500',
    marginTop: 6,
  },

  // Done buttons
  doneButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  ghostButton: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  ghostButtonText: {
    color: '#78716c',
    fontSize: 14,
    fontWeight: '500',
  },
});

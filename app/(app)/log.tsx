import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

// ─── Constants ──────────────────────────────────────────

const SYMPTOM_LIST = [
  { key: 'hot_flash', label: 'Hot flashes', emoji: '🔥' },
  { key: 'night_sweats', label: 'Night sweats', emoji: '💦' },
  { key: 'brain_fog', label: 'Brain fog', emoji: '😶‍🌫️' },
  { key: 'anxiety', label: 'Anxiety', emoji: '😰' },
  { key: 'fatigue', label: 'Fatigue', emoji: '😩' },
  { key: 'headache', label: 'Headache', emoji: '🤕' },
  { key: 'joint_pain', label: 'Joint pain', emoji: '💪' },
  { key: 'irritability', label: 'Irritable', emoji: '😤' },
  { key: 'bloating', label: 'Bloating', emoji: '🫧' },
  { key: 'heart_racing', label: 'Heart racing', emoji: '💓' },
  { key: 'low_mood', label: 'Low mood', emoji: '😞' },
  { key: 'insomnia', label: 'Insomnia', emoji: '😴' },
];

const SEVERITY_OPTIONS = [
  { val: 1, label: 'Mild' },
  { val: 2, label: 'Moderate' },
  { val: 3, label: 'Severe' },
];

const MOODS = [
  { val: 1, emoji: '😔', label: 'Rough' },
  { val: 2, emoji: '😕', label: 'Meh' },
  { val: 3, emoji: '🙂', label: 'Okay' },
  { val: 4, emoji: '😊', label: 'Good' },
  { val: 5, emoji: '✨', label: 'Great' },
];

const TRIGGER_LIST = [
  'Stress', 'Poor sleep', 'Alcohol', 'Caffeine', 'Spicy food',
  'Sugar', 'Exercise', 'Weather', 'Skipped meal', 'Late night',
];

const STEPS = ['Symptoms', 'Severity', 'Mood', 'Triggers', 'Note'];

// ─── Main Component ─────────────────────────────────────

export default function SymptomLogScreen() {
  const router = useRouter();
  const { getToken } = useAuth();

  // Step state
  const [step, setStep] = useState(0);

  // Data state — symptoms stored as Record<key, severity>
  const [symptoms, setSymptoms] = useState<Record<string, number>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [triggers, setTriggers] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false); // double-submit guard

  // Animations
  const celebOpacity = useRef(new RNAnimated.Value(0)).current;
  const celebScale = useRef(new RNAnimated.Value(0.8)).current;
  const checkScale = useRef(new RNAnimated.Value(0)).current;

  // Reset state when screen is revisited
  useFocusEffect(
    useCallback(() => {
      setStep(0);
      setSymptoms({});
      setMood(null);
      setTriggers(new Set());
      setNote('');
      setSaving(false);
      setSaved(false);
      savingRef.current = false;
      celebOpacity.setValue(0);
      celebScale.setValue(0.8);
      checkScale.setValue(0);
    }, [])
  );

  // Toggle helpers
  const toggleSymptom = useCallback((key: string) => {
    hapticLight();
    setSymptoms((prev) => {
      const next = { ...prev };
      if (key in next) {
        delete next[key];
      } else {
        next[key] = 1; // default to Mild
      }
      return next;
    });
  }, []);

  const setSeverity = useCallback((key: string, val: number) => {
    hapticSelection();
    setSymptoms((prev) => ({ ...prev, [key]: val }));
  }, []);

  const toggleTrigger = useCallback((t: string) => {
    hapticSelection();
    setTriggers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const toggleMood = useCallback((val: number) => {
    hapticSelection();
    setMood((prev) => (prev === val ? null : val));
  }, []);

  // Navigation
  const handleNext = () => {
    hapticMedium();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    hapticLight();
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  // Can advance from current step?
  const canAdvance = step === 0
    ? Object.keys(symptoms).length > 0
    : true; // severity, mood, triggers, note are all optional/pre-filled

  // Save handler
  const handleSave = async () => {
    if (Object.keys(symptoms).length === 0 || savingRef.current) return;
    savingRef.current = true;
    try {
      setSaving(true);
      hapticMedium();
      const token = await getToken();
      const today = new Date().toISOString().split('T')[0];

      // Build context tags from triggers
      const contextTags = Array.from(triggers).map((t) => t.toLowerCase().replace(/\s+/g, '_'));

      await apiRequest('/api/logs', token, {
        method: 'POST',
        body: JSON.stringify({
          date: today,
          symptomsJson: symptoms,
          mood: mood ?? undefined,
          contextTags: contextTags.length > 0 ? contextTags : undefined,
          notes: note.trim() || undefined,
          logType: 'symptom',
        }),
      });

      hapticSuccess();
      setSaving(false);
      setSaved(true);

      // Animate celebration
      RNAnimated.parallel([
        RNAnimated.timing(celebOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.spring(celebScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        hapticMedium();
        RNAnimated.spring(checkScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
      }, 200);
    } catch {
      setSaving(false);
      savingRef.current = false;
      Alert.alert('Save failed', 'Something went wrong saving your log. Please try again.');
    }
  };

  // ─── Saved confirmation screen ────────────────────────
  if (saved) {
    const symptomCount = Object.keys(symptoms).length;
    return (
      <SafeAreaView style={styles.container}>
        <RNAnimated.View
          style={[
            styles.savedContainer,
            { opacity: celebOpacity, transform: [{ scale: celebScale }] },
          ]}
        >
          <RNAnimated.View
            style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}
          >
            <Text style={styles.checkMark}>✓</Text>
          </RNAnimated.View>
          <Text style={styles.savedTitle}>Logged</Text>
          <Text style={styles.savedSub}>
            {symptomCount} symptom{symptomCount !== 1 ? 's' : ''}
            {mood ? ' · mood tracked' : ''}
          </Text>
          <Text style={styles.savedHint}>This feeds your Readiness Score + Insights</Text>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.back(); }}
            scaleDown={0.97}
            style={styles.doneButton}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </AnimatedPressable>
        </RNAnimated.View>
      </SafeAreaView>
    );
  }

  // ─── Step content renderers ───────────────────────────

  const renderSymptoms = () => (
    <>
      <Text style={styles.stepTitle}>What's bothering you?</Text>
      <Text style={styles.stepSubtitle}>Select all that apply</Text>
      <View style={styles.pillWrap}>
        {SYMPTOM_LIST.map((s) => {
          const selected = s.key in symptoms;
          return (
            <AnimatedPressable
              key={s.key}
              onPress={() => toggleSymptom(s.key)}
              scaleDown={0.95}
              style={[styles.symptomPill, selected && styles.symptomPillActive]}
            >
              <Text style={[styles.symptomPillText, selected && styles.symptomPillTextActive]}>
                {s.emoji} {s.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </>
  );

  const renderSeverity = () => (
    <>
      <Text style={styles.stepTitle}>How bad?</Text>
      <Text style={styles.stepSubtitle}>Rate each symptom</Text>
      <View style={styles.severityList}>
        {Object.entries(symptoms).map(([key, sev]) => {
          const found = SYMPTOM_LIST.find((s) => s.key === key);
          if (!found) return null;
          return (
            <View key={key} style={styles.severityRow}>
              <Text style={styles.severitySymptomLabel}>
                {found.emoji} {found.label}
              </Text>
              <View style={styles.severityButtons}>
                {SEVERITY_OPTIONS.map((opt) => (
                  <AnimatedPressable
                    key={opt.val}
                    onPress={() => setSeverity(key, opt.val)}
                    scaleDown={0.95}
                    style={[
                      styles.severityButton,
                      sev === opt.val && styles.severityButtonSelected,
                    ]}
                  >
                    <Text style={[
                      styles.severityButtonText,
                      sev === opt.val && styles.severityButtonTextSelected,
                    ]}>
                      {opt.label}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );

  const renderMood = () => (
    <>
      <Text style={styles.stepTitle}>How's your mood?</Text>
      <Text style={styles.stepSubtitle}>Optional — skip if you prefer</Text>
      <View style={styles.moodRow}>
        {MOODS.map((m) => {
          const active = mood === m.val;
          return (
            <AnimatedPressable
              key={m.val}
              onPress={() => toggleMood(m.val)}
              scaleDown={0.95}
              style={[styles.moodItem, active && styles.moodItemActive]}
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>
                {m.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </>
  );

  const renderTriggers = () => (
    <>
      <Text style={styles.stepTitle}>Any triggers?</Text>
      <Text style={styles.stepSubtitle}>Optional — helps find patterns</Text>
      <View style={styles.pillWrap}>
        {TRIGGER_LIST.map((t) => {
          const selected = triggers.has(t);
          return (
            <AnimatedPressable
              key={t}
              onPress={() => toggleTrigger(t)}
              scaleDown={0.95}
              style={[styles.triggerPill, selected && styles.triggerPillActive]}
            >
              <Text style={[styles.triggerPillText, selected && styles.triggerPillTextActive]}>
                {t}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </>
  );

  const renderNote = () => (
    <>
      <Text style={styles.stepTitle}>Anything else?</Text>
      <Text style={styles.stepSubtitle}>Optional — add a quick note</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="How you're feeling, what helped..."
        placeholderTextColor="#a8a29e"
        style={styles.noteInput}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </>
  );

  const stepContent = [renderSymptoms, renderSeverity, renderMood, renderTriggers, renderNote];

  // ─── Main wizard UI ───────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Progress bars */}
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                i <= step ? styles.progressBarActive : styles.progressBarInactive,
              ]}
            />
          ))}
        </View>

        {/* Navigation header */}
        <View style={styles.nav}>
          <AnimatedPressable onPress={handleBack} scaleDown={0.9} style={styles.navSide}>
            <Text style={styles.navBackText}>← Back</Text>
          </AnimatedPressable>
          <Text style={styles.navStep}>
            Step {step + 1} of {STEPS.length}
          </Text>
          <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.9} style={styles.navSide}>
            <Text style={styles.navSkipText}>Skip</Text>
          </AnimatedPressable>
        </View>

        {/* Step content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {stepContent[step]()}
        </ScrollView>

        {/* Footer button */}
        <View style={styles.footer}>
          <AnimatedPressable
            onPress={handleNext}
            scaleDown={0.96}
            style={[styles.nextButton, !canAdvance && styles.nextButtonDisabled]}
            disabled={!canAdvance || saving}
          >
            <Text style={[styles.nextButtonText, !canAdvance && styles.nextButtonTextDisabled]}>
              {saving
                ? 'Saving...'
                : step < STEPS.length - 1
                  ? 'Next'
                  : `Save · ${Object.keys(symptoms).length} symptom${Object.keys(symptoms).length !== 1 ? 's' : ''} ✓`}
            </Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  // Progress bar
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 8,
    marginBottom: 4,
  },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  progressBarActive: { backgroundColor: '#1c1917' },
  progressBarInactive: { backgroundColor: '#e7e5e4' },

  // Navigation
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  navSide: { width: 60 },
  navBackText: { fontSize: 13, color: '#a8a29e' },
  navStep: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  navSkipText: { fontSize: 13, color: '#a8a29e', textAlign: 'right' },

  // Scroll content
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 8 },

  // Step titles
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: '#a8a29e', marginBottom: 24 },

  // Symptom pills
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  symptomPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f5f5f4',
  },
  symptomPillActive: { backgroundColor: '#1c1917' },
  symptomPillText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  symptomPillTextActive: { color: '#ffffff' },

  // Severity — per-symptom rows matching morning check-in
  severityList: { gap: 4 },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  severitySymptomLabel: { fontSize: 13, color: '#1c1917', flex: 1 },
  severityButtons: { flexDirection: 'row', gap: 6 },
  severityButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f5f5f4',
  },
  severityButtonSelected: { backgroundColor: '#1c1917' },
  severityButtonText: { fontSize: 12, color: '#78716c', fontWeight: '500' },
  severityButtonTextSelected: { color: '#ffffff' },

  // Mood
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  moodItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  moodItemActive: { backgroundColor: '#1c1917', transform: [{ scale: 1.05 }] },
  moodEmoji: { fontSize: 26 },
  moodLabel: { fontSize: 11, color: '#a8a29e' },
  moodLabelActive: { color: '#ffffff', fontWeight: '500' },

  // Trigger pills
  triggerPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f5f5f4',
  },
  triggerPillActive: { backgroundColor: '#1c1917' },
  triggerPillText: { fontSize: 12, fontWeight: '500', color: '#a8a29e' },
  triggerPillTextActive: { color: '#ffffff' },

  // Note input
  noteInput: {
    backgroundColor: '#fafaf9',
    borderRadius: 14,
    padding: 14,
    fontSize: 13,
    color: '#1c1917',
    borderWidth: 1,
    borderColor: '#f5f5f4',
    minHeight: 100,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
  nextButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonDisabled: { backgroundColor: '#e7e5e4' },
  nextButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  nextButtonTextDisabled: { color: '#a8a29e' },

  // Saved confirmation
  savedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkMark: { fontSize: 28, color: '#059669', fontWeight: '700' },
  savedTitle: { fontSize: 22, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  savedSub: { fontSize: 13, color: '#a8a29e', marginBottom: 8, textAlign: 'center' },
  savedHint: { fontSize: 12, color: '#d6d3d1', marginBottom: 24 },
  doneButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  doneButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});

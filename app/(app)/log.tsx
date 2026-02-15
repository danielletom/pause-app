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
} from 'react-native';
import { useRouter } from 'expo-router';
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
  {
    key: 'mild' as const,
    label: 'Mild',
    desc: 'Noticeable',
    value: 1,
    colors: { bg: '#f0fdf4', border: '#86efac', text: '#166534', descText: '#15803d' },
  },
  {
    key: 'moderate' as const,
    label: 'Moderate',
    desc: 'Disruptive',
    value: 2,
    colors: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', descText: '#b45309' },
  },
  {
    key: 'severe' as const,
    label: 'Severe',
    desc: "Can't function",
    value: 3,
    colors: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', descText: '#dc2626' },
  },
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

// ─── Main Component ─────────────────────────────────────

export default function SymptomLogScreen() {
  const router = useRouter();
  const { getToken } = useAuth();

  // State
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [severity, setSeverity] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [triggers, setTriggers] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Animations
  const celebOpacity = useRef(new RNAnimated.Value(0)).current;
  const celebScale = useRef(new RNAnimated.Value(0.8)).current;
  const checkScale = useRef(new RNAnimated.Value(0)).current;

  // Toggle helpers
  const toggleSymptom = useCallback((key: string) => {
    hapticSelection();
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  // Save handler
  const handleSave = async () => {
    if (selectedSymptoms.size === 0 || saving) return;
    try {
      setSaving(true);
      hapticMedium();
      const token = await getToken();
      const today = new Date().toISOString().split('T')[0];

      // Build symptoms JSON with severity values
      const symptomsJson: Record<string, number> = {};
      const severityValue = SEVERITY_OPTIONS.find((s) => s.key === severity)?.value ?? 2;
      selectedSymptoms.forEach((key) => {
        symptomsJson[key] = severityValue;
      });

      // Build context tags from triggers
      const contextTags = Array.from(triggers).map((t) => t.toLowerCase().replace(/\s+/g, '_'));

      await apiRequest('/api/logs', token, {
        method: 'POST',
        body: JSON.stringify({
          date: today,
          symptomsJson,
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
    }
  };

  // ─── Saved confirmation screen ────────────────────────
  if (saved) {
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
            {selectedSymptoms.size} symptom{selectedSymptoms.size !== 1 ? 's' : ''}
            {severity ? ` · ${severity}` : ''}
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

  // ─── Main logging UI ─────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.back(); }}
            scaleDown={0.95}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>✕ Close</Text>
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Log a symptom</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Symptoms (required) ────────────── */}
          <Text style={styles.sectionLabel}>What's bothering you?</Text>
          <View style={styles.pillWrap}>
            {SYMPTOM_LIST.map((s) => {
              const selected = selectedSymptoms.has(s.key);
              return (
                <AnimatedPressable
                  key={s.key}
                  onPress={() => toggleSymptom(s.key)}
                  scaleDown={0.95}
                  style={[styles.symptomPill, selected && styles.symptomPillActive]}
                >
                  <Text style={[styles.symptomPillText, selected && styles.symptomPillTextActive]}>
                    {s.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          {/* ─── Severity (appears when symptoms selected) ─ */}
          {selectedSymptoms.size > 0 && (
            <>
              <Text style={styles.sectionLabel}>How bad?</Text>
              <View style={styles.severityRow}>
                {SEVERITY_OPTIONS.map((sev) => {
                  const active = severity === sev.key;
                  return (
                    <AnimatedPressable
                      key={sev.key}
                      onPress={() => { hapticSelection(); setSeverity(sev.key); }}
                      scaleDown={0.97}
                      style={[
                        styles.severityCard,
                        active
                          ? { backgroundColor: sev.colors.bg, borderColor: sev.colors.border }
                          : { backgroundColor: '#f5f5f4', borderColor: '#f5f5f4' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityLabel,
                          { color: active ? sev.colors.text : '#1c1917' },
                        ]}
                      >
                        {sev.label}
                      </Text>
                      <Text
                        style={[
                          styles.severityDesc,
                          { color: active ? sev.colors.descText : '#a8a29e' },
                        ]}
                      >
                        {sev.desc}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {/* Divider */}
              <View style={styles.divider} />
            </>
          )}

          {/* ─── Mood (optional) ────────────────── */}
          <Text style={styles.sectionLabel}>
            Mood <Text style={styles.optionalTag}>· optional</Text>
          </Text>
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

          {/* ─── Triggers (optional) ────────────── */}
          <Text style={styles.sectionLabel}>
            Triggers <Text style={styles.optionalTag}>· optional</Text>
          </Text>
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

          {/* ─── Note (optional) ────────────────── */}
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Anything else? (optional)"
            placeholderTextColor="#a8a29e"
            style={styles.noteInput}
            multiline={false}
            returnKeyType="done"
          />
        </ScrollView>

        {/* ─── Save button ────────────────────── */}
        <View style={styles.saveBar}>
          <AnimatedPressable
            onPress={handleSave}
            scaleDown={0.97}
            style={[
              styles.saveButton,
              selectedSymptoms.size === 0 && styles.saveButtonDisabled,
            ]}
          >
            <Text style={[styles.saveButtonText, selectedSymptoms.size === 0 && styles.saveButtonTextDisabled]}>
              {selectedSymptoms.size === 0
                ? 'Select a symptom'
                : `Save · ${selectedSymptoms.size} symptom${selectedSymptoms.size !== 1 ? 's' : ''}`}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: { paddingVertical: 4 },
  closeText: { fontSize: 13, color: '#a8a29e' },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#1c1917' },

  // Scroll content
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },

  // Section labels
  sectionLabel: { fontSize: 13, fontWeight: '500', color: '#44403c', marginBottom: 8, marginTop: 4 },
  optionalTag: { fontWeight: '400', color: '#d6d3d1' },

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

  // Severity cards
  severityRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  severityCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  severityLabel: { fontSize: 14, fontWeight: '600' },
  severityDesc: { fontSize: 11, marginTop: 2 },

  // Divider
  divider: { height: 1, backgroundColor: '#f5f5f4', marginVertical: 12 },

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
    marginTop: 4,
    marginBottom: 8,
  },

  // Save bar
  saveBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
  saveButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#e7e5e4' },
  saveButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  saveButtonTextDisabled: { color: '#a8a29e' },

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

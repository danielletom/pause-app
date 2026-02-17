import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight, hapticSuccess, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ─── Data ──────────────────────────────────────────── */

function toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }

const FLOWS = [
  { id: 'spotting', emoji: '•', label: 'Spotting', desc: 'Light spots only' },
  { id: 'light', emoji: '💧', label: 'Light', desc: 'Pad/liner enough' },
  { id: 'medium', emoji: '💧💧', label: 'Medium', desc: 'Regular flow' },
  { id: 'heavy', emoji: '💧💧💧', label: 'Heavy', desc: 'Changing often' },
  { id: 'very_heavy', emoji: '⚠', label: 'Very heavy', desc: 'Soaking through' },
];

const SYMPTOMS = [
  { id: 'cramps', emoji: '😣', label: 'Cramps' },
  { id: 'back_pain', emoji: '🔙', label: 'Back pain' },
  { id: 'headache', emoji: '🤕', label: 'Headache' },
  { id: 'bloating', emoji: '🫧', label: 'Bloating' },
  { id: 'breast_tender', emoji: '💗', label: 'Breast tenderness' },
  { id: 'fatigue', emoji: '😴', label: 'Fatigue' },
  { id: 'mood_swings', emoji: '🎭', label: 'Mood swings' },
  { id: 'irritability', emoji: '😤', label: 'Irritability' },
  { id: 'nausea', emoji: '🤢', label: 'Nausea' },
  { id: 'hot_flash', emoji: '🔥', label: 'Hot flash' },
  { id: 'acne', emoji: '😶', label: 'Skin breakout' },
  { id: 'insomnia', emoji: '🌙', label: 'Sleep issues' },
];

const MOODS = [
  { id: 'good', emoji: '😊', label: 'Good' },
  { id: 'ok', emoji: '😐', label: 'Okay' },
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
  { id: 'tearful', emoji: '😢', label: 'Tearful' },
];

export default function PeriodLogScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [step, setStep] = useState(0); // 0=when, 1=flow, 2=symptoms, 3=done
  const [saving, setSaving] = useState(false);

  // Step 0: When
  const [isEnd, setIsEnd] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);

  // Step 1: Flow
  const [flow, setFlow] = useState<string | null>(null);
  const [clotting, setClotting] = useState(false);

  // Step 2: Symptoms
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);

  // Build week days for picker
  const today = new Date();
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weekDays.push({
      dateStr: toDateStr(d),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
      num: d.getDate(),
      isToday: i === 0,
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  const toggleSymptom = (id: string) => {
    hapticSelection();
    setSelectedSymptoms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!startDate) return;
    setSaving(true);
    try {
      const token = await getTokenRef.current();
      await apiRequest('/api/period/events', token, {
        method: 'POST',
        body: JSON.stringify({
          type: isEnd ? 'period_end' : 'period_start',
          eventDate: startDate,
          flowIntensity: flow,
          hasClotting: clotting,
          symptoms: selectedSymptoms,
          mood,
        }),
      });
      hapticSuccess();
      setStep(3);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to log period');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Step 3: Done */}
      {step === 3 ? (
        <View style={styles.doneContainer}>
          <View style={styles.doneCircle}>
            <Text style={{ fontSize: 24, color: '#f43f5e' }}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>Period logged</Text>
          <Text style={styles.doneSub}>
            {weekDays.find(d => d.dateStr === startDate)?.label || startDate} · {FLOWS.find(f => f.id === flow)?.label || '—'} flow · {selectedSymptoms.length} symptoms
          </Text>
          <Text style={styles.doneMuted}>Your period has been recorded</Text>

          <View style={styles.doneCards}>
            <View style={[styles.card, { borderColor: '#fecdd3' }]}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ color: '#f43f5e' }}>✦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>Cycle update</Text>
                  <Text style={styles.insightBody}>
                    Your cycle data has been updated. Check insights for patterns as you log more periods.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.doneButtons}>
            <AnimatedPressable
              onPress={() => { hapticMedium(); router.replace('/(app)/period-tracker'); }}
              scaleDown={0.97}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Back to tracker</Text>
            </AnimatedPressable>
          </View>
        </View>
      ) : (
        <>
          {/* Progress & Back */}
          <View style={styles.topBar}>
            <AnimatedPressable
              onPress={() => {
                hapticLight();
                if (step === 0) router.back();
                else setStep(step - 1);
              }}
              scaleDown={0.97}
            >
              <Text style={styles.backBtn}>← Back</Text>
            </AnimatedPressable>
            <View style={styles.progressRow}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.progressBar, { backgroundColor: i <= step ? '#f43f5e' : '#e7e5e4' }]} />
              ))}
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Step 0: When */}
            {step === 0 && (
              <>
                {/* Start/End toggle */}
                <View style={styles.toggleRow}>
                  <AnimatedPressable
                    onPress={() => { hapticSelection(); setIsEnd(false); }}
                    scaleDown={0.97}
                    style={[styles.toggleBtn, !isEnd && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleBtnText, !isEnd && styles.toggleBtnTextActive]}>Period started</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => { hapticSelection(); setIsEnd(true); }}
                    scaleDown={0.97}
                    style={[styles.toggleBtn, isEnd && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleBtnText, isEnd && styles.toggleBtnTextActive]}>Period ended</Text>
                  </AnimatedPressable>
                </View>

                <Text style={styles.stepTitle}>{isEnd ? 'When did it end?' : 'When did it start?'}</Text>
                <Text style={styles.stepSub}>{isEnd ? 'Select the last day of bleeding' : 'Select the first day of bleeding'}</Text>

                {/* Day picker */}
                <View style={styles.dayPickerRow}>
                  {weekDays.map(d => (
                    <AnimatedPressable
                      key={d.dateStr}
                      onPress={() => { hapticSelection(); setStartDate(d.dateStr); }}
                      scaleDown={0.95}
                      style={[styles.dayPickerItem, startDate === d.dateStr && styles.dayPickerItemSelected]}
                    >
                      <Text style={styles.dayPickerDay}>{d.day}</Text>
                      <Text style={[styles.dayPickerNum, startDate === d.dateStr && { color: '#e11d48' }]}>{d.num}</Text>
                      {d.isToday && <Text style={styles.dayPickerToday}>today</Text>}
                    </AnimatedPressable>
                  ))}
                </View>

                {/* Quick options */}
                <View style={{ gap: 8, marginTop: 16 }}>
                  {weekDays.slice(-2).reverse().map(d => (
                    <AnimatedPressable
                      key={d.dateStr}
                      onPress={() => { hapticSelection(); setStartDate(d.dateStr); }}
                      scaleDown={0.97}
                      style={[styles.quickOption, startDate === d.dateStr && { borderColor: '#f43f5e' }]}
                    >
                      <View style={[styles.quickOptionIcon, startDate === d.dateStr && { backgroundColor: '#ffe4e6' }]}>
                        <Text style={{ fontSize: 10, color: startDate === d.dateStr ? '#f43f5e' : '#a8a29e' }}>
                          {d.isToday ? 'T' : 'Y'}
                        </Text>
                      </View>
                      <Text style={styles.quickOptionLabel}>{d.label}, {d.day} {d.num}</Text>
                      {startDate === d.dateStr && <Text style={{ color: '#f43f5e' }}>✓</Text>}
                    </AnimatedPressable>
                  ))}
                </View>
              </>
            )}

            {/* Step 1: Flow */}
            {step === 1 && (
              <>
                <Text style={styles.stepTitle}>How's the flow?</Text>
                <Text style={styles.stepSub}>Select what best describes today</Text>

                <View style={{ gap: 8 }}>
                  {FLOWS.map(f => (
                    <AnimatedPressable
                      key={f.id}
                      onPress={() => { hapticSelection(); setFlow(f.id); }}
                      scaleDown={0.97}
                      style={[styles.flowOption, flow === f.id && styles.flowOptionSelected]}
                    >
                      <Text style={{ fontSize: 16, width: 32, textAlign: 'center' }}>{f.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.flowLabel, flow === f.id && { color: '#be123c' }]}>{f.label}</Text>
                        <Text style={styles.flowDesc}>{f.desc}</Text>
                      </View>
                      {flow === f.id && <Text style={{ color: '#f43f5e' }}>✓</Text>}
                    </AnimatedPressable>
                  ))}
                </View>

                {/* Clotting toggle */}
                <View style={[styles.card, { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#44403c' }}>Clotting?</Text>
                    <Text style={{ fontSize: 12, color: '#a8a29e' }}>Blood clots larger than a small coin</Text>
                  </View>
                  <AnimatedPressable
                    onPress={() => { hapticSelection(); setClotting(!clotting); }}
                    scaleDown={0.95}
                    style={[styles.toggleSwitch, clotting && styles.toggleSwitchOn]}
                  >
                    <View style={[styles.toggleThumb, clotting && styles.toggleThumbOn]} />
                  </AnimatedPressable>
                </View>

                {/* Heavy flow warning */}
                {(flow === 'very_heavy' || (flow === 'heavy' && clotting)) && (
                  <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a', marginTop: 8 }]}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Text>⚠</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightTitle}>Worth mentioning to your GP</Text>
                        <Text style={styles.insightBody}>
                          Very heavy flow or large clots in perimenopause can be normal, but it's worth checking with your doctor.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Step 2: Symptoms */}
            {step === 2 && (
              <>
                <Text style={styles.stepTitle}>How are you feeling?</Text>
                <Text style={styles.stepSub}>Select any that apply · all optional</Text>

                <Text style={styles.sectionLabel}>Symptoms</Text>
                <View style={styles.symptomGrid}>
                  {SYMPTOMS.map(s => (
                    <AnimatedPressable
                      key={s.id}
                      onPress={() => toggleSymptom(s.id)}
                      scaleDown={0.95}
                      style={[styles.symptomItem, selectedSymptoms.includes(s.id) && styles.symptomItemSelected]}
                    >
                      <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                      <Text style={[styles.symptomLabel, selectedSymptoms.includes(s.id) && { color: '#be123c' }]}>{s.label}</Text>
                    </AnimatedPressable>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Overall mood</Text>
                <View style={styles.moodRow}>
                  {MOODS.map(m => (
                    <AnimatedPressable
                      key={m.id}
                      onPress={() => { hapticSelection(); setMood(m.id); }}
                      scaleDown={0.95}
                      style={[styles.moodItem, mood === m.id && styles.moodItemSelected]}
                    >
                      <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                      <Text style={styles.moodLabel}>{m.label}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Bottom CTA */}
          <View style={styles.bottomBar}>
            {step === 2 ? (
              <View style={{ gap: 8 }}>
                <AnimatedPressable
                  onPress={() => { hapticMedium(); handleSave(); }}
                  scaleDown={0.97}
                  style={styles.primaryBtn}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save log</Text>
                  )}
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => { hapticLight(); handleSave(); }}
                  scaleDown={0.97}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostBtnText}>Skip symptoms</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <AnimatedPressable
                onPress={() => {
                  if (step === 0 && !startDate) return;
                  hapticMedium();
                  setStep(step + 1);
                }}
                scaleDown={0.97}
                style={[styles.primaryBtn, step === 0 && !startDate && styles.primaryBtnDisabled]}
                disabled={step === 0 && !startDate}
              >
                <Text style={[styles.primaryBtnText, step === 0 && !startDate && { color: '#a8a29e' }]}>
                  {step === 0
                    ? startDate ? 'Next → Flow intensity' : 'Select a date'
                    : flow ? 'Next → Symptoms' : 'Select flow level'
                  }
                </Text>
              </AnimatedPressable>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  backBtn: { fontSize: 12, color: '#a8a29e' },
  progressRow: { flex: 1, flexDirection: 'row', gap: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },

  toggleRow: { flexDirection: 'row', backgroundColor: '#f5f5f4', borderRadius: 12, padding: 3, marginBottom: 20, marginTop: 12 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleBtnText: { fontSize: 12, fontWeight: '500', color: '#a8a29e' },
  toggleBtnTextActive: { color: '#1c1917' },

  stepTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  stepSub: { fontSize: 12, color: '#a8a29e', marginBottom: 20 },

  dayPickerRow: { flexDirection: 'row', gap: 4 },
  dayPickerItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    borderWidth: 2, borderColor: '#f5f5f4',
  },
  dayPickerItemSelected: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  dayPickerDay: { fontSize: 10, color: '#a8a29e' },
  dayPickerNum: { fontSize: 14, fontWeight: '600', color: '#44403c', marginTop: 2 },
  dayPickerToday: { fontSize: 8, color: '#d6d3d1', marginTop: 2 },

  quickOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, borderColor: '#f5f5f4', backgroundColor: '#ffffff',
  },
  quickOptionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f4', alignItems: 'center', justifyContent: 'center' },
  quickOptionLabel: { flex: 1, fontSize: 14, color: '#44403c' },

  flowOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 16, borderWidth: 2, borderColor: '#f5f5f4',
  },
  flowOptionSelected: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  flowLabel: { fontSize: 14, fontWeight: '500', color: '#44403c' },
  flowDesc: { fontSize: 12, color: '#a8a29e', marginTop: 1 },

  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f5f5f4',
  },
  insightTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  insightBody: { fontSize: 12, color: '#78716c', lineHeight: 18 },

  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#e7e5e4', justifyContent: 'center', padding: 2 },
  toggleSwitchOn: { backgroundColor: '#f43f5e' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#57534e', marginBottom: 8 },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomItem: {
    width: '31%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6,
    borderRadius: 16, borderWidth: 2, borderColor: '#f5f5f4', gap: 4,
  },
  symptomItemSelected: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  symptomLabel: { fontSize: 10, fontWeight: '500', color: '#78716c', textAlign: 'center' },

  moodRow: { flexDirection: 'row', gap: 6 },
  moodItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16,
    borderWidth: 2, borderColor: '#f5f5f4', gap: 4,
  },
  moodItemSelected: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  moodLabel: { fontSize: 10, color: '#78716c' },

  bottomBar: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12 },
  primaryBtn: { backgroundColor: '#f43f5e', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  primaryBtnDisabled: { backgroundColor: '#e7e5e4' },
  ghostBtn: { paddingVertical: 10, alignItems: 'center' },
  ghostBtnText: { fontSize: 13, color: '#a8a29e', textDecorationLine: 'underline' },

  // Done state
  doneContainer: { flex: 1, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffe4e6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneTitle: { fontSize: 20, fontWeight: '700', color: '#1c1917', marginBottom: 6 },
  doneSub: { fontSize: 14, color: '#78716c', textAlign: 'center', marginBottom: 4 },
  doneMuted: { fontSize: 12, color: '#d6d3d1', marginBottom: 24 },
  doneCards: { width: '100%', gap: 8, marginBottom: 24 },
  doneButtons: { width: '100%', gap: 8 },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from '@/components/AnimatedPressable';
import SeveritySlider from '@/components/SeveritySlider';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';

// ── Data ──

const ALL_SYMPTOMS = [
  { key: 'hotFlashes', label: 'Hot flashes', color: '#ef4444' },
  { key: 'nightSweats', label: 'Night sweats', color: '#f97316' },
  { key: 'sleepIssues', label: 'Sleep issues', color: '#6366f1' },
  { key: 'moodChanges', label: 'Mood changes', color: '#ec4899' },
  { key: 'anxiety', label: 'Anxiety', color: '#8b5cf6' },
  { key: 'brainFog', label: 'Brain fog', color: '#0ea5e9' },
  { key: 'fatigue', label: 'Fatigue', color: '#d97706' },
  { key: 'jointPain', label: 'Joint pain', color: '#059669' },
  { key: 'weightChanges', label: 'Weight changes', color: '#78716c' },
  { key: 'lowLibido', label: 'Low libido', color: '#e11d48' },
  { key: 'vaginalDryness', label: 'Vaginal dryness', color: '#be185d' },
  { key: 'heartPalpitations', label: 'Heart palpitations', color: '#dc2626' },
  { key: 'headaches', label: 'Headaches', color: '#7c3aed' },
  { key: 'bloating', label: 'Bloating', color: '#ca8a04' },
];

const MOODS = [
  { emoji: '😫', label: 'Awful', value: 1 },
  { emoji: '😔', label: 'Low', value: 2 },
  { emoji: '😐', label: 'Okay', value: 3 },
  { emoji: '🙂', label: 'Good', value: 4 },
  { emoji: '😊', label: 'Great', value: 5 },
];

const ENERGY_LEVELS = [
  { emoji: '🪫', label: 'Drained', value: 1 },
  { emoji: '😴', label: 'Low', value: 2 },
  { emoji: '⚡', label: 'Normal', value: 3 },
  { emoji: '💪', label: 'High', value: 4 },
  { emoji: '🔥', label: 'Energized', value: 5 },
];

const SLEEP_HOURS = [3, 4, 5, 6, 7, 8, 9, 10, 11];
const SLEEP_QUALITY = ['Terrible', 'Poor', 'Fair', 'Good', 'Great'];
const DISRUPTIONS = [0, 1, 2, 3, 4, 5];

const CONTEXT_TAGS = [
  { key: 'exercise', label: 'Exercise', icon: 'fitness-outline' as const },
  { key: 'alcohol', label: 'Alcohol', icon: 'wine-outline' as const },
  { key: 'stress', label: 'Stress', icon: 'thunderstorm-outline' as const },
  { key: 'caffeine', label: 'Caffeine', icon: 'cafe-outline' as const },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' as const },
  { key: 'social', label: 'Social', icon: 'people-outline' as const },
  { key: 'outdoors', label: 'Outdoors', icon: 'sunny-outline' as const },
  { key: 'meditation', label: 'Meditation', icon: 'leaf-outline' as const },
  { key: 'hydrated', label: 'Hydrated', icon: 'water-outline' as const },
  { key: 'junkFood', label: 'Junk food', icon: 'fast-food-outline' as const },
];

const FLOW_LEVELS = ['None', 'Spotting', 'Light', 'Medium', 'Heavy'];

type TabKey = 'body' | 'mood' | 'sleep' | 'context' | 'cycle';

interface TabDef {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function DetailedLogScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const logDate = dateParam || new Date().toISOString().split('T')[0];
  const { profile } = useProfile();
  const [saving, setSaving] = useState(false);

  // Determine available tabs — Cycle only for perimenopause
  const showCycleTab = profile?.stage === 'peri';
  const tabs: TabDef[] = [
    { key: 'body', label: 'Body', icon: 'body-outline' },
    { key: 'mood', label: 'Mood', icon: 'happy-outline' },
    { key: 'sleep', label: 'Sleep', icon: 'moon-outline' },
    { key: 'context', label: 'Context', icon: 'layers-outline' },
    ...(showCycleTab
      ? [{ key: 'cycle' as TabKey, label: 'Cycle', icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap }]
      : []),
  ];

  const [activeTab, setActiveTab] = useState<TabKey>('body');

  // ── State ──
  const [symptoms, setSymptoms] = useState<Record<string, number>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [moodNotes, setMoodNotes] = useState('');
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<string | null>(null);
  const [disruptions, setDisruptions] = useState<number | null>(null);
  const [contextTags, setContextTags] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [flow, setFlow] = useState<string | null>(null);
  const [periodDay, setPeriodDay] = useState<number | null>(null);

  const toggleContext = (tag: string) => {
    hapticLight();
    setContextTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      await apiRequest('/api/logs', token, {
        method: 'POST',
        body: JSON.stringify({
          date: logDate,
          symptoms,
          mood,
          energy,
          sleepHours,
          sleepQuality,
          disruptions,
          contextTags: Array.from(contextTags),
          cycleData: showCycleTab ? { flow, periodDay } : undefined,
          notes: [moodNotes, notes].filter(Boolean).join('\n'),
        }),
      });
      hapticSuccess();
      Alert.alert('Saved!', 'Your detailed log has been recorded.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save log');
    } finally {
      setSaving(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'body':
        return (
          <View>
            <Text style={styles.sectionHeading}>Symptom severity</Text>
            <Text style={styles.sectionSub}>Rate each symptom you experienced today</Text>
            {ALL_SYMPTOMS.map((s) => (
              <SeveritySlider
                key={s.key}
                label={s.label}
                value={symptoms[s.key] || 0}
                onValueChange={(v) =>
                  setSymptoms((prev) => ({ ...prev, [s.key]: v }))
                }
                color={s.color}
              />
            ))}
          </View>
        );

      case 'mood':
        return (
          <View>
            <Text style={styles.sectionHeading}>Mood</Text>
            <View style={styles.emojiRow}>
              {MOODS.map((m) => (
                <AnimatedPressable
                  key={m.value}
                  onPress={() => { hapticSelection(); setMood(m.value); }}
                  scaleDown={0.9}
                  style={[styles.emojiBtn, mood === m.value && styles.emojiBtnActive]}
                >
                  <Text style={styles.emoji}>{m.emoji}</Text>
                  <Text style={[styles.emojiLabel, mood === m.value && styles.emojiLabelActive]}>
                    {m.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 28 }]}>Energy</Text>
            <View style={styles.emojiRow}>
              {ENERGY_LEVELS.map((e) => (
                <AnimatedPressable
                  key={e.value}
                  onPress={() => { hapticSelection(); setEnergy(e.value); }}
                  scaleDown={0.9}
                  style={[styles.emojiBtn, energy === e.value && styles.emojiBtnActive]}
                >
                  <Text style={styles.emoji}>{e.emoji}</Text>
                  <Text style={[styles.emojiLabel, energy === e.value && styles.emojiLabelActive]}>
                    {e.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 28 }]}>Notes</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Anything on your mind today..."
              placeholderTextColor="#d6d3d1"
              multiline
              value={moodNotes}
              onChangeText={setMoodNotes}
            />
          </View>
        );

      case 'sleep':
        return (
          <View>
            <Text style={styles.sectionHeading}>Hours of sleep</Text>
            <View style={styles.pillRow}>
              {SLEEP_HOURS.map((h) => (
                <AnimatedPressable
                  key={h}
                  onPress={() => { hapticSelection(); setSleepHours(h); }}
                  scaleDown={0.93}
                  style={[styles.pill, sleepHours === h && styles.pillActive]}
                >
                  <Text style={[styles.pillText, sleepHours === h && styles.pillTextActive]}>
                    {h}h
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Sleep quality</Text>
            <View style={styles.pillRow}>
              {SLEEP_QUALITY.map((q) => (
                <AnimatedPressable
                  key={q}
                  onPress={() => { hapticSelection(); setSleepQuality(q); }}
                  scaleDown={0.93}
                  style={[styles.pill, sleepQuality === q && styles.pillActive]}
                >
                  <Text style={[styles.pillText, sleepQuality === q && styles.pillTextActive]}>
                    {q}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Night disruptions</Text>
            <Text style={styles.sectionSub}>How many times did you wake up?</Text>
            <View style={styles.pillRow}>
              {DISRUPTIONS.map((d) => (
                <AnimatedPressable
                  key={d}
                  onPress={() => { hapticSelection(); setDisruptions(d); }}
                  scaleDown={0.93}
                  style={[styles.pill, disruptions === d && styles.pillActive]}
                >
                  <Text style={[styles.pillText, disruptions === d && styles.pillTextActive]}>
                    {d === 5 ? '5+' : String(d)}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        );

      case 'context':
        return (
          <View>
            <Text style={styles.sectionHeading}>What happened today?</Text>
            <Text style={styles.sectionSub}>Select all that apply</Text>
            <View style={styles.tagGrid}>
              {CONTEXT_TAGS.map((t) => (
                <AnimatedPressable
                  key={t.key}
                  onPress={() => toggleContext(t.key)}
                  scaleDown={0.93}
                  style={[styles.tagChip, contextTags.has(t.key) && styles.tagChipActive]}
                >
                  <Ionicons
                    name={t.icon}
                    size={18}
                    color={contextTags.has(t.key) ? '#fff' : '#78716c'}
                  />
                  <Text
                    style={[styles.tagText, contextTags.has(t.key) && styles.tagTextActive]}
                  >
                    {t.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 28 }]}>Additional notes</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Anything else to note..."
              placeholderTextColor="#d6d3d1"
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        );

      case 'cycle':
        return (
          <View>
            <Text style={styles.sectionHeading}>Period tracking</Text>
            <Text style={styles.sectionSub}>
              Track your cycle to help identify patterns
            </Text>

            <Text style={[styles.sectionHeading, { marginTop: 16, fontSize: 16 }]}>
              Flow level
            </Text>
            <View style={styles.pillRow}>
              {FLOW_LEVELS.map((f) => (
                <AnimatedPressable
                  key={f}
                  onPress={() => { hapticSelection(); setFlow(f); }}
                  scaleDown={0.93}
                  style={[styles.pill, flow === f && styles.pillActive]}
                >
                  <Text style={[styles.pillText, flow === f && styles.pillTextActive]}>
                    {f}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 24, fontSize: 16 }]}>
              Cycle day
            </Text>
            <Text style={styles.sectionSub}>What day of your cycle is it?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
                {Array.from({ length: 35 }, (_, i) => i + 1).map((d) => (
                  <AnimatedPressable
                    key={d}
                    onPress={() => { hapticSelection(); setPeriodDay(d); }}
                    scaleDown={0.93}
                    style={[styles.pill, periodDay === d && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, periodDay === d && styles.pillTextActive]}>
                      {d}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Nav */}
      <View style={styles.nav}>
        <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.9} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={22} color="#1c1917" />
        </AnimatedPressable>
        <Text style={styles.navTitle}>Detailed Log</Text>
        <View style={styles.navBtn} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {tabs.map((tab) => (
            <AnimatedPressable
              key={tab.key}
              onPress={() => { hapticLight(); setActiveTab(tab.key); }}
              scaleDown={0.95}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? '#ffffff' : '#78716c'}
              />
              <Text
                style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderTabContent()}
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <AnimatedPressable
          onPress={() => { hapticMedium(); handleSubmit(); }}
          scaleDown={0.96}
          style={styles.saveBtn}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Log</Text>
          )}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: '#1c1917' },

  // Tabs
  tabBar: { borderBottomWidth: 1, borderBottomColor: '#f5f5f4' },
  tabScroll: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  tabActive: { backgroundColor: '#1c1917' },
  tabLabel: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  tabLabelActive: { color: '#ffffff' },

  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },

  sectionHeading: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#a8a29e', marginBottom: 16 },

  // Emoji
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  emojiBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  emojiBtnActive: { backgroundColor: '#1c1917' },
  emoji: { fontSize: 28, marginBottom: 4 },
  emojiLabel: { fontSize: 11, fontWeight: '500', color: '#78716c' },
  emojiLabelActive: { color: '#ffffff' },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  pillActive: { backgroundColor: '#1c1917' },
  pillText: { fontSize: 14, fontWeight: '500', color: '#44403c' },
  pillTextActive: { color: '#ffffff' },

  // Tags
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  tagChipActive: { backgroundColor: '#1c1917' },
  tagText: { fontSize: 13, fontWeight: '500', color: '#44403c' },
  tagTextActive: { color: '#ffffff' },

  // Text input
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: '#1c1917',
    minHeight: 80,
    textAlignVertical: 'top',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },

  // Footer
  footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  saveBtn: {
    backgroundColor: '#1c1917', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});

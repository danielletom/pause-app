import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Animated as RNAnimated,
  Keyboard,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';

/* ─── Constants ──────────────────────────────────────── */

const MORNING_STEPS = ['Sleep', 'Body', 'Mood', "What's Ahead", 'Gratitude'];
const EVENING_STEPS = ['Your Day', 'Body', 'Activity', 'Highlight'];

const SLEEP_QUALITY = [
  { val: 'terrible', emoji: '😫', label: 'Terrible', sublabel: 'Could barely sleep' },
  { val: 'poor', emoji: '😕', label: 'Poor', sublabel: 'Restless, woke a lot' },
  { val: 'ok', emoji: '😐', label: 'Okay', sublabel: 'Some disruption' },
  { val: 'good', emoji: '😊', label: 'Good', sublabel: 'Mostly restful' },
  { val: 'amazing', emoji: '🥰', label: 'Amazing', sublabel: 'Felt fully rested' },
];

const SLEEP_DISRUPTIONS = [
  { key: 'hot_flash', label: 'Hot flash', emoji: '🔥' },
  { key: 'night_sweats', label: 'Night sweats', emoji: '💦' },
  { key: 'bathroom', label: 'Bathroom', emoji: '🚽' },
  { key: 'racing_mind', label: 'Racing mind', emoji: '🧠' },
  { key: 'pain', label: 'Pain', emoji: '💢' },
  { key: 'partner', label: 'Partner', emoji: '👤' },
];

const SYMPTOM_LIST = [
  { key: 'hot_flash', label: 'Hot flashes', emoji: '🔥' },
  { key: 'brain_fog', label: 'Brain fog', emoji: '😶‍🌫️' },
  { key: 'irritability', label: 'Irritability', emoji: '😤' },
  { key: 'joint_pain', label: 'Joint pain', emoji: '💪' },
  { key: 'anxiety', label: 'Anxiety', emoji: '😰' },
  { key: 'fatigue', label: 'Fatigue', emoji: '😩' },
  { key: 'nausea', label: 'Nausea', emoji: '🤢' },
  { key: 'heart_racing', label: 'Heart racing', emoji: '💓' },
  { key: 'feeling_good', label: 'Feeling good', emoji: '🌟' },
  { key: 'headache', label: 'Headache', emoji: '🤕' },
  { key: 'night_sweats', label: 'Night sweats', emoji: '💦' },
];

const SEVERITY_OPTIONS = [
  { val: 1, label: 'Mild' },
  { val: 2, label: 'Moderate' },
  { val: 3, label: 'Severe' },
];

const ENERGY_LEVELS = [
  { val: 1, label: 'Low', emoji: '🪫' },
  { val: 2, label: 'Medium', emoji: '😐' },
  { val: 3, label: 'High', emoji: '⚡' },
];

const STRESSOR_PILLS = [
  { key: 'busy_workday', label: 'Busy workday', emoji: '💼' },
  { key: 'family', label: 'Family obligations', emoji: '👨‍👩‍👧' },
  { key: 'doctor', label: 'Doctor appointment', emoji: '🏥' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'social', label: 'Social event', emoji: '🎉' },
  { key: 'quiet', label: 'Quiet day', emoji: '😌' },
  { key: 'exercise', label: 'Exercise planned', emoji: '🏋️' },
  { key: 'stressful', label: 'Something stressful', emoji: '😰' },
];

const GRATITUDE_PROMPTS = [
  'The warmth of my morning coffee ☕',
  'A friend who checked in on me 💛',
  'My body carrying me through yesterday 🙏',
  'A moment of quiet this morning 🌅',
  'Something that made me smile recently 😊',
];

const MOODS_5 = [
  { val: 1, emoji: '😔', label: 'Rough' },
  { val: 2, emoji: '😕', label: 'Meh' },
  { val: 3, emoji: '🙂', label: 'Okay' },
  { val: 4, emoji: '😊', label: 'Good' },
  { val: 5, emoji: '✨', label: 'Great' },
];

const MOOD_PILLS = [
  { key: 'calm', label: 'Calm', emoji: '😌' },
  { key: 'irritable', label: 'Irritable', emoji: '😤' },
  { key: 'anxious', label: 'Anxious', emoji: '😰' },
  { key: 'emotional', label: 'Emotional', emoji: '😢' },
  { key: 'happy', label: 'Happy', emoji: '😊' },
  { key: 'numb', label: 'Numb', emoji: '😶' },
  { key: 'strong', label: 'Strong', emoji: '💪' },
  { key: 'exhausted', label: 'Exhausted', emoji: '😩' },
  { key: 'grateful', label: 'Grateful', emoji: '🥰' },
  { key: 'low', label: 'Low', emoji: '😔' },
];

const COMPARISON_OPTIONS = [
  { val: 'better', label: 'Better', emoji: '📈' },
  { val: 'same', label: 'Same', emoji: '➡️' },
  { val: 'worse', label: 'Worse', emoji: '📉' },
];

const ACTIVITY_PILLS = [
  { key: 'worked', label: 'Worked', emoji: '💼' },
  { key: 'exercised', label: 'Exercised', emoji: '🏃‍♀️' },
  { key: 'friends', label: 'Saw friends', emoji: '👫' },
  { key: 'family_time', label: 'Family time', emoji: '👨‍👩‍👧' },
  { key: 'stayed_home', label: 'Stayed home', emoji: '🏠' },
  { key: 'errands', label: 'Errands', emoji: '🛍️' },
  { key: 'reading', label: 'Read/learned', emoji: '📚' },
  { key: 'meditated', label: 'Meditated', emoji: '🧘' },
  { key: 'outdoors', label: 'Time outdoors', emoji: '🌿' },
  { key: 'creative', label: 'Creative hobby', emoji: '🎨' },
];

const SUBSTANCE_PILLS = [
  { key: 'caffeine', label: 'Caffeine', emoji: '☕' },
  { key: 'alcohol', label: 'Alcohol', emoji: '🍷' },
  { key: 'sugar', label: 'Sugar/sweets', emoji: '🍫' },
  { key: 'spicy', label: 'Spicy food', emoji: '🌶️' },
  { key: 'took_meds', label: 'Took my meds', emoji: '💊' },
  { key: 'hydrated', label: 'Hydrated well', emoji: '💧' },
];

const HIGHLIGHT_PROMPTS = [
  'A moment of peace 🌊',
  'Something that made me laugh 😂',
  'A small victory today 🏆',
  'A connection with someone 💛',
  'Something I did just for me ✨',
];

const DAILY_QUOTES = [
  { text: 'Every day you show up for yourself is a victory.', author: 'You' },
  { text: 'Your body is doing something extraordinary. Honor it.', author: 'Pause' },
  { text: "Progress isn't always linear, but you're moving forward.", author: 'Pause' },
  { text: 'Small steps today, big clarity tomorrow.', author: 'Pause' },
  { text: "You're not just surviving this — you're understanding it.", author: 'Pause' },
  { text: 'Knowledge is power. Tracking is the first step.', author: 'Pause' },
  { text: 'Be gentle with yourself today. You deserve it.', author: 'Pause' },
  { text: 'The woman who tracks her health transforms her health.', author: 'Pause' },
  { text: "You're building a picture only you can see. Keep going.", author: 'Pause' },
  { text: 'This chapter is yours to write. One check-in at a time.', author: 'Pause' },
  { text: 'Consistency beats perfection, every single time.', author: 'Pause' },
  { text: 'Your future self will thank you for logging today.', author: 'Pause' },
  { text: "Midlife isn't a crisis — it's a comeback.", author: 'Pause' },
  { text: 'The best time to start was yesterday. The next best time is now.', author: 'Pause' },
];

function getQuoteOfDay(): { text: string; author: string } {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

/* ─── Main Screen ────────────────────────────────────── */

export default function QuickLogScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { date: dateParam, mode: modeParam, logId: logIdParam } = useLocalSearchParams<{ date?: string; mode?: string; logId?: string }>();
  const logDate = dateParam || new Date().toISOString().split('T')[0];
  const isToday = logDate === new Date().toISOString().split('T')[0];
  const mode = (modeParam === 'morning' || modeParam === 'evening') ? modeParam : 'morning';
  const isMorning = mode === 'morning';
  const STEPS = isMorning ? MORNING_STEPS : EVENING_STEPS;
  const editingLogId = logIdParam ? parseInt(logIdParam) : null;
  const [isViewMode, setIsViewMode] = useState(!!editingLogId);
  const [loadingExisting, setLoadingExisting] = useState(!!editingLogId);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const savingRef = useRef(false); // double-submit guard

  // Celebration animations
  const celebOpacity = useRef(new RNAnimated.Value(0)).current;
  const celebScale = useRef(new RNAnimated.Value(0.8)).current;
  const checkScale = useRef(new RNAnimated.Value(0)).current;
  const quoteOpacity = useRef(new RNAnimated.Value(0)).current;

  /* ── Morning state ──────────────── */
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<string | null>(null);
  const [sleepDisruptions, setSleepDisruptions] = useState<Set<string>>(new Set());

  // Body (shared morning & evening new symptoms)
  const [symptoms, setSymptoms] = useState<Record<string, number>>({}); // key → severity 1-3
  const [customSymptomText, setCustomSymptomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSymptoms, setCustomSymptoms] = useState<string[]>([]); // from profile

  // Custom disruptions
  const [customDisruptionText, setCustomDisruptionText] = useState('');
  const [showCustomDisruptionInput, setShowCustomDisruptionInput] = useState(false);
  const [customDisruptions, setCustomDisruptions] = useState<{ key: string; label: string; emoji: string }[]>([]);

  // What's Ahead
  const [energy, setEnergy] = useState<number | null>(null);
  const [stressors, setStressors] = useState<Set<string>>(new Set());
  const [customStressorText, setCustomStressorText] = useState('');
  const [showCustomStressorInput, setShowCustomStressorInput] = useState(false);
  const [customStressors, setCustomStressors] = useState<{ key: string; label: string; emoji: string }[]>([]);

  // Gratitude
  const [gratitudeText, setGratitudeText] = useState('');
  const [intentionText, setIntentionText] = useState('');

  /* ── Evening state ──────────────── */
  const [mood, setMood] = useState<number | null>(null);
  const [moodPills, setMoodPills] = useState<Set<string>>(new Set());
  const [morningLog, setMorningLog] = useState<any>(null); // morning log for callbacks

  // Evening body comparison
  const [symptomComparison, setSymptomComparison] = useState<Record<string, string>>({}); // key → 'better'|'same'|'worse'

  // Activity
  const [activities, setActivities] = useState<Set<string>>(new Set());
  const [substances, setSubstances] = useState<Set<string>>(new Set());

  // Highlight
  const [highlightText, setHighlightText] = useState('');
  const [learnedText, setLearnedText] = useState('');

  /* ── Meds state ────── */
  const [medications, setMedications] = useState<{ id: number; name: string; dose: string; time: string; type: string }[]>([]);
  const [medsTaken, setMedsTaken] = useState<Set<number>>(new Set());
  const [existingMedLogs, setExistingMedLogs] = useState<Set<number>>(new Set());

  /* ── Period tracker state ────── */
  const [periodStatus, setPeriodStatus] = useState<'none' | 'period' | 'spotting'>('none');
  const [flowIntensity, setFlowIntensity] = useState<'light' | 'medium' | 'heavy' | null>(null);

  const { profile: userProfile } = useProfile();
  const showPeriodTracker = isMorning && (
    !userProfile?.stage ||
    userProfile.stage === 'perimenopause' ||
    userProfile.stage === 'not_sure' ||
    userProfile.stage === "I'm not sure" ||
    userProfile.stage === 'Perimenopause'
  );

  /* ── Fetch profile custom symptoms + morning log + medications ── */
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const token = await getToken();
          // Fetch custom symptoms from profile
          const profile = await apiRequest('/api/profile', token).catch(() => null);
          if (profile?.customSymptoms && Array.isArray(profile.customSymptoms)) {
            setCustomSymptoms(profile.customSymptoms);
          }

          // Fetch medications
          const meds = await apiRequest('/api/meds', token).catch(() => []);
          if (Array.isArray(meds) && meds.length > 0) {
            // Filter by time-of-day: morning meds for AM, evening meds for PM
            const timeMeds = meds.filter((m: any) => {
              if (isMorning) return m.time === 'morning' || m.time === 'with_food' || m.time === 'anytime';
              return m.time === 'evening' || m.time === 'bedtime' || m.time === 'with_food' || m.time === 'anytime';
            });
            setMedications(timeMeds.length > 0 ? timeMeds : meds);

            // Fetch today's med logs to see which are already taken
            const medLogs = await apiRequest(`/api/meds/logs?date=${logDate}`, token).catch(() => []);
            if (Array.isArray(medLogs)) {
              const takenIds = new Set<number>(medLogs.filter((l: any) => l.taken).map((l: any) => l.medicationId));
              setExistingMedLogs(takenIds);
              setMedsTaken(takenIds);
            }
          }

          // For evening mode, fetch today's morning log
          if (!isMorning) {
            const today = logDate;
            const logs = await apiRequest(`/api/logs?date=${today}`, token).catch(() => []);
            const entries = Array.isArray(logs) ? logs : [];
            const am = entries.find((e: any) => e.logType === 'morning');
            if (am) setMorningLog(am);
          }
        } catch {
          // Non-critical
        }
      })();
    }, [])
  );

  /* ── Load existing log for view/edit mode ── */
  useEffect(() => {
    if (!editingLogId) return;
    (async () => {
      try {
        const token = await getToken();
        const logs = await apiRequest(`/api/logs?date=${logDate}`, token).catch(() => []);
        const entries = Array.isArray(logs) ? logs : [];
        const existingLog = entries.find((e: any) => e.id === editingLogId);
        if (!existingLog) {
          setLoadingExisting(false);
          return;
        }

        // Pre-fill common fields
        if (existingLog.mood != null) setMood(existingLog.mood);
        if (existingLog.symptomsJson && typeof existingLog.symptomsJson === 'object') {
          const syms: Record<string, number> = {};
          Object.entries(existingLog.symptomsJson).forEach(([k, v]: [string, any]) => {
            syms[k] = typeof v === 'number' ? v : 1;
          });
          setSymptoms(syms);
        }

        if (isMorning) {
          // Pre-fill morning fields
          if (existingLog.sleepHours != null) setSleepHours(existingLog.sleepHours);
          if (existingLog.sleepQuality) setSleepQuality(existingLog.sleepQuality);
          if (existingLog.energy != null) setEnergy(existingLog.energy);

          // Extract disruptions from contextTags
          const tags = existingLog.contextTags || [];
          const knownDisruptions = SLEEP_DISRUPTIONS.map(d => d.key);
          const disruptions = new Set<string>();
          tags.forEach((t: string) => {
            if (knownDisruptions.includes(t)) disruptions.add(t);
          });
          if (disruptions.size > 0) setSleepDisruptions(disruptions);

          // Extract stressors from contextTags
          const knownStressors = STRESSOR_PILLS.map(s => s.key);
          const stressorSet = new Set<string>();
          tags.forEach((t: string) => {
            const stressorPill = STRESSOR_PILLS.find(s => s.label === t);
            if (stressorPill) stressorSet.add(stressorPill.key);
            else if (knownStressors.includes(t)) stressorSet.add(t);
          });
          if (stressorSet.size > 0) setStressors(stressorSet);

          // Extract mood pills from contextTags
          const knownMoodPills = MOOD_PILLS.map(m => m.key);
          const moodSet = new Set<string>();
          tags.forEach((t: string) => {
            if (knownMoodPills.includes(t)) moodSet.add(t);
          });
          if (moodSet.size > 0) setMoodPills(moodSet);

          // Parse notes for gratitude/intention
          if (existingLog.notes) {
            try {
              const parsed = JSON.parse(existingLog.notes);
              if (parsed.grateful) setGratitudeText(parsed.grateful);
              if (parsed.intention) setIntentionText(parsed.intention);
            } catch { /* not JSON */ }
          }

          // Period data
          if (existingLog.cycleDataJson) {
            const cycle = existingLog.cycleDataJson as any;
            if (cycle.status) setPeriodStatus(cycle.status);
            if (cycle.flow) setFlowIntensity(cycle.flow);
          }
        } else {
          // Pre-fill evening fields
          const tags = existingLog.contextTags || [];

          // Extract mood pills
          const knownMoodPills = MOOD_PILLS.map(m => m.key);
          const moodSet = new Set<string>();
          tags.forEach((t: string) => {
            if (knownMoodPills.includes(t)) moodSet.add(t);
          });
          if (moodSet.size > 0) setMoodPills(moodSet);

          // Extract activities
          const actSet = new Set<string>();
          tags.forEach((t: string) => {
            const actPill = ACTIVITY_PILLS.find(a => a.label === t);
            if (actPill) actSet.add(actPill.key);
          });
          if (actSet.size > 0) setActivities(actSet);

          // Extract substances
          const subSet = new Set<string>();
          tags.forEach((t: string) => {
            const subPill = SUBSTANCE_PILLS.find(s => s.label === t);
            if (subPill) subSet.add(subPill.key);
          });
          if (subSet.size > 0) setSubstances(subSet);

          // Parse notes for highlight/learned
          if (existingLog.notes) {
            try {
              const parsed = JSON.parse(existingLog.notes);
              if (parsed.highlight) setHighlightText(parsed.highlight);
              if (parsed.learned) setLearnedText(parsed.learned);
              if (parsed.symptomComparisons) setSymptomComparison(parsed.symptomComparisons);
            } catch { /* not JSON */ }
          }
        }
      } catch {
        // Non-critical
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [editingLogId]);

  /* ── Helpers ────────────────────── */
  const toggleSet = (
    set: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    item: string
  ) => {
    hapticLight();
    setter((prev) => {
      const n = new Set(prev);
      if (n.has(item)) n.delete(item);
      else n.add(item);
      return n;
    });
  };

  const toggleSymptom = (key: string) => {
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
  };

  const setSeverity = (key: string, val: number) => {
    hapticSelection();
    setSymptoms((prev) => ({ ...prev, [key]: val }));
  };

  const addCustomSymptom = async () => {
    const name = customSymptomText.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/\s+/g, '_');
    // Add to local list + select it
    if (!customSymptoms.includes(name)) {
      const updated = [...customSymptoms, name];
      setCustomSymptoms(updated);
      // Save to profile
      try {
        const token = await getToken();
        await apiRequest('/api/profile', token, {
          method: 'POST',
          body: JSON.stringify({ customSymptoms: updated }),
        });
      } catch {
        // Non-critical
      }
    }
    setSymptoms((prev) => ({ ...prev, [key]: 1 }));
    setCustomSymptomText('');
    setShowCustomInput(false);
    Keyboard.dismiss();
  };

  const toggleMed = (medId: number) => {
    hapticLight();
    setMedsTaken((prev) => {
      const n = new Set(prev);
      if (n.has(medId)) n.delete(medId);
      else n.add(medId);
      return n;
    });
  };

  const handleNext = () => {
    hapticMedium();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    hapticLight();
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  /* ── Submit ─────────────────────── */
  const handleSubmit = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      setSaving(true);
      const token = await getToken();

      if (isMorning) {
        // Merge stressors + mood pills into contextTags (disruptions tracked separately)
        const contextTags = [
          ...Array.from(moodPills),
          ...Array.from(stressors).map((s) => {
            const found = [...STRESSOR_PILLS, ...customStressors].find((p) => p.key === s);
            return found ? found.label : s;
          }),
        ];

        // Notes: { grateful, intention }
        const notesObj: any = {};
        if (gratitudeText.trim()) notesObj.grateful = gratitudeText.trim();
        if (intentionText.trim()) notesObj.intention = intentionText.trim();

        await apiRequest('/api/logs', token, {
          method: 'POST',
          body: JSON.stringify({
            date: logDate,
            sleepHours,
            sleepQuality,
            mood,
            symptomsJson: Object.keys(symptoms).length > 0 ? symptoms : undefined,
            energy,
            disruptions: sleepDisruptions.size > 0 ? sleepDisruptions.size : undefined,
            contextTags: [...contextTags, ...Array.from(sleepDisruptions)],
            notes: Object.keys(notesObj).length > 0 ? JSON.stringify(notesObj) : undefined,
            logType: 'morning',
            cycleData: periodStatus !== 'none' ? { status: periodStatus, flow: flowIntensity } : undefined,
          }),
        });

        // Also save gratitude to dedicated gratitude journal
        if (gratitudeText.trim()) {
          apiRequest('/api/gratitude', token, {
            method: 'POST',
            body: JSON.stringify({
              date: logDate,
              text: gratitudeText.trim(),
              mood,
              time: 'morning',
            }),
          }).catch(() => {}); // fire-and-forget, don't block the flow
        }
      } else {
        // Evening mode
        // Build symptom data: keep as plain numbers for consistency
        // Store comparison data in a separate field to avoid mixed types
        const symptomsJson: Record<string, number> = { ...symptoms };

        // Context tags: mood pills + activities + substances + comparisons as tags
        const contextTags = [
          ...Array.from(moodPills),
          ...Array.from(activities).map((a) => {
            const found = ACTIVITY_PILLS.find((p) => p.key === a);
            return found ? found.label : a;
          }),
          ...Array.from(substances).map((s) => {
            const found = SUBSTANCE_PILLS.find((p) => p.key === s);
            return found ? found.label : s;
          }),
        ];

        // Notes: { highlight, learned, comparisons }
        const notesObj: any = {};
        if (highlightText.trim()) notesObj.highlight = highlightText.trim();
        if (learnedText.trim()) notesObj.learned = learnedText.trim();
        // Store symptom comparisons in notes so symptomsJson stays as Record<string, number>
        if (Object.keys(symptomComparison).length > 0) {
          notesObj.symptomComparisons = symptomComparison;
        }

        await apiRequest('/api/logs', token, {
          method: 'POST',
          body: JSON.stringify({
            date: logDate,
            mood,
            symptomsJson: Object.keys(symptomsJson).length > 0 ? symptomsJson : undefined,
            contextTags,
            notes: Object.keys(notesObj).length > 0 ? JSON.stringify(notesObj) : undefined,
            logType: 'evening',
          }),
        });
      }

      hapticSuccess();
      setSaving(false);
      setShowCelebration(true);

      // Animate in
      RNAnimated.parallel([
        RNAnimated.timing(celebOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.spring(celebScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();

      // Checkmark pop
      setTimeout(() => {
        hapticMedium();
        RNAnimated.spring(checkScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
      }, 200);

      // Quote fade in
      setTimeout(() => {
        RNAnimated.timing(quoteOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, 600);

      // Auto-dismiss
      setTimeout(() => {
        router.back();
      }, 4500);
    } catch (err: any) {
      setSaving(false);
      savingRef.current = false;
      hapticMedium();
      Alert.alert('Save failed', 'Something went wrong saving your check-in. Please try again.');
    }
  };

  /* ──────────────────────────────── MORNING STEPS ──────────────────────────────── */

  const renderMorningStep = () => {
    switch (step) {
      /* Step 0 — Sleep */
      case 0:
        return (
          <View>
            <Text style={styles.stepTitle}>How did you sleep?</Text>
            <Text style={styles.stepSubtitle}>
              {isToday ? 'Last night — tell us how it went' : 'How was sleep that night?'}
            </Text>

            {/* Sleep quality options */}
            <View style={styles.qualityCards}>
              {SLEEP_QUALITY.map((sq) => (
                <AnimatedPressable
                  key={sq.val}
                  onPress={() => { hapticSelection(); setSleepQuality(sq.val); }}
                  scaleDown={0.97}
                  style={[
                    styles.selectOption,
                    sleepQuality === sq.val && styles.selectOptionSelected,
                  ]}
                >
                  <Text style={styles.selectEmoji}>{sq.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectLabel, sleepQuality === sq.val && styles.selectLabelSelected]}>
                      {sq.label}
                    </Text>
                    <Text style={[styles.selectSublabel, sleepQuality === sq.val && styles.selectSublabelSelected]}>
                      {sq.sublabel}
                    </Text>
                  </View>
                  {sleepQuality === sq.val && <Text style={styles.selectCheck}>✓</Text>}
                </AnimatedPressable>
              ))}
            </View>

            {/* Hours selector */}
            <Text style={styles.sectionLabel}>Hours of sleep</Text>
            <Text style={styles.sleepHoursDisplay}>~{sleepHours}h</Text>
            <View style={styles.sleepHoursRow}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <AnimatedPressable
                  key={h}
                  onPress={() => { hapticSelection(); setSleepHours(h); }}
                  scaleDown={0.9}
                  style={[
                    styles.sleepHourButton,
                    h === sleepHours && styles.sleepHourButtonActive,
                  ]}
                >
                  <Text style={[
                    styles.sleepHourLabel,
                    h === sleepHours && styles.sleepHourLabelActive,
                  ]}>
                    {h}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
            <View style={styles.sleepHoursAdjust}>
              <AnimatedPressable
                onPress={() => { if (sleepHours > 0) { hapticSelection(); setSleepHours(sleepHours - 1); } }}
                scaleDown={0.9}
                style={styles.sleepAdjustBtn}
              >
                <Text style={styles.sleepAdjustBtnText}>−</Text>
              </AnimatedPressable>
              <Text style={styles.sleepAdjustLabel}>{sleepHours} hours</Text>
              <AnimatedPressable
                onPress={() => { if (sleepHours < 12) { hapticSelection(); setSleepHours(sleepHours + 1); } }}
                scaleDown={0.9}
                style={styles.sleepAdjustBtn}
              >
                <Text style={styles.sleepAdjustBtnText}>+</Text>
              </AnimatedPressable>
            </View>

            {/* Sleep disruptions */}
            <Text style={styles.sectionLabel}>Sleep disruptions</Text>
            <View style={styles.pillGrid}>
              {[...SLEEP_DISRUPTIONS, ...customDisruptions].map((d) => (
                <AnimatedPressable
                  key={d.key}
                  onPress={() => toggleSet(sleepDisruptions, setSleepDisruptions, d.key)}
                  scaleDown={0.95}
                  style={[styles.emojiPill, sleepDisruptions.has(d.key) && styles.pillSelected]}
                >
                  <Text style={styles.emojiPillEmoji}>{d.emoji}</Text>
                  <Text style={[styles.emojiPillText, sleepDisruptions.has(d.key) && styles.pillTextSelected]}>
                    {d.label}
                  </Text>
                </AnimatedPressable>
              ))}
              {/* Add custom disruption */}
              <AnimatedPressable
                onPress={() => { hapticLight(); setShowCustomDisruptionInput(true); }}
                scaleDown={0.95}
                style={styles.addCustomPill}
              >
                <Text style={styles.addCustomPillText}>+ Add your own</Text>
              </AnimatedPressable>
            </View>

            {/* Custom disruption input */}
            {showCustomDisruptionInput && (
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="What disrupted your sleep..."
                  placeholderTextColor="#a8a29e"
                  value={customDisruptionText}
                  onChangeText={setCustomDisruptionText}
                  autoFocus
                  onSubmitEditing={() => {
                    const name = customDisruptionText.trim();
                    if (!name) return;
                    const key = name.toLowerCase().replace(/\s+/g, '_');
                    setCustomDisruptions((prev) => [...prev, { key, label: name, emoji: '😴' }]);
                    setSleepDisruptions((prev) => new Set(prev).add(key));
                    setCustomDisruptionText('');
                    setShowCustomDisruptionInput(false);
                    Keyboard.dismiss();
                  }}
                  returnKeyType="done"
                />
                <AnimatedPressable
                  onPress={() => {
                    const name = customDisruptionText.trim();
                    if (!name) return;
                    const key = name.toLowerCase().replace(/\s+/g, '_');
                    setCustomDisruptions((prev) => [...prev, { key, label: name, emoji: '😴' }]);
                    setSleepDisruptions((prev) => new Set(prev).add(key));
                    setCustomDisruptionText('');
                    setShowCustomDisruptionInput(false);
                    Keyboard.dismiss();
                  }}
                  scaleDown={0.95}
                  style={styles.customInputAdd}
                >
                  <Text style={styles.customInputAddText}>Add</Text>
                </AnimatedPressable>
              </View>
            )}
          </View>
        );

      /* Step 1 — Body */
      case 1:
        return renderBodyStep();

      /* Step 2 — Mood (was Meds, now mood tracking in morning) */
      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>How are you feeling?</Text>
            <Text style={styles.stepSubtitle}>Your mood right now</Text>

            {/* Day rating */}
            <View style={styles.moodRow}>
              {MOODS_5.map((m) => (
                <AnimatedPressable
                  key={m.val}
                  onPress={() => { hapticSelection(); setMood(m.val); }}
                  scaleDown={0.9}
                  style={[styles.moodButton, mood === m.val && styles.moodButtonSelected]}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, mood === m.val && styles.moodLabelSelected]}>
                    {m.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Mood pills */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>How would you describe it?</Text>
            <View style={styles.pillGrid}>
              {MOOD_PILLS.map((mp) => (
                <AnimatedPressable
                  key={mp.key}
                  onPress={() => toggleSet(moodPills, setMoodPills, mp.key)}
                  scaleDown={0.95}
                  style={[styles.emojiPill, moodPills.has(mp.key) && styles.pillSelected]}
                >
                  <Text style={styles.emojiPillEmoji}>{mp.emoji}</Text>
                  <Text style={[styles.emojiPillText, moodPills.has(mp.key) && styles.pillTextSelected]}>
                    {mp.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        );

      /* Step 3 — What's Ahead */
      case 3:
        return (
          <View>
            <Text style={styles.stepTitle}>What's ahead today?</Text>
            <Text style={styles.stepSubtitle}>Your energy & what's on the agenda</Text>

            {/* Energy level */}
            <Text style={styles.sectionLabel}>Energy level</Text>
            <View style={styles.energyRow}>
              {ENERGY_LEVELS.map((e) => (
                <AnimatedPressable
                  key={e.val}
                  onPress={() => { hapticSelection(); setEnergy(e.val); }}
                  scaleDown={0.95}
                  style={[styles.energyButton, energy === e.val && styles.energyButtonSelected]}
                >
                  <Text style={styles.energyEmoji}>{e.emoji}</Text>
                  <Text style={[styles.energyLabel, energy === e.val && styles.energyLabelSelected]}>
                    {e.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Stressors */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>What's on your plate</Text>
            <View style={styles.pillGrid}>
              {[...STRESSOR_PILLS, ...customStressors].map((s) => (
                <AnimatedPressable
                  key={s.key}
                  onPress={() => toggleSet(stressors, setStressors, s.key)}
                  scaleDown={0.95}
                  style={[styles.emojiPill, stressors.has(s.key) && styles.pillSelected]}
                >
                  <Text style={styles.emojiPillEmoji}>{s.emoji}</Text>
                  <Text style={[styles.emojiPillText, stressors.has(s.key) && styles.pillTextSelected]}>
                    {s.label}
                  </Text>
                </AnimatedPressable>
              ))}
              {/* Add custom */}
              <AnimatedPressable
                onPress={() => { hapticLight(); setShowCustomStressorInput(true); }}
                scaleDown={0.95}
                style={styles.addCustomPill}
              >
                <Text style={styles.addCustomPillText}>+ Add your own</Text>
              </AnimatedPressable>
            </View>

            {/* Custom stressor input */}
            {showCustomStressorInput && (
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="What else is happening..."
                  placeholderTextColor="#a8a29e"
                  value={customStressorText}
                  onChangeText={setCustomStressorText}
                  autoFocus
                  onSubmitEditing={() => {
                    const name = customStressorText.trim();
                    if (!name) return;
                    const key = name.toLowerCase().replace(/\s+/g, '_');
                    setCustomStressors((prev) => [...prev, { key, label: name, emoji: '📌' }]);
                    setStressors((prev) => new Set(prev).add(key));
                    setCustomStressorText('');
                    setShowCustomStressorInput(false);
                    Keyboard.dismiss();
                  }}
                  returnKeyType="done"
                />
                <AnimatedPressable
                  onPress={() => {
                    const name = customStressorText.trim();
                    if (!name) return;
                    const key = name.toLowerCase().replace(/\s+/g, '_');
                    setCustomStressors((prev) => [...prev, { key, label: name, emoji: '📌' }]);
                    setStressors((prev) => new Set(prev).add(key));
                    setCustomStressorText('');
                    setShowCustomStressorInput(false);
                    Keyboard.dismiss();
                  }}
                  scaleDown={0.95}
                  style={styles.customInputAdd}
                >
                  <Text style={styles.customInputAddText}>Add</Text>
                </AnimatedPressable>
              </View>
            )}
          </View>
        );

      /* Step 4 — Gratitude */
      case 4:
        return (
          <View>
            <Text style={styles.stepTitle}>Start with gratitude</Text>
            <Text style={styles.stepSubtitle}>It only takes a moment ✨</Text>

            <Text style={styles.sectionLabel}>One thing you're grateful for</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="What's making you smile today?"
              placeholderTextColor="#a8a29e"
              value={gratitudeText}
              onChangeText={setGratitudeText}
              multiline
              textAlignVertical="top"
            />

            {/* Prompt suggestions */}
            {!gratitudeText && (
              <View style={styles.promptRow}>
                {GRATITUDE_PROMPTS.slice(0, 3).map((p) => (
                  <AnimatedPressable
                    key={p}
                    onPress={() => { hapticLight(); setGratitudeText(p.replace(/\s[^\s]+$/, '')); }}
                    scaleDown={0.97}
                    style={styles.promptChip}
                  >
                    <Text style={styles.promptChipText}>{p}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>One intention for today</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="I want to..."
              placeholderTextColor="#a8a29e"
              value={intentionText}
              onChangeText={setIntentionText}
              multiline
              textAlignVertical="top"
            />
          </View>
        );

      default:
        return null;
    }
  };

  /* ──────────────────────────────── EVENING STEPS ──────────────────────────────── */

  const renderEveningStep = () => {
    switch (step) {
      /* Step 0 — Your Day */
      case 0:
        return (
          <View>
            <Text style={styles.stepTitle}>How was your day?</Text>
            <Text style={styles.stepSubtitle}>Looking back on today</Text>

            {/* Day rating */}
            <View style={styles.moodRow}>
              {MOODS_5.map((m) => (
                <AnimatedPressable
                  key={m.val}
                  onPress={() => { hapticSelection(); setMood(m.val); }}
                  scaleDown={0.9}
                  style={[styles.moodButton, mood === m.val && styles.moodButtonSelected]}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, mood === m.val && styles.moodLabelSelected]}>
                    {m.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Mood pills */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>How did you feel?</Text>
            <View style={styles.pillGrid}>
              {MOOD_PILLS.map((mp) => (
                <AnimatedPressable
                  key={mp.key}
                  onPress={() => toggleSet(moodPills, setMoodPills, mp.key)}
                  scaleDown={0.95}
                  style={[styles.emojiPill, moodPills.has(mp.key) && styles.pillSelected]}
                >
                  <Text style={styles.emojiPillEmoji}>{mp.emoji}</Text>
                  <Text style={[styles.emojiPillText, moodPills.has(mp.key) && styles.pillTextSelected]}>
                    {mp.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Morning callback */}
            {morningLog && (
              <View style={styles.callbackCard}>
                <Text style={styles.callbackTitle}>☀️ This morning you said...</Text>
                {morningLog.sleepQuality && (
                  <Text style={styles.callbackText}>
                    Sleep: {morningLog.sleepQuality} · {morningLog.sleepHours}h
                  </Text>
                )}
                {morningLog.notes && (() => {
                  try {
                    const parsed = JSON.parse(morningLog.notes);
                    if (parsed.intention) {
                      return <Text style={styles.callbackText}>Intention: "{parsed.intention}"</Text>;
                    }
                  } catch { /* not JSON */ }
                  return null;
                })()}
              </View>
            )}
          </View>
        );

      /* Step 1 — Body */
      case 1:
        return (
          <View>
            <Text style={styles.stepTitle}>How's your body?</Text>
            <Text style={styles.stepSubtitle}>Compare to this morning & note new symptoms</Text>

            {/* Morning comparison */}
            {morningLog?.symptomsJson && Object.keys(morningLog.symptomsJson).length > 0 && (
              <View style={styles.comparisonSection}>
                <Text style={styles.sectionLabel}>This morning you noted</Text>
                {Object.entries(morningLog.symptomsJson).map(([key, severity]: [string, any]) => {
                  const found = SYMPTOM_LIST.find((s) => s.key === key);
                  const label = found ? found.label : key.replace(/_/g, ' ');
                  const emoji = found ? found.emoji : '•';
                  const sevLabel = severity === 1 ? 'Mild' : severity === 2 ? 'Moderate' : severity === 3 ? 'Severe' : '';
                  return (
                    <View key={key} style={styles.comparisonRow}>
                      <Text style={styles.comparisonSymptom}>
                        {emoji} {label}{sevLabel ? ` · ${sevLabel}` : ''}
                      </Text>
                      <View style={styles.comparisonButtons}>
                        {COMPARISON_OPTIONS.map((opt) => (
                          <AnimatedPressable
                            key={opt.val}
                            onPress={() => {
                              hapticLight();
                              setSymptomComparison((prev) => ({ ...prev, [key]: opt.val }));
                            }}
                            scaleDown={0.95}
                            style={[
                              styles.comparisonButton,
                              symptomComparison[key] === opt.val && styles.comparisonButtonSelected,
                            ]}
                          >
                            <Text style={styles.comparisonButtonEmoji}>{opt.emoji}</Text>
                            <Text style={[
                              styles.comparisonButtonLabel,
                              symptomComparison[key] === opt.val && styles.comparisonButtonLabelSelected,
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
            )}

            {/* New symptoms */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Anything new show up today?</Text>
            {renderSymptomPills()}
          </View>
        );

      /* Step 2 — Activity */
      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>What did you do today?</Text>
            <Text style={styles.stepSubtitle}>Activities & what you consumed</Text>

            <Text style={styles.sectionLabel}>Activities</Text>
            <View style={styles.pillGrid}>
              {ACTIVITY_PILLS.map((a) => (
                <AnimatedPressable
                  key={a.key}
                  onPress={() => toggleSet(activities, setActivities, a.key)}
                  scaleDown={0.95}
                  style={[styles.emojiPill, activities.has(a.key) && styles.pillSelected]}
                >
                  <Text style={styles.emojiPillEmoji}>{a.emoji}</Text>
                  <Text style={[styles.emojiPillText, activities.has(a.key) && styles.pillTextSelected]}>
                    {a.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Substances & habits</Text>
            <View style={styles.pillGrid}>
              {SUBSTANCE_PILLS.map((s) => (
                <AnimatedPressable
                  key={s.key}
                  onPress={() => toggleSet(substances, setSubstances, s.key)}
                  scaleDown={0.95}
                  style={[styles.emojiPill, substances.has(s.key) && styles.pillSelected]}
                >
                  <Text style={styles.emojiPillEmoji}>{s.emoji}</Text>
                  <Text style={[styles.emojiPillText, substances.has(s.key) && styles.pillTextSelected]}>
                    {s.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        );

      /* Step 3 — Highlight */
      case 3:
        return (
          <View>
            <Text style={styles.stepTitle}>End on a high note</Text>
            <Text style={styles.stepSubtitle}>Reflection helps your brain process the day 🧠</Text>

            <Text style={styles.sectionLabel}>One great thing from today</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="What was a highlight?"
              placeholderTextColor="#a8a29e"
              value={highlightText}
              onChangeText={setHighlightText}
              multiline
              textAlignVertical="top"
            />

            {/* Prompt suggestions */}
            {!highlightText && (
              <View style={styles.promptRow}>
                {HIGHLIGHT_PROMPTS.slice(0, 3).map((p) => (
                  <AnimatedPressable
                    key={p}
                    onPress={() => { hapticLight(); setHighlightText(p.replace(/\s[^\s]+$/, '')); }}
                    scaleDown={0.97}
                    style={styles.promptChip}
                  >
                    <Text style={styles.promptChipText}>{p}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Anything you'd do differently?</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Optional — no judgment here"
              placeholderTextColor="#a8a29e"
              value={learnedText}
              onChangeText={setLearnedText}
              multiline
              textAlignVertical="top"
            />
          </View>
        );

      default:
        return null;
    }
  };

  /* ──────────────── Shared: Meds step ──────────────── */

  const renderMedsStep = () => {
    if (medications.length === 0) {
      return (
        <View>
          <Text style={styles.stepTitle}>
            {isMorning ? 'Morning meds' : 'Evening meds check'}
          </Text>
          <Text style={styles.stepSubtitle}>Track your medications and supplements</Text>

          <View style={styles.medsEmptyCard}>
            <Text style={styles.medsEmptyEmoji}>💊</Text>
            <Text style={styles.medsEmptyTitle}>No medications added yet</Text>
            <Text style={styles.medsEmptyDesc}>
              Add your HRT, supplements, or medications in your profile to track them here.
            </Text>
            <AnimatedPressable
              onPress={() => {
                hapticLight();
                router.push('/(app)/meds');
              }}
              scaleDown={0.97}
              style={styles.medsAddButton}
            >
              <Text style={styles.medsAddButtonText}>+ Add medications</Text>
            </AnimatedPressable>
          </View>
        </View>
      );
    }

    return (
      <View>
        <Text style={styles.stepTitle}>
          {isMorning ? 'Morning meds' : 'Evening meds check'}
        </Text>
        <Text style={styles.stepSubtitle}>
          {isMorning ? 'Quick check — tap what you\'ve taken' : 'Anything left for tonight?'}
        </Text>

        <View style={{ gap: 10 }}>
          {medications.map((med) => {
            const taken = medsTaken.has(med.id);
            return (
              <AnimatedPressable
                key={med.id}
                onPress={() => toggleMed(med.id)}
                scaleDown={0.97}
                style={[styles.medCard, taken && styles.medCardTaken]}
              >
                <View style={[
                  styles.medIcon,
                  med.type === 'supplement' ? styles.medIconAmber : styles.medIconDefault,
                ]}>
                  <Text style={styles.medIconText}>
                    {med.type === 'supplement' ? '⬡' : '◎'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medName, taken && styles.medNameTaken]}>
                    {med.name}
                  </Text>
                  <Text style={styles.medDose}>{med.dose}</Text>
                </View>
                <View style={[styles.medCheck, taken && styles.medCheckTaken]}>
                  {taken && <Text style={styles.medCheckText}>✓</Text>}
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        <AnimatedPressable
          onPress={() => {
            hapticLight();
            // Skip all — clear taken
            if (medsTaken.size > 0) {
              setMedsTaken(new Set());
            }
          }}
          scaleDown={0.97}
          style={{ marginTop: 14 }}
        >
          <Text style={styles.medsSkipText}>
            {medsTaken.size === 0 ? 'I didn\'t take anything today' : 'Clear all'}
          </Text>
        </AnimatedPressable>

        <View style={styles.medsInfoCard}>
          <Text style={styles.medsInfoText}>
            Tracking this helps us see if your meds are working and spot patterns with your symptoms.
          </Text>
        </View>
      </View>
    );
  };

  /* ──────────────── Shared: Body/Symptoms step ──────────────── */

  const renderBodyStep = () => {
    const allSymptoms = [
      ...SYMPTOM_LIST,
      ...customSymptoms.map((name) => ({
        key: name.toLowerCase().replace(/\s+/g, '_'),
        label: name,
        emoji: '•',
      })),
    ];

    const selectedKeys = Object.keys(symptoms);

    return (
      <View>
        <Text style={styles.stepTitle}>
          {isMorning ? 'Body experiencing any symptoms?' : "Anything new show up?"}
        </Text>
        <Text style={styles.stepSubtitle}>
          {isMorning ? 'Tap what you\'re feeling — or skip if all good' : 'Tap any new symptoms from today'}
        </Text>

        {renderSymptomPills()}

        {/* Period tracker — morning only, perimenopause/unsure users */}
        {showPeriodTracker && (
          <View style={styles.periodSection}>
            <View style={styles.periodHeader}>
              <View style={styles.periodDot} />
              <Text style={styles.periodHeaderText}>Period tracker</Text>
            </View>
            <View style={styles.pillGrid}>
              {([['none', 'No period'], ['period', 'Period today'], ['spotting', 'Spotting']] as const).map(([val, label]) => (
                <AnimatedPressable
                  key={val}
                  onPress={() => { hapticSelection(); setPeriodStatus(val); if (val === 'none') setFlowIntensity(null); }}
                  scaleDown={0.95}
                  style={[styles.emojiPill, periodStatus === val && styles.pillSelected]}
                >
                  <Text style={[styles.emojiPillText, periodStatus === val && styles.pillTextSelected]}>
                    {label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
            {(periodStatus === 'period' || periodStatus === 'spotting') && (
              <View style={[styles.pillGrid, { marginTop: 10 }]}>
                {([['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']] as const).map(([val, label]) => (
                  <AnimatedPressable
                    key={val}
                    onPress={() => { hapticSelection(); setFlowIntensity(val); }}
                    scaleDown={0.95}
                    style={[styles.emojiPill, flowIntensity === val && styles.pillSelected]}
                  >
                    <Text style={[styles.emojiPillText, flowIntensity === val && styles.pillTextSelected]}>
                      {label}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Feeling good card */}
        {selectedKeys.length === 0 && (
          <View style={styles.feelingGoodCard}>
            <Text style={styles.feelingGoodEmoji}>🌿</Text>
            <Text style={styles.feelingGoodText}>Feeling good — no symptoms today!</Text>
          </View>
        )}
      </View>
    );
  };

  const renderSymptomPills = () => {
    const allSymptoms = [
      ...SYMPTOM_LIST,
      ...customSymptoms.map((name) => ({
        key: name.toLowerCase().replace(/\s+/g, '_'),
        label: name,
        emoji: '•',
      })),
    ];

    return (
      <View>
        <View style={styles.pillGrid}>
          {allSymptoms.map((s) => (
            <AnimatedPressable
              key={s.key}
              onPress={() => toggleSymptom(s.key)}
              scaleDown={0.95}
              style={[styles.emojiPill, s.key in symptoms && styles.pillSelected]}
            >
              <Text style={styles.emojiPillEmoji}>{s.emoji}</Text>
              <Text style={[styles.emojiPillText, s.key in symptoms && styles.pillTextSelected]}>
                {s.label}
              </Text>
            </AnimatedPressable>
          ))}

          {/* Add custom */}
          <AnimatedPressable
            onPress={() => { hapticLight(); setShowCustomInput(true); }}
            scaleDown={0.95}
            style={styles.addCustomPill}
          >
            <Text style={styles.addCustomPillText}>+ Add your own</Text>
          </AnimatedPressable>
        </View>

        {/* Custom symptom input */}
        {showCustomInput && (
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Symptom name..."
              placeholderTextColor="#a8a29e"
              value={customSymptomText}
              onChangeText={setCustomSymptomText}
              autoFocus
              onSubmitEditing={addCustomSymptom}
              returnKeyType="done"
            />
            <AnimatedPressable onPress={addCustomSymptom} scaleDown={0.95} style={styles.customInputAdd}>
              <Text style={styles.customInputAddText}>Add</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* Severity selectors for selected symptoms */}
        {Object.keys(symptoms).length > 0 && (
          <View style={styles.severitySection}>
            <Text style={styles.sectionLabel}>Rate severity</Text>
            {Object.entries(symptoms).map(([key, sev]) => {
              const found = [...SYMPTOM_LIST, ...customSymptoms.map((n) => ({
                key: n.toLowerCase().replace(/\s+/g, '_'),
                label: n,
                emoji: '•',
              }))].find((s) => s.key === key);
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
        )}
      </View>
    );
  };

  /* ──────────────── Celebration screen ──────────────── */

  if (showCelebration) {
    const quote = getQuoteOfDay();
    return (
      <RNAnimated.View style={[styles.celebContainer, { opacity: celebOpacity, transform: [{ scale: celebScale }] }]}>
        <View style={styles.celebContent}>
          <RNAnimated.View style={[styles.celebCheck, { transform: [{ scale: checkScale }] }]}>
            <Text style={styles.celebCheckText}>✓</Text>
          </RNAnimated.View>

          <Text style={styles.celebTitle}>
            {isMorning ? 'Morning logged' : 'Evening logged'}
          </Text>
          <Text style={styles.celebSubtitle}>
            {isMorning
              ? "Great start — you'll check in again tonight."
              : "You're building a clearer picture of your health."}
          </Text>

          {/* Stats row */}
          <View style={styles.celebStatsRow}>
            <View style={styles.celebStat}>
              <Text style={styles.celebStatValue}>🔥</Text>
              <Text style={styles.celebStatLabel}>Keep going!</Text>
            </View>
            <View style={styles.celebStat}>
              <Text style={styles.celebStatValue}>📊</Text>
              <Text style={styles.celebStatLabel}>Building insights</Text>
            </View>
          </View>

          {/* Evening: Day summary snapshot */}
          {!isMorning && (
            <View style={styles.celebSummary}>
              {mood && (
                <Text style={styles.celebSummaryText}>
                  Day: {MOODS_5.find((m) => m.val === mood)?.emoji} {MOODS_5.find((m) => m.val === mood)?.label}
                </Text>
              )}
              {Object.keys(symptoms).length > 0 && (
                <Text style={styles.celebSummaryText}>
                  Symptoms: {Object.keys(symptoms).length} logged
                </Text>
              )}
              {highlightText && (
                <Text style={styles.celebSummaryText}>
                  ✨ "{highlightText.substring(0, 40)}{highlightText.length > 40 ? '...' : ''}"
                </Text>
              )}
            </View>
          )}

          <RNAnimated.View style={[styles.celebQuoteWrap, { opacity: quoteOpacity }]}>
            <Text style={styles.celebQuoteText}>"{quote.text}"</Text>
            <Text style={styles.celebQuoteAuthor}>— {quote.author}</Text>
          </RNAnimated.View>
        </View>

        <AnimatedPressable
          onPress={() => router.back()}
          scaleDown={0.96}
          style={styles.celebDoneButton}
        >
          <Text style={styles.celebDoneText}>Done</Text>
        </AnimatedPressable>
      </RNAnimated.View>
    );
  }

  /* ──────────────── Main layout ──────────────── */

  const headerEmoji = isMorning ? '☀️' : '🌙';

  if (loadingExisting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1c1917" />
          <Text style={{ fontSize: 13, color: '#a8a29e', marginTop: 12 }}>Loading your entry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.nav}>
        <AnimatedPressable onPress={handleBack} scaleDown={0.9} style={styles.navSide}>
          <Text style={styles.navBackText}>← Back</Text>
        </AnimatedPressable>
        <Text style={styles.navStep}>
          {isViewMode ? `${headerEmoji} Viewing ${isMorning ? 'morning' : 'evening'}` : `${headerEmoji} Step ${step + 1} of ${STEPS.length}`}
        </Text>
        {isViewMode ? (
          <AnimatedPressable onPress={() => { hapticLight(); setIsViewMode(false); }} scaleDown={0.9} style={styles.navSide}>
            <Text style={[styles.navSkipText, { color: '#1c1917', fontWeight: '600' }]}>Edit</Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable onPress={() => router.back()} scaleDown={0.9} style={styles.navSide}>
            <Text style={styles.navSkipText}>Skip</Text>
          </AnimatedPressable>
        )}
      </View>

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isMorning ? renderMorningStep() : renderEveningStep()}
      </ScrollView>

      {/* Footer button */}
      <View style={styles.footer}>
        {isViewMode ? (
          <AnimatedPressable
            onPress={() => router.back()}
            scaleDown={0.96}
            style={[styles.nextButton, { backgroundColor: '#44403c' }]}
          >
            <Text style={styles.nextButtonText}>Done</Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            onPress={handleNext}
            scaleDown={0.96}
            style={styles.nextButton}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.nextButtonText}>
                {step < STEPS.length - 1
                  ? 'Next'
                  : editingLogId
                    ? (isMorning ? 'Update morning ✓' : 'Update evening ✓')
                    : (isMorning ? 'Save morning ✓' : 'Save evening ✓')}
              </Text>
            )}
          </AnimatedPressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ──────────────── Styles ──────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  /* Nav */
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  navSide: { paddingVertical: 4 },
  navBackText: { fontSize: 13, color: '#a8a29e' },
  navStep: { fontSize: 13, color: '#a8a29e', fontWeight: '500' },
  navSkipText: { fontSize: 13, color: '#a8a29e' },

  /* Progress bars */
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  progressBarActive: { backgroundColor: '#1c1917' },
  progressBarInactive: { backgroundColor: '#e7e5e4' },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },

  /* Step text */
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#a8a29e',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716c',
    marginBottom: 10,
    marginTop: 8,
  },

  /* Select option cards (sleep quality) */
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fafaf9',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectOptionSelected: {
    backgroundColor: '#1c1917',
    borderColor: '#1c1917',
  },
  selectEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  selectLabel: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  selectLabelSelected: { color: '#ffffff' },
  selectSublabel: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  selectSublabelSelected: { color: '#78716c' },
  selectCheck: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  qualityCards: { gap: 8, marginBottom: 20 },

  /* Sleep hours */
  sleepHoursDisplay: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1c1917',
    textAlign: 'center',
    marginBottom: 12,
  },
  sleepHoursRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sleepHourButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f4',
  },
  sleepHourButtonActive: {
    backgroundColor: '#1c1917',
  },
  sleepHourLabel: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  sleepHourLabelActive: { color: '#ffffff', fontWeight: '700' },
  sleepHoursAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  sleepAdjustBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepAdjustBtnText: { fontSize: 20, fontWeight: '500', color: '#1c1917' },
  sleepAdjustLabel: { fontSize: 15, fontWeight: '600', color: '#1c1917', minWidth: 70, textAlign: 'center' },

  /* Pill grid */
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f5f5f4',
  },
  emojiPillEmoji: { fontSize: 14 },
  emojiPillText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  pillSelected: { backgroundColor: '#1c1917' },
  pillTextSelected: { color: '#ffffff' },

  /* Add custom */
  addCustomPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderStyle: 'dashed',
  },
  addCustomPillText: { fontSize: 13, color: '#a8a29e' },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#fafaf9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1c1917',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  customInputAdd: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  customInputAddText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  /* Severity */
  severitySection: { marginTop: 20 },
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

  /* Period tracker */
  periodSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  periodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fb7185',
  },
  periodHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c1917',
  },

  /* Feeling good */
  feelingGoodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    marginTop: 16,
  },
  feelingGoodEmoji: { fontSize: 20 },
  feelingGoodText: { fontSize: 13, color: '#166534', fontWeight: '500' },

  /* Energy */
  energyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  energyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f5f5f4',
  },
  energyButtonSelected: { backgroundColor: '#1c1917' },
  energyEmoji: { fontSize: 24, marginBottom: 4 },
  energyLabel: { fontSize: 13, color: '#78716c', fontWeight: '500' },
  energyLabelSelected: { color: '#ffffff' },

  /* Mood */
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  moodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  moodButtonSelected: {
    backgroundColor: '#1c1917',
    transform: [{ scale: 1.08 }],
  },
  moodEmoji: { fontSize: 30, marginBottom: 6 },
  moodLabel: { fontSize: 12, color: '#a8a29e' },
  moodLabelSelected: { color: '#ffffff', fontWeight: '500' },

  /* Morning callback card */
  callbackCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  callbackTitle: { fontSize: 13, fontWeight: '600', color: '#92400e', marginBottom: 6 },
  callbackText: { fontSize: 12, color: '#78716c', marginBottom: 2 },

  /* Comparison */
  comparisonSection: { marginBottom: 16 },
  comparisonRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  comparisonSymptom: { fontSize: 13, color: '#1c1917', marginBottom: 8 },
  comparisonButtons: { flexDirection: 'row', gap: 8 },
  comparisonButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f4',
  },
  comparisonButtonSelected: { backgroundColor: '#1c1917' },
  comparisonButtonEmoji: { fontSize: 12 },
  comparisonButtonLabel: { fontSize: 12, color: '#78716c', fontWeight: '500' },
  comparisonButtonLabelSelected: { color: '#ffffff' },

  /* Notes / text input */
  notesInput: {
    backgroundColor: '#fafaf9',
    borderRadius: 16,
    padding: 16,
    minHeight: 80,
    fontSize: 13,
    color: '#1c1917',
    borderWidth: 1,
    borderColor: '#f5f5f4',
    marginBottom: 8,
  },

  /* Prompts */
  promptRow: { gap: 8, marginBottom: 8 },
  promptChip: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  promptChipText: { fontSize: 12, color: '#78716c' },

  /* Meds step */
  medsEmptyCard: {
    backgroundColor: '#fafaf9',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#e7e5e4',
    marginTop: 8,
  },
  medsEmptyEmoji: { fontSize: 32, marginBottom: 12 },
  medsEmptyTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 6 },
  medsEmptyDesc: { fontSize: 12, color: '#a8a29e', textAlign: 'center', lineHeight: 18, marginBottom: 16, paddingHorizontal: 16 },
  medsAddButton: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  medsAddButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#f5f5f4',
    backgroundColor: '#ffffff',
  },
  medCardTaken: {
    borderColor: '#34d399',
    backgroundColor: '#f0fdf4',
  },
  medIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medIconDefault: { backgroundColor: '#1c1917' },
  medIconAmber: { backgroundColor: '#fef3c7' },
  medIconText: { fontSize: 14, color: '#ffffff' },
  medName: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  medNameTaken: { color: '#a8a29e', textDecorationLine: 'line-through' },
  medDose: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  medCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medCheckTaken: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  medCheckText: { fontSize: 12, color: '#ffffff', fontWeight: '700' },
  medsSkipText: { fontSize: 12, color: '#a8a29e', textDecorationLine: 'underline' },
  medsInfoCard: {
    backgroundColor: '#fafaf9',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  medsInfoText: { fontSize: 12, color: '#78716c', lineHeight: 18 },

  /* Footer */
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  nextButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  /* Celebration */
  celebContainer: {
    flex: 1,
    backgroundColor: '#1c1917',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  celebContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebCheck: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  celebCheckText: { fontSize: 36, fontWeight: '700', color: '#ffffff' },
  celebTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  celebSubtitle: {
    fontSize: 14,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  celebStatsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  celebStat: { alignItems: 'center', gap: 4 },
  celebStatValue: { fontSize: 24 },
  celebStatLabel: { fontSize: 11, color: '#78716c' },
  celebSummary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  celebSummaryText: { fontSize: 13, color: '#d6d3d1', marginBottom: 4 },
  celebQuoteWrap: { paddingHorizontal: 16, alignItems: 'center' },
  celebQuoteText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#d6d3d1',
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  celebQuoteAuthor: { fontSize: 12, color: '#78716c' },
  celebDoneButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 50,
    width: '100%',
  },
  celebDoneText: { fontSize: 15, fontWeight: '600', color: '#1c1917' },
});

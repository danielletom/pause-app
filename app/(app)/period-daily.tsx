import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { hapticMedium, hapticLight, hapticSuccess, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const FLOWS = [
  { id: 'spotting', emoji: '•', label: 'Spotting' },
  { id: 'light', emoji: '💧', label: 'Light' },
  { id: 'medium', emoji: '💧💧', label: 'Medium' },
  { id: 'heavy', emoji: '💧💧💧', label: 'Heavy' },
];

const PAINS = [
  { id: 'none', emoji: '😊', label: 'None' },
  { id: 'mild', emoji: '😐', label: 'Mild' },
  { id: 'moderate', emoji: '😣', label: 'Moderate' },
  { id: 'severe', emoji: '😫', label: 'Severe' },
];

export default function PeriodDailyScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [flow, setFlow] = useState<string | null>(null);
  const [pain, setPain] = useState<string | null>(null);
  const [endPeriod, setEndPeriod] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrent = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const data = await apiRequest('/api/period/cycles/current', token);
      if (data?.daysSinceStart != null) {
        setDayNumber(data.daysSinceStart + 1);
      }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchCurrent(); }, [fetchCurrent]));

  const handleSave = async () => {
    if (!flow) return;
    setSaving(true);
    try {
      const token = await getTokenRef.current();
      await apiRequest('/api/period/daily', token, {
        method: 'POST',
        body: JSON.stringify({
          flowIntensity: flow,
          painLevel: pain,
          endPeriod,
        }),
      });
      hapticSuccess();
      setDone(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to log daily flow');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const today = new Date();
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#fff1f2' }]}>
        <View style={styles.doneContainer}>
          <View style={styles.doneCircle}>
            <Text style={{ fontSize: 20, color: '#f43f5e' }}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>
            {endPeriod ? 'Period ended' : `Day ${dayNumber ?? '?'} logged`}
          </Text>
          <Text style={styles.doneSub}>
            {FLOWS.find(f => f.id === flow)?.label} flow · {PAINS.find(p => p.id === pain)?.label || 'No'} cramps
          </Text>

          {endPeriod && (
            <View style={[styles.card, { width: '100%', marginTop: 16, borderColor: '#fecdd3' }]}>
              <Text style={{ fontSize: 12, color: '#78716c', lineHeight: 18 }}>
                This period: {dayNumber ?? '?'} days · Started {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Your data has been saved.
              </Text>
            </View>
          )}

          {!endPeriod && (
            <Text style={{ fontSize: 12, color: '#d6d3d1', marginTop: 8 }}>We'll remind you to log tomorrow</Text>
          )}

          <View style={{ width: '100%', marginTop: 24 }}>
            <AnimatedPressable
              onPress={() => { hapticMedium(); router.replace('/(app)/period-tracker'); }}
              scaleDown={0.97}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Done</Text>
            </AnimatedPressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <BackButton />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f43f5e" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Active period badge */}
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Period active · Day {dayNumber ?? '?'}</Text>
          </View>

          <Text style={styles.stepTitle}>Today's flow</Text>
          <Text style={styles.stepSub}>Quick daily check-in · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>

          {/* Flow */}
          <Text style={styles.sectionLabel}>Flow intensity</Text>
          <View style={styles.optionRow}>
            {FLOWS.map(f => (
              <AnimatedPressable
                key={f.id}
                onPress={() => { hapticSelection(); setFlow(f.id); }}
                scaleDown={0.95}
                style={[styles.optionItem, flow === f.id && styles.optionItemSelected]}
              >
                <Text style={{ fontSize: 14 }}>{f.emoji}</Text>
                <Text style={[styles.optionLabel, flow === f.id && { color: '#be123c' }]}>{f.label}</Text>
              </AnimatedPressable>
            ))}
          </View>

          {/* Pain */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Cramps / pain</Text>
          <View style={styles.optionRow}>
            {PAINS.map(p => (
              <AnimatedPressable
                key={p.id}
                onPress={() => { hapticSelection(); setPain(p.id); }}
                scaleDown={0.95}
                style={[styles.optionItem, pain === p.id && styles.optionItemSelected]}
              >
                <Text style={{ fontSize: 14 }}>{p.emoji}</Text>
                <Text style={[styles.optionLabel, pain === p.id && { color: '#be123c' }]}>{p.label}</Text>
              </AnimatedPressable>
            ))}
          </View>

          {/* End period toggle */}
          <AnimatedPressable
            onPress={() => { hapticSelection(); setEndPeriod(!endPeriod); }}
            scaleDown={0.98}
            style={[styles.endCard, endPeriod && { borderColor: '#fda4af', backgroundColor: '#fff1f2' }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#44403c' }}>Period ended?</Text>
              <Text style={{ fontSize: 12, color: '#a8a29e' }}>Mark today as the last day</Text>
            </View>
            <View style={[styles.toggleSwitch, endPeriod && styles.toggleSwitchOn]}>
              <View style={[styles.toggleThumb, endPeriod && styles.toggleThumbOn]} />
            </View>
          </AnimatedPressable>

          {endPeriod && (
            <View style={[styles.card, { marginTop: 8, backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
              <Text style={{ fontSize: 12, color: '#78716c', lineHeight: 18 }}>
                This period: {dayNumber ?? '?'} days. Your cycle data will be updated.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {!loading && !done && (
        <View style={styles.bottomBar}>
          <AnimatedPressable
            onPress={() => { hapticMedium(); handleSave(); }}
            scaleDown={0.97}
            style={[styles.primaryBtn, !flow && styles.primaryBtnDisabled]}
            disabled={!flow || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, !flow && { color: '#a8a29e' }]}>
                {endPeriod ? 'Save & end period' : flow ? "Save today's log" : 'Select flow level'}
              </Text>
            )}
          </AnimatedPressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ffe4e6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    alignSelf: 'flex-start', marginBottom: 12, marginTop: 8,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f43f5e' },
  activeText: { fontSize: 12, fontWeight: '500', color: '#be123c' },

  stepTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  stepSub: { fontSize: 12, color: '#a8a29e', marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#57534e', marginBottom: 8 },

  optionRow: { flexDirection: 'row', gap: 6 },
  optionItem: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16,
    borderWidth: 2, borderColor: '#f5f5f4', gap: 6,
  },
  optionItemSelected: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  optionLabel: { fontSize: 10, fontWeight: '500', color: '#78716c' },

  endCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginTop: 20,
    borderWidth: 2, borderColor: '#f5f5f4',
  },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#e7e5e4', justifyContent: 'center', padding: 2 },
  toggleSwitchOn: { backgroundColor: '#f43f5e' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f5f5f4',
  },

  bottomBar: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12 },
  primaryBtn: { backgroundColor: '#f43f5e', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  primaryBtnDisabled: { backgroundColor: '#e7e5e4' },

  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffe4e6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  doneTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  doneSub: { fontSize: 14, color: '#78716c' },
});

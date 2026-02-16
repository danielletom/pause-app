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

/* ─── Bleeding types with triage categories ──────────── */

const TYPES = [
  { id: 'spotting', emoji: '•', label: 'Light spots', desc: 'A few spots on underwear', category: 'spotting' as const },
  { id: 'light_bleeding', emoji: '💧', label: 'Light bleeding', desc: 'More than spotting, less than a period', category: 'maybe_period' as const },
  { id: 'period_start', emoji: '🔴', label: 'I think my period started', desc: 'Proper bleeding, feels like day 1', category: 'period' as const },
  { id: 'hrt_bleeding', emoji: '💊', label: 'HRT-related bleeding', desc: 'Breakthrough bleed on HRT', category: 'hrt' as const },
  { id: 'post_meno_bleeding', emoji: '⚠', label: 'Post-menopause bleeding', desc: 'Bleeding after 12+ months without a period', category: 'urgent' as const },
];

type Category = 'spotting' | 'maybe_period' | 'period' | 'hrt' | 'urgent';

function toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }

export default function PeriodBleedingScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [type, setType] = useState<string | null>(null);
  const [when, setWhen] = useState('today');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const selected = TYPES.find(t => t.id === type);
  const category: Category | null = selected?.category ?? null;

  const getEventDate = (): string => {
    const d = new Date();
    if (when === 'yesterday') d.setDate(d.getDate() - 1);
    else if (when === 'other') d.setDate(d.getDate() - 3);
    return toDateStr(d);
  };

  const handleSave = async () => {
    if (!type || category === 'period') return;
    setSaving(true);
    try {
      const token = await getTokenRef.current();
      await apiRequest('/api/period/events', token, {
        method: 'POST',
        body: JSON.stringify({
          type,
          eventDate: getEventDate(),
          sourceCategory: category,
        }),
      });
      hapticSuccess();
      setDone(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to log bleeding');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#fff1f2' }]}>
        <View style={styles.doneContainer}>
          <View style={styles.doneCircle}>
            <Text style={{ fontSize: 20, color: '#f43f5e' }}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>Bleeding logged</Text>
          <Text style={styles.doneSub}>{selected?.label} · {when === 'today' ? 'Today' : when === 'yesterday' ? 'Yesterday' : 'Earlier'}</Text>
          <Text style={styles.doneMuted}>
            {category === 'spotting' ? 'Logged as spotting (not a period)' : category === 'hrt' ? 'Logged as HRT bleeding' : 'Logged for your records'}
          </Text>

          <View style={[styles.card, { width: '100%', marginTop: 16, borderColor: '#f5f5f4' }]}>
            <Text style={styles.infoBody}>
              {category === 'spotting'
                ? "This won't count as your period starting. The spotting is recorded separately and will appear in your cycle history."
                : category === 'hrt'
                ? "HRT breakthrough bleeding is tracked separately. If this continues beyond 6 months, mention it to your prescribing doctor."
                : category === 'urgent'
                ? "Post-menopausal bleeding has been logged. Please book an appointment with your GP as soon as possible."
                : "Your bleeding has been logged."}
            </Text>
          </View>

          <View style={{ width: '100%', marginTop: 24 }}>
            <AnimatedPressable
              onPress={() => { hapticMedium(); router.replace('/(app)/period-tracker'); }}
              scaleDown={0.97}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Back to tracker</Text>
            </AnimatedPressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.97}>
          <Text style={styles.backBtn}>← Back</Text>
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Log bleeding</Text>
        <Text style={styles.stepSub}>What's happening? We'll help you log the right thing.</Text>

        {/* When */}
        <Text style={styles.sectionLabel}>When</Text>
        <View style={styles.whenRow}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'other', label: 'Earlier' },
          ].map(w => (
            <AnimatedPressable
              key={w.id}
              onPress={() => { hapticSelection(); setWhen(w.id); }}
              scaleDown={0.97}
              style={[styles.whenBtn, when === w.id && styles.whenBtnActive]}
            >
              <Text style={[styles.whenBtnText, when === w.id && styles.whenBtnTextActive]}>{w.label}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {/* Type */}
        <Text style={styles.sectionLabel}>What best describes it?</Text>
        <View style={{ gap: 8 }}>
          {TYPES.map(t => (
            <AnimatedPressable
              key={t.id}
              onPress={() => { hapticSelection(); setType(t.id); }}
              scaleDown={0.97}
              style={[styles.typeOption, type === t.id && styles.typeOptionSelected]}
            >
              <Text style={{ fontSize: 16, width: 28, textAlign: 'center' }}>{t.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeLabel, type === t.id && { color: '#be123c' }]}>{t.label}</Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
              </View>
              {type === t.id && <Text style={{ color: '#f43f5e' }}>✓</Text>}
            </AnimatedPressable>
          ))}
        </View>

        {/* TRIAGE CARDS */}

        {/* Spotting */}
        {category === 'spotting' && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: '#fafaf9' }]}>
            <Text style={styles.infoBody}>
              <Text style={{ fontWeight: '600', color: '#44403c' }}>This will be logged as spotting</Text> — it won't reset your cycle counter or count as Day 1. We track spotting separately so we can spot patterns.
            </Text>
          </View>
        )}

        {/* Maybe period */}
        {category === 'maybe_period' && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 2 }]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>Could this be your period starting?</Text>
                <Text style={styles.insightBody}>
                  In perimenopause, periods often begin with light bleeding before becoming a full flow. If you're not sure, log as spotting — you can convert it later.
                </Text>
                <AnimatedPressable
                  onPress={() => { hapticMedium(); router.replace('/(app)/period-log'); }}
                  scaleDown={0.97}
                >
                  <Text style={[styles.linkText, { marginTop: 8 }]}>Actually, log this as my period →</Text>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        )}

        {/* Period — redirect */}
        {category === 'period' && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 2 }]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text>🔴</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>Let's log this properly</Text>
                <Text style={styles.insightBody}>
                  We'll take you to the full period log where you can record flow, symptoms and mood.
                </Text>
                <AnimatedPressable
                  onPress={() => { hapticMedium(); router.replace('/(app)/period-log'); }}
                  scaleDown={0.97}
                  style={[styles.primaryBtn, { marginTop: 10, backgroundColor: '#f43f5e' }]}
                >
                  <Text style={styles.primaryBtnText}>Log period →</Text>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        )}

        {/* HRT */}
        {category === 'hrt' && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: '#faf5ff', borderColor: '#d8b4fe' }]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text>💊</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>HRT breakthrough bleeding</Text>
                <Text style={styles.insightBody}>
                  Breakthrough bleeding is common in the first 3–6 months of HRT. This will be logged separately from your cycle. If this continues beyond 6 months or is heavy, mention it to your prescribing doctor.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Post-menopause — urgent */}
        {category === 'urgent' && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 2 }]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>⚠</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.insightTitle, { color: '#991b1b', fontSize: 14 }]}>Please speak to your GP</Text>
                <Text style={[styles.insightBody, { color: '#57534e' }]}>
                  Any bleeding after 12 or more months without a period should be checked by a doctor. It's usually nothing serious — but it needs investigating. We'll still log this so you have a record to share with your GP.
                </Text>
                <View style={[styles.card, { marginTop: 8, backgroundColor: '#ffffff', borderColor: '#fecaca' }]}>
                  <Text style={{ fontSize: 12, color: '#78716c' }}>
                    <Text style={{ fontWeight: '600', color: '#44403c' }}>Important:</Text> Post-menopausal bleeding should always be investigated, even if it's just a small amount. Please book an appointment.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA — only for non-period types */}
      {type && category !== 'period' && (
        <View style={styles.bottomBar}>
          <AnimatedPressable
            onPress={() => { hapticMedium(); handleSave(); }}
            scaleDown={0.97}
            style={styles.primaryBtn}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {category === 'urgent' ? "Log & I'll contact my GP" : category === 'hrt' ? 'Log HRT bleeding' : 'Log as spotting'}
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
  topBar: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  backBtn: { fontSize: 12, color: '#a8a29e' },

  stepTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 4, marginTop: 12 },
  stepSub: { fontSize: 12, color: '#a8a29e', marginBottom: 20 },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#57534e', marginBottom: 8, marginTop: 4 },
  whenRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  whenBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f5f5f4', alignItems: 'center' },
  whenBtnActive: { backgroundColor: '#f43f5e' },
  whenBtnText: { fontSize: 12, fontWeight: '500', color: '#78716c' },
  whenBtnTextActive: { color: '#ffffff' },

  typeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 16, borderWidth: 2, borderColor: '#f5f5f4',
  },
  typeOptionSelected: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  typeLabel: { fontSize: 14, fontWeight: '500', color: '#44403c' },
  typeDesc: { fontSize: 12, color: '#a8a29e', marginTop: 1 },

  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f5f5f4',
  },
  insightTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  insightBody: { fontSize: 12, color: '#78716c', lineHeight: 18 },
  infoBody: { fontSize: 12, color: '#78716c', lineHeight: 18 },
  linkText: { fontSize: 12, fontWeight: '600', color: '#ea580c' },

  bottomBar: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12 },
  primaryBtn: { backgroundColor: '#f43f5e', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffe4e6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  doneTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  doneSub: { fontSize: 14, color: '#78716c', marginBottom: 2 },
  doneMuted: { fontSize: 12, color: '#d6d3d1' },
});

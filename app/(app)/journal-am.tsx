import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const SLEEP_QUALITY_MAP: Record<string, { emoji: string; label: string }> = {
  terrible: { emoji: '😫', label: 'Terrible' },
  poor: { emoji: '😕', label: 'Poor' },
  ok: { emoji: '😐', label: 'Okay' },
  good: { emoji: '😊', label: 'Good' },
  amazing: { emoji: '🥰', label: 'Amazing' },
};

const SYMPTOM_LABELS: Record<string, { emoji: string; label: string }> = {
  hot_flash: { emoji: '🔥', label: 'Hot flashes' },
  brain_fog: { emoji: '😶‍🌫️', label: 'Brain fog' },
  irritability: { emoji: '😤', label: 'Irritability' },
  joint_pain: { emoji: '💪', label: 'Joint pain' },
  anxiety: { emoji: '😰', label: 'Anxiety' },
  fatigue: { emoji: '😩', label: 'Fatigue' },
  nausea: { emoji: '🤢', label: 'Nausea' },
  heart_racing: { emoji: '💓', label: 'Heart racing' },
};

const ENERGY_MAP: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '🪫', label: 'Low' },
  2: { emoji: '😐', label: 'Medium' },
  3: { emoji: '⚡', label: 'High' },
};

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Mild',
  2: 'Moderate',
  3: 'Severe',
};

export default function JournalAMScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [morningLog, setMorningLog] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          setError(false);
          const token = await getToken();
          const today = new Date().toISOString().split('T')[0];
          const logs = await apiRequest(`/api/logs?date=${today}`, token).catch(() => []);
          const entries = Array.isArray(logs) ? logs : [];
          const am = entries.find((e: any) => e.logType === 'morning');
          setMorningLog(am || null);
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      </SafeAreaView>
    );
  }

  // Parse notes if available
  let notes: any = {};
  if (morningLog?.notes) {
    try {
      notes = JSON.parse(morningLog.notes);
    } catch {
      notes = { raw: morningLog.notes };
    }
  }

  // Parse symptoms
  const symptomsObj = morningLog?.symptomsJson || {};
  const symptomKeys = Object.keys(symptomsObj);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.nav}>
        <AnimatedPressable
          onPress={() => { hapticLight(); router.back(); }}
          scaleDown={0.9}
          style={styles.navBack}
        >
          <Text style={styles.navBackText}>← Back</Text>
        </AnimatedPressable>
        <Text style={styles.navTitle}>☀️ Morning review</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>Something went wrong loading your data. Pull down to try again.</Text>
          </View>
        )}

        {!morningLog ? (
          /* Empty state */
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>☀️</Text>
            <Text style={styles.emptyTitle}>No morning check-in yet</Text>
            <Text style={styles.emptyDesc}>
              Start your day with a quick 2-minute check-in to track sleep, symptoms, and set an intention.
            </Text>
            <AnimatedPressable
              onPress={() => {
                hapticMedium();
                router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } });
              }}
              scaleDown={0.96}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaButtonText}>Start morning check-in</Text>
            </AnimatedPressable>
          </View>
        ) : (
          /* Morning summary */
          <View>
            {/* Sleep card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>😴</Text>
                <Text style={styles.cardTitle}>Sleep</Text>
              </View>
              <View style={styles.cardBody}>
                {morningLog.sleepHours != null && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Hours</Text>
                    <Text style={styles.statValue}>~{morningLog.sleepHours}h</Text>
                  </View>
                )}
                {morningLog.sleepQuality && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Quality</Text>
                    <Text style={styles.statValue}>
                      {SLEEP_QUALITY_MAP[morningLog.sleepQuality]?.emoji || ''}{' '}
                      {SLEEP_QUALITY_MAP[morningLog.sleepQuality]?.label || morningLog.sleepQuality}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Symptoms card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>🩺</Text>
                <Text style={styles.cardTitle}>Symptoms</Text>
              </View>
              <View style={styles.cardBody}>
                {symptomKeys.length === 0 ? (
                  <View style={styles.noneRow}>
                    <Text style={styles.noneEmoji}>🌿</Text>
                    <Text style={styles.noneText}>No symptoms logged</Text>
                  </View>
                ) : (
                  symptomKeys.map((key) => {
                    const sev = typeof symptomsObj[key] === 'number' ? symptomsObj[key] : null;
                    const info = SYMPTOM_LABELS[key];
                    const label = info ? info.label : key.replace(/_/g, ' ');
                    const emoji = info ? info.emoji : '•';
                    return (
                      <View key={key} style={styles.symptomRow}>
                        <Text style={styles.symptomLabel}>{emoji} {label}</Text>
                        {sev && (
                          <View style={styles.severityBadge}>
                            <Text style={styles.severityBadgeText}>{SEVERITY_LABELS[sev] || ''}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* Energy card */}
            {morningLog.energy != null && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>⚡</Text>
                  <Text style={styles.cardTitle}>Energy</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.energyDisplay}>
                    {ENERGY_MAP[morningLog.energy]?.emoji || ''}{' '}
                    {ENERGY_MAP[morningLog.energy]?.label || 'Unknown'}
                  </Text>
                </View>
              </View>
            )}

            {/* Notes card */}
            {(notes.grateful || notes.intention || notes.raw) && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>✏️</Text>
                  <Text style={styles.cardTitle}>Morning notes</Text>
                </View>
                <View style={styles.cardBody}>
                  {notes.grateful && (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>Grateful for</Text>
                      <Text style={styles.noteText}>{notes.grateful}</Text>
                    </View>
                  )}
                  {notes.intention && (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>Intention</Text>
                      <Text style={styles.noteText}>{notes.intention}</Text>
                    </View>
                  )}
                  {notes.raw && (
                    <Text style={styles.noteText}>{notes.raw}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Context tags */}
            {morningLog.contextTags && morningLog.contextTags.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>🏷️</Text>
                  <Text style={styles.cardTitle}>Context</Text>
                </View>
                <View style={styles.tagRow}>
                  {morningLog.contextTags.map((tag: string, i: number) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Edit link */}
            <AnimatedPressable
              onPress={() => {
                hapticLight();
                router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } });
              }}
              scaleDown={0.97}
              style={styles.editLink}
            >
              <Text style={styles.editLinkText}>Edit morning check-in</Text>
            </AnimatedPressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 120 },

  /* Nav */
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  navBack: { paddingVertical: 4 },
  navBackText: { fontSize: 13, color: '#a8a29e' },
  navTitle: { fontSize: 15, fontWeight: '600', color: '#1c1917' },
  navSpacer: { width: 50 },

  /* Error */
  errorCard: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { fontSize: 13, color: '#991b1b', lineHeight: 18 },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 8 },
  emptyDesc: {
    fontSize: 13,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  ctaButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  ctaButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  /* Cards */
  card: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardIcon: { fontSize: 16 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  cardBody: { gap: 8 },

  /* Stats */
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: { fontSize: 13, color: '#a8a29e' },
  statValue: { fontSize: 14, fontWeight: '500', color: '#1c1917' },

  /* Symptoms */
  symptomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  symptomLabel: { fontSize: 13, color: '#1c1917' },
  severityBadge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  severityBadgeText: { fontSize: 11, color: '#78716c', fontWeight: '500' },

  noneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noneEmoji: { fontSize: 16 },
  noneText: { fontSize: 13, color: '#78716c' },

  /* Energy */
  energyDisplay: { fontSize: 16, color: '#1c1917', fontWeight: '500' },

  /* Notes */
  noteSection: { marginBottom: 8 },
  noteLabel: { fontSize: 11, color: '#a8a29e', fontWeight: '600', marginBottom: 2 },
  noteText: { fontSize: 13, color: '#1c1917', lineHeight: 20 },

  /* Tags */
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  tag: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontSize: 12, color: '#78716c', fontWeight: '500' },

  /* Edit link */
  editLink: {
    marginHorizontal: 24,
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  editLinkText: { fontSize: 13, color: '#a8a29e', textDecorationLine: 'underline' },
});

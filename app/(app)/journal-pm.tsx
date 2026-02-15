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

const MOOD_MAP: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😔', label: 'Rough' },
  2: { emoji: '😕', label: 'Meh' },
  3: { emoji: '🙂', label: 'Okay' },
  4: { emoji: '😊', label: 'Good' },
  5: { emoji: '✨', label: 'Great' },
};

const ENERGY_MAP: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '🪫', label: 'Low' },
  2: { emoji: '😐', label: 'Medium' },
  3: { emoji: '⚡', label: 'High' },
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

export default function JournalPMScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [eveningLog, setEveningLog] = useState<any>(null);

  const hour = new Date().getHours();
  const eveningAvailable = hour >= 19;

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
          const pm = entries.find((e: any) => e.logType === 'evening');
          setEveningLog(pm || null);
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

  // Parse notes
  let notes: any = {};
  if (eveningLog?.notes) {
    try {
      notes = JSON.parse(eveningLog.notes);
    } catch {
      notes = { raw: eveningLog.notes };
    }
  }

  // Parse symptoms
  const symptomsObj = eveningLog?.symptomsJson || {};
  const symptomKeys = Object.keys(symptomsObj);

  // Parse context tags into categories
  const contextTags: string[] = eveningLog?.contextTags || [];

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
        <Text style={styles.navTitle}>🌙 Evening review</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>Something went wrong loading your data. Pull down to try again.</Text>
          </View>
        )}

        {!eveningLog ? (
          /* Empty state */
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌙</Text>
            <Text style={styles.emptyTitle}>No evening check-in yet</Text>
            <Text style={styles.emptyDesc}>
              {eveningAvailable
                ? 'Reflect on your day with a quick 2-minute evening check-in.'
                : 'Evening check-ins open at 7 PM. Come back later to reflect on your day.'}
            </Text>
            <AnimatedPressable
              onPress={() => {
                if (!eveningAvailable) return;
                hapticMedium();
                router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
              }}
              scaleDown={0.96}
              style={[styles.ctaButton, !eveningAvailable && styles.ctaButtonDisabled]}
            >
              <Text style={styles.ctaButtonText}>
                {eveningAvailable ? 'Start evening check-in' : 'Available at 7 PM'}
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          /* Evening summary */
          <View>
            {/* Mood card */}
            {eveningLog.mood != null && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>🎭</Text>
                  <Text style={styles.cardTitle}>Mood</Text>
                </View>
                <View style={styles.moodDisplay}>
                  <Text style={styles.moodEmoji}>
                    {MOOD_MAP[eveningLog.mood]?.emoji || ''}
                  </Text>
                  <Text style={styles.moodLabel}>
                    {MOOD_MAP[eveningLog.mood]?.label || 'Unknown'}
                  </Text>
                </View>
              </View>
            )}

            {/* Energy card */}
            {eveningLog.energy != null && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>⚡</Text>
                  <Text style={styles.cardTitle}>Energy</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.energyDisplay}>
                    {ENERGY_MAP[eveningLog.energy]?.emoji || ''}{' '}
                    {ENERGY_MAP[eveningLog.energy]?.label || 'Unknown'}
                  </Text>
                </View>
              </View>
            )}

            {/* Symptoms card */}
            {symptomKeys.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>🩺</Text>
                  <Text style={styles.cardTitle}>Symptoms</Text>
                </View>
                <View style={styles.cardBody}>
                  {symptomKeys.map((key) => {
                    const val = symptomsObj[key];
                    const sev = typeof val === 'number' ? val : val?.severity;
                    const comparison = typeof val === 'object' ? val?.comparison : null;
                    const info = SYMPTOM_LABELS[key];
                    const label = info ? info.label : key.replace(/_/g, ' ');
                    const emoji = info ? info.emoji : '•';
                    const sevLabel = sev ? (sev === 1 ? 'Mild' : sev === 2 ? 'Moderate' : 'Severe') : '';
                    return (
                      <View key={key} style={styles.symptomRow}>
                        <Text style={styles.symptomLabel}>{emoji} {label}</Text>
                        <View style={styles.symptomMeta}>
                          {sevLabel ? (
                            <View style={styles.severityBadge}>
                              <Text style={styles.severityBadgeText}>{sevLabel}</Text>
                            </View>
                          ) : null}
                          {comparison && (
                            <View style={styles.comparisonBadge}>
                              <Text style={styles.comparisonBadgeText}>
                                {comparison === 'better' ? '📈 Better' : comparison === 'worse' ? '📉 Worse' : '➡️ Same'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Activities & context tags */}
            {contextTags.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>🏷️</Text>
                  <Text style={styles.cardTitle}>Activities & context</Text>
                </View>
                <View style={styles.tagRow}>
                  {contextTags.map((tag: string, i: number) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Notes card */}
            {(notes.highlight || notes.learned || notes.raw) && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>✏️</Text>
                  <Text style={styles.cardTitle}>Evening notes</Text>
                </View>
                <View style={styles.cardBody}>
                  {notes.highlight && (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>Highlight</Text>
                      <Text style={styles.noteText}>{notes.highlight}</Text>
                    </View>
                  )}
                  {notes.learned && (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>What I'd do differently</Text>
                      <Text style={styles.noteText}>{notes.learned}</Text>
                    </View>
                  )}
                  {notes.raw && (
                    <Text style={styles.noteText}>{notes.raw}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Edit link */}
            <AnimatedPressable
              onPress={() => {
                hapticLight();
                router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
              }}
              scaleDown={0.97}
              style={styles.editLink}
            >
              <Text style={styles.editLinkText}>Edit evening check-in</Text>
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
  ctaButtonDisabled: { opacity: 0.4 },
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

  /* Mood */
  moodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moodEmoji: { fontSize: 32 },
  moodLabel: { fontSize: 18, fontWeight: '600', color: '#1c1917' },

  /* Energy */
  energyDisplay: { fontSize: 16, color: '#1c1917', fontWeight: '500' },

  /* Symptoms */
  symptomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  symptomLabel: { fontSize: 13, color: '#1c1917', flex: 1 },
  symptomMeta: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  severityBadge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  severityBadgeText: { fontSize: 11, color: '#78716c', fontWeight: '500' },
  comparisonBadge: {
    backgroundColor: '#fafaf9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  comparisonBadgeText: { fontSize: 11, color: '#78716c' },

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

  /* Notes */
  noteSection: { marginBottom: 8 },
  noteLabel: { fontSize: 11, color: '#a8a29e', fontWeight: '600', marginBottom: 2 },
  noteText: { fontSize: 13, color: '#1c1917', lineHeight: 20 },

  /* Edit link */
  editLink: {
    marginHorizontal: 24,
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  editLinkText: { fontSize: 13, color: '#a8a29e', textDecorationLine: 'underline' },
});

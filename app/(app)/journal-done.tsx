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

export default function JournalDoneScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [morningLog, setMorningLog] = useState<any>(null);
  const [eveningLog, setEveningLog] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [bothComplete, setBothComplete] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const token = await getToken();
          const today = new Date().toISOString().split('T')[0];

          // Fetch today's logs
          const logs = await apiRequest(`/api/logs?date=${today}`, token).catch(() => []);
          const entries = Array.isArray(logs) ? logs : [];
          const am = entries.find((e: any) => e.logType === 'morning');
          const pm = entries.find((e: any) => e.logType === 'evening');
          setMorningLog(am || null);
          setEveningLog(pm || null);
          setBothComplete(!!am && !!pm);

          // Calculate streak from this week's data
          const now = new Date();
          const dayOfWeek = now.getUTCDay();
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const monday = new Date(now);
          monday.setDate(now.getDate() - mondayOffset);
          const mondayStr = monday.toISOString().split('T')[0];

          const weekLogs = await apiRequest(`/api/logs?from=${mondayStr}&to=${today}`, token).catch(() => []);
          const weekEntries = Array.isArray(weekLogs) ? weekLogs : [];

          let streakCount = 0;
          for (let i = 6; i >= 0; i--) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            if (d > now) continue;
            const dateStr = d.toISOString().split('T')[0];
            const dayLogs = weekEntries.filter((e: any) => e.date === dateStr);
            const hasAm = dayLogs.some((e: any) => e.logType === 'morning');
            if (hasAm) {
              streakCount++;
            } else {
              break;
            }
          }
          setStreak(streakCount);
        } catch {
          // Non-critical
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

  // Collect day summary data
  const sleepHours = morningLog?.sleepHours;
  const sleepQuality = morningLog?.sleepQuality;
  const morningMood = morningLog?.mood;
  const eveningMood = eveningLog?.mood;

  // Merge all symptoms from both logs
  const allSymptoms: Record<string, number> = {};
  if (morningLog?.symptomsJson) {
    Object.entries(morningLog.symptomsJson).forEach(([key, val]: [string, any]) => {
      allSymptoms[key] = typeof val === 'number' ? val : val?.severity || 1;
    });
  }
  if (eveningLog?.symptomsJson) {
    Object.entries(eveningLog.symptomsJson).forEach(([key, val]: [string, any]) => {
      const sev = typeof val === 'number' ? val : val?.severity || 1;
      if (!allSymptoms[key] || sev > allSymptoms[key]) {
        allSymptoms[key] = sev;
      }
    });
  }
  const symptomKeys = Object.keys(allSymptoms);
  const topSymptom = symptomKeys.length > 0
    ? symptomKeys.sort((a, b) => allSymptoms[b] - allSymptoms[a])[0]
    : null;

  // Collect activities from context tags
  const activities: string[] = eveningLog?.contextTags || [];

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
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {bothComplete ? (
          <View>
            {/* Celebration header */}
            <View style={styles.celebHeader}>
              <Text style={styles.celebEmoji}>🎉</Text>
              <Text style={styles.celebTitle}>Day complete!</Text>
              <Text style={styles.celebSubtitle}>
                Both morning and evening check-ins are done. You're building a clear picture of your health.
              </Text>
            </View>

            {/* Streak badge */}
            <View style={styles.streakCard}>
              <View style={styles.streakRow}>
                <Text style={styles.streakFlame}>🔥</Text>
                <View>
                  <Text style={styles.streakCount}>{streak} day streak</Text>
                  <Text style={styles.streakLabel}>Keep the momentum going</Text>
                </View>
              </View>
            </View>

            {/* Day summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Today at a glance</Text>

              {/* Sleep */}
              {(sleepHours != null || sleepQuality) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>😴</Text>
                  <Text style={styles.summaryText}>
                    Sleep: {sleepHours != null ? `~${sleepHours}h` : ''}{' '}
                    {sleepQuality ? `${SLEEP_QUALITY_MAP[sleepQuality]?.emoji || ''} ${SLEEP_QUALITY_MAP[sleepQuality]?.label || sleepQuality}` : ''}
                  </Text>
                </View>
              )}

              {/* Top symptom */}
              {topSymptom && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>
                    {SYMPTOM_LABELS[topSymptom]?.emoji || '•'}
                  </Text>
                  <Text style={styles.summaryText}>
                    Top symptom: {SYMPTOM_LABELS[topSymptom]?.label || topSymptom.replace(/_/g, ' ')}
                    {symptomKeys.length > 1 ? ` (+${symptomKeys.length - 1} more)` : ''}
                  </Text>
                </View>
              )}
              {symptomKeys.length === 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>🌿</Text>
                  <Text style={styles.summaryText}>No symptoms today</Text>
                </View>
              )}

              {/* Mood range */}
              {eveningMood != null && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>🎭</Text>
                  <Text style={styles.summaryText}>
                    Mood: {MOOD_MAP[eveningMood]?.emoji || ''} {MOOD_MAP[eveningMood]?.label || ''}
                  </Text>
                </View>
              )}

              {/* Activities */}
              {activities.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>🏷️</Text>
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {activities.slice(0, 3).join(', ')}
                    {activities.length > 3 ? ` +${activities.length - 3} more` : ''}
                  </Text>
                </View>
              )}
            </View>

            {/* Action buttons */}
            <AnimatedPressable
              onPress={() => {
                hapticMedium();
                router.push('/(app)/insights');
              }}
              scaleDown={0.96}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>View insights →</Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={() => {
                hapticLight();
                router.push('/(app)/calendar');
              }}
              scaleDown={0.97}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>View calendar →</Text>
            </AnimatedPressable>

            {/* Encouraging message */}
            <View style={styles.encourageCard}>
              <Text style={styles.encourageText}>
                Every day you track helps us spot patterns and give you better insights. See you tomorrow!
              </Text>
            </View>
          </View>
        ) : (
          /* Not both complete */
          <View style={styles.incompleteState}>
            <Text style={styles.incompleteEmoji}>📝</Text>
            <Text style={styles.incompleteTitle}>Almost there!</Text>
            <Text style={styles.incompleteDesc}>
              {!morningLog && !eveningLog
                ? 'Complete both your morning and evening check-ins to see your full day summary.'
                : !morningLog
                  ? 'Complete your morning check-in to unlock the full day view.'
                  : 'Complete your evening check-in to see your full day summary.'}
            </Text>

            {!morningLog && (
              <AnimatedPressable
                onPress={() => {
                  hapticMedium();
                  router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } });
                }}
                scaleDown={0.96}
                style={[styles.actionButton, { marginTop: 20 }]}
              >
                <Text style={styles.actionButtonText}>Start morning check-in</Text>
              </AnimatedPressable>
            )}

            {morningLog && !eveningLog && (
              <AnimatedPressable
                onPress={() => {
                  hapticMedium();
                  router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
                }}
                scaleDown={0.96}
                style={[styles.actionButton, { marginTop: 20 }]}
              >
                <Text style={styles.actionButtonText}>Start evening check-in</Text>
              </AnimatedPressable>
            )}
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
  navSpacer: { width: 50 },

  /* Celebration header */
  celebHeader: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 24,
  },
  celebEmoji: { fontSize: 56, marginBottom: 16 },
  celebTitle: { fontSize: 26, fontWeight: '700', color: '#1c1917', marginBottom: 8 },
  celebSubtitle: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 22,
  },

  /* Streak card */
  streakCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakFlame: { fontSize: 28 },
  streakCount: { fontSize: 18, fontWeight: '700', color: '#92400e' },
  streakLabel: { fontSize: 12, color: '#b45309', marginTop: 2 },

  /* Summary card */
  summaryCard: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 14 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  summaryIcon: { fontSize: 16, width: 24 },
  summaryText: { fontSize: 13, color: '#44403c', flex: 1, lineHeight: 20 },

  /* Action buttons */
  actionButton: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  secondaryButton: {
    marginHorizontal: 24,
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  secondaryButtonText: { color: '#1c1917', fontSize: 15, fontWeight: '600' },

  /* Encourage card */
  encourageCard: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  encourageText: { fontSize: 13, color: '#166534', lineHeight: 20, textAlign: 'center' },

  /* Incomplete state */
  incompleteState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  incompleteEmoji: { fontSize: 48, marginBottom: 16 },
  incompleteTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 8 },
  incompleteDesc: {
    fontSize: 13,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 20,
  },
});

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
import { hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const MOOD_MAP: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😔', label: 'Rough' },
  2: { emoji: '😕', label: 'Meh' },
  3: { emoji: '🙂', label: 'Okay' },
  4: { emoji: '😊', label: 'Good' },
  5: { emoji: '✨', label: 'Great' },
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DayEntry {
  date: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  hasAm: boolean;
  hasPm: boolean;
  mood: number | null;
  topSymptom: string | null;
  sleepHours: number | null;
}

export default function JournalWeekScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [days, setDays] = useState<DayEntry[]>([]);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          setError(false);
          const token = await getToken();
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];

          // Build date range for past 7 days (including today)
          const startDate = new Date(today);
          startDate.setDate(today.getDate() - 6);
          const startStr = startDate.toISOString().split('T')[0];

          const logs = await apiRequest(`/api/logs?from=${startStr}&to=${todayStr}`, token).catch(() => []);
          const entries = Array.isArray(logs) ? logs : [];

          // Build day entries
          const dayEntries: DayEntry[] = [];
          for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLogs = entries.filter((e: any) => e.date === dateStr);

            const amLog = dayLogs.find((e: any) => e.logType === 'morning');
            const pmLog = dayLogs.find((e: any) => e.logType === 'evening');

            // Get top symptom from all logs that day
            const allSymptoms: Record<string, number> = {};
            for (const log of dayLogs) {
              if (log.symptomsJson) {
                Object.entries(log.symptomsJson).forEach(([key, val]: [string, any]) => {
                  const sev = typeof val === 'number' ? val : val?.severity || 1;
                  if (!allSymptoms[key] || sev > allSymptoms[key]) {
                    allSymptoms[key] = sev;
                  }
                });
              }
            }
            const symptomKeys = Object.keys(allSymptoms);
            const topSymptom = symptomKeys.length > 0
              ? symptomKeys.sort((a, b) => allSymptoms[b] - allSymptoms[a])[0]
              : null;

            // Mood: prefer evening mood, fall back to morning
            const mood = pmLog?.mood ?? amLog?.mood ?? null;

            dayEntries.push({
              date: dateStr,
              dayLabel: DAY_NAMES[d.getDay()],
              dateLabel: `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`,
              isToday: dateStr === todayStr,
              hasAm: !!amLog,
              hasPm: !!pmLog,
              mood,
              topSymptom,
              sleepHours: amLog?.sleepHours ?? null,
            });
          }

          // Reverse so most recent is first
          setDays(dayEntries.reverse());

          // Calculate streak: consecutive days with at least a morning check-in, going backwards from today
          let streakCount = 0;
          for (const day of dayEntries) {
            if (day.hasAm) {
              streakCount++;
            } else {
              break;
            }
          }
          setStreak(streakCount);
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
        <Text style={styles.navTitle}>Past 7 days</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>Something went wrong loading your data. Try again later.</Text>
          </View>
        )}

        {/* Streak card */}
        <View style={styles.streakCard}>
          <View style={styles.streakRow}>
            <Text style={styles.streakFlame}>🔥</Text>
            <View>
              <Text style={styles.streakCount}>{streak} day streak</Text>
              <Text style={styles.streakLabel}>
                {streak === 0
                  ? 'Start tracking to build your streak'
                  : streak >= 7
                    ? 'Perfect week! Amazing consistency'
                    : 'Keep it going!'}
              </Text>
            </View>
          </View>
        </View>

        {/* Day cards */}
        {days.map((day) => {
          const isEmpty = !day.hasAm && !day.hasPm;
          return (
            <View key={day.date} style={[styles.dayCard, day.isToday && styles.dayCardToday]}>
              {/* Day header */}
              <View style={styles.dayHeader}>
                <View>
                  <Text style={[styles.dayName, day.isToday && styles.dayNameToday]}>
                    {day.isToday ? 'Today' : day.dayLabel}
                  </Text>
                  <Text style={styles.dayDate}>{day.dateLabel}</Text>
                </View>
                {/* Completion dots */}
                <View style={styles.completionDots}>
                  <View style={styles.dotWrap}>
                    <View style={[styles.dot, day.hasAm ? styles.dotAm : styles.dotEmpty]} />
                    <Text style={styles.dotLabel}>AM</Text>
                  </View>
                  <View style={styles.dotWrap}>
                    <View style={[styles.dot, day.hasPm ? styles.dotPm : styles.dotEmpty]} />
                    <Text style={styles.dotLabel}>PM</Text>
                  </View>
                </View>
              </View>

              {isEmpty ? (
                <View style={styles.emptyDay}>
                  <Text style={styles.emptyDayText}>No check-ins</Text>
                </View>
              ) : (
                <View style={styles.dayBody}>
                  {/* Mood */}
                  {day.mood != null && (
                    <View style={styles.dayMeta}>
                      <Text style={styles.dayMetaEmoji}>
                        {MOOD_MAP[day.mood]?.emoji || ''}
                      </Text>
                      <Text style={styles.dayMetaText}>
                        {MOOD_MAP[day.mood]?.label || ''}
                      </Text>
                    </View>
                  )}

                  {/* Top symptom */}
                  {day.topSymptom && (
                    <View style={styles.dayMeta}>
                      <Text style={styles.dayMetaEmoji}>
                        {SYMPTOM_LABELS[day.topSymptom]?.emoji || '•'}
                      </Text>
                      <Text style={styles.dayMetaText}>
                        {SYMPTOM_LABELS[day.topSymptom]?.label || day.topSymptom.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  )}

                  {/* Sleep */}
                  {day.sleepHours != null && (
                    <View style={styles.dayMeta}>
                      <Text style={styles.dayMetaEmoji}>😴</Text>
                      <Text style={styles.dayMetaText}>~{day.sleepHours}h sleep</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Calendar link */}
        <AnimatedPressable
          onPress={() => {
            hapticLight();
            router.push('/(app)/calendar');
          }}
          scaleDown={0.97}
          style={styles.calendarLink}
        >
          <View style={styles.calendarLinkIcon}>
            <Text style={styles.calendarLinkIconText}>📅</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calendarLinkTitle}>View full calendar</Text>
            <Text style={styles.calendarLinkDesc}>See all your entries and patterns</Text>
          </View>
          <Text style={styles.calendarLinkArrow}>›</Text>
        </AnimatedPressable>
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
    marginBottom: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { fontSize: 13, color: '#991b1b', lineHeight: 18 },

  /* Streak card */
  streakCard: {
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: '#1c1917',
    borderRadius: 20,
    padding: 18,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakFlame: { fontSize: 28 },
  streakCount: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  streakLabel: { fontSize: 12, color: '#78716c', marginTop: 2 },

  /* Day cards */
  dayCard: {
    marginHorizontal: 24,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dayCardToday: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayName: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  dayNameToday: { color: '#1c1917' },
  dayDate: { fontSize: 12, color: '#a8a29e', marginTop: 1 },

  /* Completion dots */
  completionDots: {
    flexDirection: 'row',
    gap: 10,
  },
  dotWrap: { alignItems: 'center', gap: 3 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotAm: { backgroundColor: '#fbbf24' },
  dotPm: { backgroundColor: '#818cf8' },
  dotEmpty: { backgroundColor: '#e7e5e4' },
  dotLabel: { fontSize: 9, color: '#a8a29e', fontWeight: '500' },

  /* Day body */
  dayBody: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dayMetaEmoji: { fontSize: 12 },
  dayMetaText: { fontSize: 11, color: '#78716c', fontWeight: '500' },

  /* Empty day */
  emptyDay: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
  emptyDayText: { fontSize: 12, color: '#d6d3d1' },

  /* Calendar link */
  calendarLink: {
    marginHorizontal: 24,
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  calendarLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarLinkIconText: { fontSize: 14, color: '#78716c' },
  calendarLinkTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917' },
  calendarLinkDesc: { fontSize: 11, color: '#a8a29e', marginTop: 1 },
  calendarLinkArrow: { fontSize: 18, color: '#d6d3d1' },
});

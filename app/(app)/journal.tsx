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
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function JournalScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [weekData, setWeekData] = useState<{ am: boolean; pm: boolean }[]>(
    WEEK_DAYS.map(() => ({ am: false, pm: false }))
  );
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);

  const hour = new Date().getHours();
  const eveningAvailable = hour >= 19;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const token = await getToken();
          const today = new Date().toISOString().split('T')[0];

          // Check today's logs
          const logs = await apiRequest(`/api/logs?date=${today}`, token).catch(() => []);
          const entries = Array.isArray(logs) ? logs : [];
          setMorningDone(entries.some((e: any) => e.logType === 'morning'));
          setEveningDone(entries.some((e: any) => e.logType === 'evening'));

          // Get this week's log data for streak display
          const now = new Date();
          const dayOfWeek = now.getUTCDay(); // 0=Sun
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const monday = new Date(now);
          monday.setDate(now.getDate() - mondayOffset);
          const mondayStr = monday.toISOString().split('T')[0];

          const weekLogs = await apiRequest(`/api/logs?from=${mondayStr}&to=${today}`, token).catch(() => []);
          const weekEntries = Array.isArray(weekLogs) ? weekLogs : [];

          // Build week data
          const newWeekData = WEEK_DAYS.map((_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLogs = weekEntries.filter((e: any) => e.date === dateStr);
            return {
              am: dayLogs.some((e: any) => e.logType === 'morning'),
              pm: dayLogs.some((e: any) => e.logType === 'evening'),
            };
          });
          setWeekData(newWeekData);

          // Calculate streak from consecutive AM+PM days
          let streakCount = 0;
          for (let i = newWeekData.length - 1; i >= 0; i--) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            if (d > now) continue;
            if (newWeekData[i].am) {
              streakCount++;
            } else {
              break;
            }
          }
          setStreak(streakCount);

          // Try to get weekly narrative
          try {
            const narratives = await apiRequest(`/api/insights/home?date=${today}`, token).catch(() => null);
            if (narratives?.narrative) {
              setWeeklyInsight(narratives.narrative);
            }
          } catch {
            // Non-critical
          }
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your journal</Text>
          <Text style={styles.subtitle}>2 minutes morning + evening</Text>
        </View>

        {/* Streak card (dark) */}
        <View style={styles.streakCard}>
          <View style={styles.streakTop}>
            <View>
              <Text style={styles.streakLabel}>This week</Text>
              <Text style={styles.streakValue}>
                {streak} day streak
              </Text>
            </View>
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>🔥</Text>
            </View>
          </View>

          {/* Week dots */}
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d, i) => (
              <View key={d} style={styles.weekDay}>
                <Text style={styles.weekDayLabel}>{d}</Text>
                <View style={styles.dotRow}>
                  <View style={[styles.dot, weekData[i].am ? styles.dotAm : styles.dotEmpty]} />
                  <View style={[styles.dot, weekData[i].pm ? styles.dotPm : styles.dotEmpty]} />
                </View>
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.dotAm]} />
              <Text style={styles.legendText}>Morning</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.dotPm]} />
              <Text style={styles.legendText}>Evening</Text>
            </View>
          </View>
        </View>

        {/* Morning card */}
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } });
          }}
          scaleDown={0.97}
          style={[styles.morningCard, morningDone && styles.cardDone]}
        >
          <View style={styles.journalCardRow}>
            <View style={styles.morningIcon}>
              <Text style={styles.morningIconText}>☀</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.journalCardTitle}>Morning check-in</Text>
              <Text style={styles.journalCardDesc}>
                {morningDone ? 'Completed ✓' : 'Sleep, body, what\'s ahead, gratitude'}
              </Text>
              {!morningDone && (
                <Text style={styles.morningTime}>~2 minutes</Text>
              )}
            </View>
            {morningDone ? (
              <View style={styles.checkCircleDone}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            ) : (
              <View style={styles.startBadge}>
                <Text style={styles.startBadgeText}>Start →</Text>
              </View>
            )}
          </View>
        </AnimatedPressable>

        {/* Evening card */}
        <AnimatedPressable
          onPress={() => {
            if (!eveningAvailable && !eveningDone) return;
            hapticMedium();
            router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
          }}
          scaleDown={0.97}
          style={[
            styles.eveningCard,
            (!eveningAvailable && !eveningDone) && styles.cardLocked,
            eveningDone && styles.cardDone,
          ]}
        >
          <View style={styles.journalCardRow}>
            <View style={styles.eveningIcon}>
              <Text style={styles.eveningIconText}>☽</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.journalCardTitle}>Evening reflection</Text>
              <Text style={styles.journalCardDesc}>
                {eveningDone
                  ? 'Completed ✓'
                  : eveningAvailable
                    ? 'How was today, activities, highlight'
                    : 'Available at 7 PM'}
              </Text>
            </View>
            {eveningDone ? (
              <View style={styles.checkCircleDone}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            ) : (
              <View style={styles.emptyCircle} />
            )}
          </View>
        </AnimatedPressable>

        {/* This week's insight */}
        {weeklyInsight && (
          <View style={styles.insightCard}>
            <View style={styles.insightRow}>
              <Text style={styles.insightStar}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>This week's story</Text>
                <Text style={styles.insightText}>{weeklyInsight}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Week view link */}
        <AnimatedPressable
          onPress={() => {
            hapticLight();
            router.push('/(app)/calendar');
          }}
          scaleDown={0.97}
          style={styles.linkCard}
        >
          <View style={styles.linkIcon}>
            <Text style={styles.linkIconText}>📅</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>View full week</Text>
            <Text style={styles.linkDesc}>See your daily entries + patterns</Text>
          </View>
          <Text style={styles.linkArrow}>›</Text>
        </AnimatedPressable>

        {/* Custom tracking nudge */}
        <AnimatedPressable
          onPress={() => {
            hapticLight();
            // Could go to custom tracking when implemented
          }}
          scaleDown={0.97}
          style={[styles.linkCard, { borderWidth: 1, borderColor: '#f5f5f4' }]}
        >
          <View style={styles.linkIcon}>
            <Text style={styles.linkIconText}>✦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Track something else?</Text>
            <Text style={styles.linkDesc}>Add your own symptoms or triggers</Text>
          </View>
          <Text style={styles.linkArrow}>›</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 120 },

  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  subtitle: { fontSize: 12, color: '#a8a29e', marginTop: 2 },

  /* Streak card */
  streakCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#1c1917',
    borderRadius: 20,
    padding: 20,
  },
  streakTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  streakLabel: { fontSize: 12, color: '#78716c' },
  streakValue: { fontSize: 24, fontWeight: '300', color: '#ffffff', marginTop: 2 },
  streakBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#44403c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBadgeText: { fontSize: 22 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 4 },
  weekDayLabel: { fontSize: 11, color: '#78716c' },
  dotRow: { flexDirection: 'row', gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotAm: { backgroundColor: '#fbbf24' },
  dotPm: { backgroundColor: '#818cf8' },
  dotEmpty: { backgroundColor: '#44403c' },

  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#78716c' },

  /* Morning card */
  morningCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  morningIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  morningIconText: { fontSize: 22, color: '#d97706' },
  morningTime: { fontSize: 11, color: '#d97706', fontWeight: '500', marginTop: 4 },

  /* Evening card */
  eveningCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  eveningIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eveningIconText: { fontSize: 22, color: '#6366f1' },

  cardLocked: { opacity: 0.5 },
  cardDone: { opacity: 0.6 },

  journalCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  journalCardTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  journalCardDesc: { fontSize: 12, color: '#78716c', marginTop: 2 },

  startBadge: {
    backgroundColor: '#fbbf24',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startBadgeText: { fontSize: 12, fontWeight: '700', color: '#1c1917' },

  checkCircleDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 14, color: '#ffffff', fontWeight: '600' },

  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d6d3d1',
  },

  /* Insight card */
  insightCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  insightRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  insightStar: { fontSize: 18, color: '#f59e0b' },
  insightTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  insightText: { fontSize: 12, color: '#78716c', lineHeight: 18 },

  /* Link cards */
  linkCard: {
    marginHorizontal: 24,
    marginBottom: 10,
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
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconText: { fontSize: 14, color: '#78716c' },
  linkTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917' },
  linkDesc: { fontSize: 11, color: '#a8a29e', marginTop: 1 },
  linkArrow: { fontSize: 18, color: '#d6d3d1' },
});

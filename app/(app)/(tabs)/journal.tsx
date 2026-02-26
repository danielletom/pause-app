import React, { useState, useCallback, useRef } from 'react';
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
import { getTrialDay, isTrialExpired, getDaysUntilInsights } from '@/lib/trial';
import { useProfile } from '@/lib/useProfile';
import { useDelight, DELIGHT_KEYS } from '@/lib/delight-context';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function JournalScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const hasLoadedOnce = useRef(false);
  const { profile } = useProfile();
  const { hasSeen, markSeen } = useDelight();
  const trialDay = getTrialDay(profile?.createdAt);
  const trialExpired = isTrialExpired(profile?.createdAt);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [weekData, setWeekData] = useState<{ am: boolean; pm: boolean }[]>(
    WEEK_DAYS.map(() => ({ am: false, pm: false }))
  );
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);
  const [eveningAvailable, setEveningAvailable] = useState(new Date().getHours() >= 19);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          if (!hasLoadedOnce.current) setLoading(true);
          setEveningAvailable(new Date().getHours() >= 19);
          const token = await getTokenRef.current();
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

          // Calculate streak — count consecutive days with any log (AM or PM)
          let streakCount = 0;
          for (let i = newWeekData.length - 1; i >= 0; i--) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            if (d > now) continue;
            if (newWeekData[i].am || newWeekData[i].pm) {
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
          hasLoadedOnce.current = true;
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
          <Text style={styles.subtitle}>2 minutes, morning and evening</Text>
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

        {/* Trial expired gate */}
        {trialExpired && (
          <View style={styles.lockedJournal}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>{'\uD83D\uDD12'}</Text>
            <Text style={styles.lockedJournalTitle}>Journal locked</Text>
            <Text style={styles.lockedJournalSub}>Subscribe to keep tracking your symptoms, sleep, and mood daily.</Text>
            <AnimatedPressable
              onPress={() => router.push('/(app)/paywall' as any)}
              scaleDown={0.97}
              style={styles.lockedJournalBtn}
            >
              <Text style={styles.lockedJournalBtnText}>See plans</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push('/(app)/calendar')}
              scaleDown={0.97}
              style={{ marginTop: 10 }}
            >
              <Text style={{ fontSize: 13, color: '#78716c' }}>View past entries {'\u2192'}</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* Morning card */}
        {!trialExpired && (<>
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
                {morningDone ? 'Done ✓' : 'Sleep, symptoms, what you are grateful for'}
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
                  ? 'Done ✓'
                  : eveningAvailable
                    ? 'Mood, energy, and a highlight from today'
                    : 'Opens at 7 PM'}
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
        </>)}

        {/* ══════════ DELIGHT: Evening unlock notice (Day 3+) ══════════ */}
        {!hasSeen(DELIGHT_KEYS.DAY3_EVENING_UNLOCK) && trialDay >= 3 && trialDay <= 5 && (
          <View style={styles.eveningUnlockCard}>
            <View style={styles.eveningUnlockRow}>
              <View style={styles.eveningUnlockIcon}>
                <Text style={{ fontSize: 16 }}>🌙</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.eveningUnlockTitle}>Evening reflection</Text>
                  <View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>
                </View>
                <Text style={styles.eveningUnlockSub}>A quick wind-down helps us track your full day.</Text>
              </View>
              <AnimatedPressable onPress={() => markSeen(DELIGHT_KEYS.DAY3_EVENING_UNLOCK)} scaleDown={0.97}>
                <Text style={{ fontSize: 12, color: '#818cf8', fontWeight: '600' }}>Got it</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* ══════════ DELIGHT: Progress to insights ══════════ */}
        {trialDay < 7 && streak > 0 && (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>Progress to first insights</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (streak / 7) * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {getDaysUntilInsights(streak)} more days of check-ins to unlock your patterns
            </Text>
          </View>
        )}

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
            <Text style={styles.linkDesc}>Daily entries and what we have spotted</Text>
          </View>
          <Text style={styles.linkArrow}>›</Text>
        </AnimatedPressable>

        {/* ══════════ DELIGHT: Custom tracking nudge (Day 8-9) ══════════ */}
        {!hasSeen(DELIGHT_KEYS.CUSTOM_TRACKING_NUDGE) && trialDay >= 8 && trialDay <= 10 && (
          <View style={styles.customNudgeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 14 }}>🔬</Text>
              <Text style={styles.customNudgeLabel}>DID YOU KNOW?</Text>
            </View>
            <Text style={styles.customNudgeTitle}>You can track anything</Text>
            <Text style={styles.customNudgeSub}>
              Add custom symptoms specific to you — like specific foods, exercise, or supplements — and we{'\u2019'}ll look for patterns.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <AnimatedPressable
                onPress={() => {
                  markSeen(DELIGHT_KEYS.CUSTOM_TRACKING_NUDGE);
                  router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } });
                }}
                scaleDown={0.97}
                style={styles.customNudgeBtn}
              >
                <Text style={styles.customNudgeBtnText}>Try it now</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => markSeen(DELIGHT_KEYS.CUSTOM_TRACKING_NUDGE)} scaleDown={0.97}>
                <Text style={{ fontSize: 12, color: '#78716c', lineHeight: 32 }}>Maybe later</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* Gratitude journal entry */}
        <AnimatedPressable
          onPress={() => {
            hapticLight();
            router.push('/(app)/gratitude-journal');
          }}
          scaleDown={0.97}
          style={[styles.linkCard, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fef3c7' }]}
        >
          <View style={[styles.linkIcon, { backgroundColor: '#fef3c7' }]}>
            <Text style={styles.linkIconText}>✦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Gratitude journal</Text>
            <Text style={styles.linkDesc}>The good things you have noticed</Text>
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
  subtitle: { fontSize: 14, color: '#78716c', marginTop: 2 },

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
  streakLabel: { fontSize: 14, color: '#78716c' },
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
  weekDayLabel: { fontSize: 14, color: '#78716c' },
  dotRow: { flexDirection: 'row', gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotAm: { backgroundColor: '#fbbf24' },
  dotPm: { backgroundColor: '#818cf8' },
  dotEmpty: { backgroundColor: '#44403c' },

  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 14, color: '#78716c' },

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
  morningIconText: { fontSize: 22, color: '#b45309' },
  morningTime: { fontSize: 14, color: '#b45309', fontWeight: '500', marginTop: 4 },

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
  journalCardTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917' },
  journalCardDesc: { fontSize: 16, color: '#78716c', marginTop: 2 },

  startBadge: {
    backgroundColor: '#fbbf24',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startBadgeText: { fontSize: 16, fontWeight: '700', color: '#1c1917' },

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
  insightStar: { fontSize: 18, color: '#b45309' },
  insightTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  insightText: { fontSize: 16, color: '#78716c', lineHeight: 22 },

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
  linkTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917' },
  linkDesc: { fontSize: 14, color: '#78716c', marginTop: 1 },
  linkArrow: { fontSize: 18, color: '#78716c' },

  // Evening unlock card (purple)
  eveningUnlockCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  eveningUnlockRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eveningUnlockIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eveningUnlockTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  eveningUnlockSub: { fontSize: 12, color: '#6366f1', marginTop: 2 },
  newBadge: {
    backgroundColor: '#818cf8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  newBadgeText: { fontSize: 9, fontWeight: '700', color: '#ffffff' },

  // Progress to insights
  progressCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  progressLabel: { fontSize: 12, fontWeight: '600', color: '#b45309', marginBottom: 8 },
  progressBar: {
    height: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 6,
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  progressText: { fontSize: 12, color: '#78716c' },

  // Custom tracking nudge (Day 8-9)
  customNudgeCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderStyle: 'dashed',
  },
  customNudgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a8a29e',
    letterSpacing: 1,
  },
  customNudgeTitle: { fontSize: 15, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  customNudgeSub: { fontSize: 13, color: '#78716c', lineHeight: 19 },
  customNudgeBtn: {
    backgroundColor: '#1c1917',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  customNudgeBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },

  // Locked journal (trial expired)
  lockedJournal: {
    marginHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 32,
  },
  lockedJournalTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 6 },
  lockedJournalSub: { fontSize: 14, color: '#78716c', textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 8 },
  lockedJournalBtn: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  lockedJournalBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});

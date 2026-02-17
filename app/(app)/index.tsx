import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';
import { useProfile } from '@/lib/useProfile';

/* ─── Date helpers ────────────────────────────────────────── */

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildWeekStrip(): { dateStr: string; day: string; num: number; isToday: boolean }[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const days: { dateStr: string; day: string; num: number; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      dateStr: toDateStr(d),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
      num: d.getDate(),
      isToday: toDateStr(d) === toDateStr(today),
    });
  }
  return days;
}

function formatDateHeader(dateStr: string): string {
  const today = toDateStr(new Date());
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d); })();
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const MOOD_EMOJI: Record<number, string> = { 1: '😔', 2: '😕', 3: '🙂', 4: '😊', 5: '✨' };
const MOOD_LABEL: Record<number, string> = { 1: 'Rough', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' };

interface LogEntry {
  id: number;
  date: string;
  loggedAt: string | null;
  symptomsJson: Record<string, number> | null;
  mood: number | null;
  energy: number | null;
  sleepHours: number | null;
  sleepQuality: string | null;
  disruptions: number | null;
  contextTags: string[] | null;
  logType: string | null;
  notes: string | null;
}

/* ─── Readiness score algorithm ─────────────────────────── */
// Weighted: Sleep 40%, Mood 25%, Symptom load 20%, Stressors 15%
function computeReadiness(entries: LogEntry[]): number | null {
  if (entries.length === 0) return null;

  // Use latest values for each dimension
  const latestMood = entries.find((e) => e.mood != null)?.mood;
  const latestSleep = entries.find((e) => e.sleepHours != null);
  const sleepHours = latestSleep?.sleepHours ?? null;
  const sleepQuality = latestSleep?.sleepQuality ?? null;
  const disruptions = latestSleep?.disruptions ?? 0;

  // Aggregate all symptoms across entries
  // Handle both plain numbers and legacy object values {severity, comparison}
  const allSymptoms: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.symptomsJson) {
      Object.entries(e.symptomsJson).forEach(([k, v]) => {
        const numVal = typeof v === 'number' ? v : (typeof v === 'object' && v !== null ? ((v as any).severity ?? 1) : 1);
        allSymptoms[k] = Math.max(allSymptoms[k] || 0, numVal);
      });
    }
  });
  const symptomCount = Object.keys(allSymptoms).length;
  const avgSeverity = symptomCount > 0
    ? Object.values(allSymptoms).reduce((a, b) => a + b, 0) / symptomCount
    : 0;

  // Aggregate stressors
  const allStressors = new Set<string>();
  entries.forEach((e) => {
    (e.contextTags || []).forEach((t) => allStressors.add(t));
  });
  const stressorCount = allStressors.size;

  // Sleep score (0-100): 7-9h = excellent range, quality bonus/penalty
  let sleepScore = 50; // default if no data
  if (sleepHours !== null) {
    // Better scoring: 7-9h is optimal (score 85-100), <5h is poor, >10h slightly penalized
    if (sleepHours >= 7 && sleepHours <= 9) {
      sleepScore = 85 + Math.min(15, (sleepHours - 7) * 7.5); // 7h=85, 8h=92, 9h=100
    } else if (sleepHours >= 6) {
      sleepScore = 70 + (sleepHours - 6) * 15; // 6h=70
    } else if (sleepHours >= 5) {
      sleepScore = 50 + (sleepHours - 5) * 20; // 5h=50
    } else {
      sleepScore = Math.max(10, sleepHours * 12.5); // 4h=50, 3h=37, 0h=10
    }
    // Quality adjustments — only when explicitly rated
    if (sleepQuality === 'amazing') sleepScore = Math.min(100, sleepScore + 10);
    else if (sleepQuality === 'good') sleepScore = Math.min(100, sleepScore + 5);
    else if (sleepQuality === 'poor') sleepScore -= 10;
    else if (sleepQuality === 'terrible') sleepScore -= 20;
    // Disruptions penalty
    sleepScore -= Math.min(15, (disruptions ?? 0) * 5);
  }

  // Mood score (0-100): mood 5=100, 1=20
  const moodScore = latestMood ? latestMood * 20 : 50;

  // Symptom score (0-100): fewer/lower = better
  const symptomScore = Math.max(10, 100 - (symptomCount * 10) - (avgSeverity * 3));

  // Stressor score (0-100): fewer = better
  const stressorScore = Math.max(10, 100 - (stressorCount * 12));

  // Weighted average
  const score = Math.round(
    sleepScore * 0.40 +
    moodScore * 0.25 +
    symptomScore * 0.20 +
    stressorScore * 0.15
  );
  return Math.min(99, Math.max(5, score));
}

interface Medication {
  id: number;
  name: string;
  dose: string | null;
  time: string | null;
  type: string | null;
}

interface MedLog {
  id: number;
  medicationId: number;
  date: string;
  taken: boolean;
}

interface ArticleSummary {
  id: number;
  title: string;
  category: string | null;
  readTime: number | null;
}

export default function HomeScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { profile } = useProfile();
  const router = useRouter();
  const [dayLogs, setDayLogs] = useState<LogEntry[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [todayMedLogs, setTodayMedLogs] = useState<MedLog[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [lastLoggedHoursAgo, setLastLoggedHoursAgo] = useState<number | null>(null);
  const [weekLogStatus, setWeekLogStatus] = useState<Record<string, { am: boolean; pm: boolean }>>({});
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [serverReadiness, setServerReadiness] = useState<number | null>(null);
  const [insightNudge, setInsightNudge] = useState<{ title: string; body: string } | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const dateStrip = useMemo(() => buildWeekStrip(), []);
  const isToday = selectedDate === todayStr;

  const dateString = useMemo(() => formatDateHeader(selectedDate), [selectedDate]);
  const firstName = profile?.name?.split(' ')[0] || user?.firstName || 'there';
  const initial = firstName[0]?.toUpperCase() || '?';

  const fetchData = useCallback(async () => {
    try {
      // Only show spinner on first load — silently refresh after that
      if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      const token = await getTokenRef.current();
      const todayDate = toDateStr(new Date());
      const [logData, medsData, medLogsData, recentLogs, articlesData, homeData] = await Promise.all([
        apiRequest(`/api/logs?date=${selectedDate}`, token).catch(() => []),
        apiRequest('/api/meds', token).catch(() => []),
        apiRequest(`/api/meds/logs?date=${todayDate}`, token).catch(() => []),
        apiRequest('/api/logs?range=28d', token).catch(() => []),
        apiRequest('/api/articles', token).catch(() => []),
        apiRequest(`/api/insights/home?date=${todayDate}`, token).catch(() => null),
      ]);
      // API now returns array of entries per day
      setDayLogs(Array.isArray(logData) ? logData : logData ? [logData] : []);
      setMeds(medsData);
      if (Array.isArray(medLogsData)) setTodayMedLogs(medLogsData);
      if (Array.isArray(articlesData)) setArticles(articlesData.slice(0, 3));

      // Calculate streak — deduplicate by date first
      if (Array.isArray(recentLogs) && recentLogs.length > 0) {
        // Get unique dates that have logs
        const uniqueDates = [...new Set(recentLogs.map((l: any) => l.date))]
          .sort((a, b) => b.localeCompare(a)); // newest first

        let count = 0;
        const checkDate = new Date();
        // If today has no log yet, start checking from yesterday
        if (uniqueDates[0] !== todayDate) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
        for (const logDate of uniqueDates) {
          const expected = checkDate.toISOString().split('T')[0];
          if (logDate === expected) {
            count++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (logDate < expected) {
            break; // gap found
          }
          // Skip duplicates (logDate > expected shouldn't happen with sorted unique dates)
        }
        setStreak(count);
        // Hours since last log
        if (uniqueDates.length > 0) {
          const lastDate = new Date(uniqueDates[0] + 'T12:00:00');
          const hrs = Math.round((Date.now() - lastDate.getTime()) / 3600000);
          setLastLoggedHoursAgo(hrs);
        }
      }
      // Set recommendation + AI data from home API
      if (homeData) {
        if (homeData.recommendation) setRecommendation(homeData.recommendation);
        if (homeData.readiness != null) setServerReadiness(homeData.readiness);
        if (homeData.insightNudge) setInsightNudge(homeData.insightNudge);
        if (homeData.narrative) setNarrative(homeData.narrative);
      }

      // Build week log status for AM/PM dots
      if (Array.isArray(recentLogs) && recentLogs.length > 0) {
        const statusMap: Record<string, { am: boolean; pm: boolean }> = {};
        for (const log of recentLogs) {
          if (!statusMap[log.date]) statusMap[log.date] = { am: false, pm: false };
          if (log.logType === 'morning') statusMap[log.date].am = true;
          if (log.logType === 'evening') statusMap[log.date].pm = true;
        }
        setWeekLogStatus(statusMap);
      }

      hasLoadedOnce.current = true;
    } catch {
      // Non-critical
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const hasLog = dayLogs.length > 0;
  const latestLog = dayLogs.length > 0 ? dayLogs[0] : null;

  // Morning/evening status for smart CTA
  const morningDone = dayLogs.some((e) => e.logType === 'morning');
  const eveningDone = dayLogs.some((e) => e.logType === 'evening');
  const hour = new Date().getHours();
  const suggestEvening = hour >= 14 || morningDone;

  // Readiness score from proper algorithm
  const readinessScore = useMemo(() => computeReadiness(dayLogs), [dayLogs]);

  // Symptom trends — aggregate across all entries for the day
  // Handle both plain numbers and legacy object values {severity, comparison}
  const symptomTrends = useMemo(() => {
    const merged: Record<string, number> = {};
    dayLogs.forEach((log) => {
      if (log.symptomsJson) {
        Object.entries(log.symptomsJson).forEach(([k, v]) => {
          const numVal = typeof v === 'number' ? v : (typeof v === 'object' && v !== null ? ((v as any).severity ?? 1) : 1);
          merged[k] = Math.max(merged[k] || 0, numVal);
        });
      }
    });
    const entries = Object.entries(merged)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
    const colors = ['#fbbf24', '#818cf8', '#34d399', '#fda4af'];
    return entries.map(([name, sev], i) => ({
      name: name
        .replace(/_/g, ' ')                           // snake_case → spaces
        .replace(/([A-Z])/g, ' $1')                   // camelCase → spaces
        .replace(/\b\w/g, (s) => s.toUpperCase())     // capitalize each word
        .trim(),
      sev: Math.min(sev, 3),                          // severity is already 1-3
      color: colors[i % colors.length],
    }));
  }, [dayLogs]);

  // Sleep data from latest entry that has it
  const sleepLog = useMemo(() => dayLogs.find((l) => l.sleepHours != null), [dayLogs]);
  // Latest mood
  const latestMood = useMemo(() => dayLogs.find((l) => l.mood != null)?.mood ?? null, [dayLogs]);

  // Med taken status
  const isMedTaken = useCallback(
    (medId: number) => todayMedLogs.some((l) => l.medicationId === medId && l.taken),
    [todayMedLogs]
  );
  const medsTakenCount = useMemo(
    () => meds.filter((m) => isMedTaken(m.id)).length,
    [meds, isMedTaken]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — date, name, avatar */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateText}>{dateString}</Text>
            <Text style={styles.greeting}>{isToday ? `Hi, ${firstName}` : formatDateHeader(selectedDate)}</Text>
          </View>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.push('/(app)/profile'); }}
            scaleDown={0.95}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </AnimatedPressable>
        </View>

        {/* Streak calendar strip — 7-day week with AM/PM dots */}
        <View style={styles.weekStrip}>
          {dateStrip.map((item) => {
            const selected = item.dateStr === selectedDate;
            const status = weekLogStatus[item.dateStr];
            return (
              <AnimatedPressable
                key={item.dateStr}
                onPress={() => {
                  hapticSelection();
                  setSelectedDate(item.dateStr);
                }}
                scaleDown={0.9}
                style={[styles.weekStripItem, selected && styles.weekStripItemSelected]}
              >
                <Text style={[styles.weekStripDay, selected && styles.weekStripDaySelected]}>
                  {item.day}
                </Text>
                <Text style={[styles.weekStripNum, selected && styles.weekStripNumSelected]}>
                  {item.num}
                </Text>
                <View style={styles.weekDotRow}>
                  <View style={[styles.weekDot, status?.am ? styles.weekDotAm : styles.weekDotEmpty]} />
                  <View style={[styles.weekDot, status?.pm ? styles.weekDotPm : styles.weekDotEmpty]} />
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
        <View style={styles.weekLegend}>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, styles.weekDotAm]} />
            <Text style={styles.weekLegendText}>AM</Text>
          </View>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, styles.weekDotPm]} />
            <Text style={styles.weekLegendText}>PM</Text>
          </View>
          <View style={{ flex: 1 }} />
          <AnimatedPressable onPress={() => { hapticLight(); router.push('/(app)/calendar'); }} scaleDown={0.97}>
            <Text style={styles.seeAll}>See all →</Text>
          </AnimatedPressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : (
          <>
            {/* Readiness Score Card — dark, with activity recommendation inside */}
            {(() => {
              // Prefer server-computed score, fall back to client-side
              const score = serverReadiness ?? readinessScore;
              const scoreNum = score ?? 0;
              const circumference = 163.4;
              const arcLength = (scoreNum / 100) * circumference;
              const activityLabel = (score ?? 0) >= 70 ? 'Good day for activity' : (score ?? 0) >= 40 ? 'Take it easy' : 'Rest & recover';
              const activityColor = (score ?? 0) >= 70 ? '#34d399' : (score ?? 0) >= 40 ? '#fbbf24' : '#fca5a5';
              return (
                <View style={styles.readinessCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readinessLabel}>READINESS SCORE</Text>
                    <Text style={styles.readinessValue}>{score ?? '—'}</Text>
                    {hasLog && (
                      <>
                        <Text style={[styles.readinessActivity, { color: activityColor }]}>{activityLabel}</Text>
                        <Text style={styles.readinessHint}>
                          {recommendation || narrative || (
                            `${sleepLog?.sleepHours ? `${sleepLog.sleepHours}h sleep` : 'Sleep data'}${latestMood ? ` + ${MOOD_LABEL[latestMood]?.toLowerCase() || ''} mood` : ''}${symptomTrends.length > 0 ? ` + ${symptomTrends.length <= 2 ? 'low' : 'moderate'} symptoms` : ''}`
                          )}
                        </Text>
                      </>
                    )}
                    {!hasLog && (
                      <Text style={styles.readinessHint}>
                        {isToday ? 'Log today to see your score' : 'No data for this day'}
                      </Text>
                    )}
                    {/* Stats row inside card */}
                    {hasLog && (
                      <View style={styles.readinessStatsInline}>
                        <Text style={styles.readinessStatText}>
                          Sleep: {sleepLog?.sleepHours ? `${sleepLog.sleepHours}h ✓` : '—'}
                        </Text>
                        <Text style={styles.readinessStatDot}>·</Text>
                        <Text style={styles.readinessStatText}>
                          Symptoms: {symptomTrends.length > 0 ? (symptomTrends.length <= 2 ? 'Low ✓' : 'Moderate') : 'None ✓'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.readinessRingOuter}>
                    <View style={styles.readinessRing}>
                      {score !== null && (
                        <View style={styles.readinessArcWrap}>
                          <Svg width={64} height={64} viewBox="0 0 64 64">
                            <Circle
                              cx={32} cy={32} r={26}
                              fill="none"
                              stroke="#a8a29e"
                              strokeWidth={3}
                              strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                              strokeLinecap="round"
                              transform="rotate(-90 32 32)"
                            />
                          </Svg>
                        </View>
                      )}
                      <Text style={styles.readinessRingScore}>{score ?? '—'}</Text>
                    </View>
                    <Text style={styles.readinessRingLabel}>/100</Text>
                  </View>
                </View>
              );
            })()}

            {/* Quick actions — SOS + Check-in / Log */}
            <View style={styles.actionRow}>
              <AnimatedPressable
                onPress={() => { hapticMedium(); router.push('/(app)/sos'); }}
                scaleDown={0.97}
                style={styles.sosCard}
              >
                <View style={styles.sosIcon}>
                  <Text style={{ fontSize: 18 }}>❄</Text>
                </View>
                <Text style={styles.sosTitle}>SOS</Text>
                <Text style={styles.sosSubtitle}>Hot flash</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  hapticMedium();
                  if (!morningDone) {
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                  } else if (!eveningDone) {
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening' } });
                  } else {
                    router.push('/(app)/log');
                  }
                }}
                scaleDown={0.97}
                style={styles.checkinCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkinTitle}>
                    {!morningDone ? '☀ Morning check-in' : !eveningDone ? '☽ Evening check-in' : '+ Log symptoms'}
                  </Text>
                  <Text style={styles.checkinSub}>
                    {!morningDone || !eveningDone
                      ? `2 min${lastLoggedHoursAgo ? ` · Last logged ${lastLoggedHoursAgo}h ago` : ''}`
                      : 'Quick symptom log'}
                  </Text>
                </View>
                <View style={styles.checkinArrow}>
                  <Text style={{ fontSize: 14, color: '#ffffff' }}>→</Text>
                </View>
              </AnimatedPressable>
            </View>

            {/* Daily Journal card — works for today and past days */}
            <AnimatedPressable
              onPress={() => {
                hapticMedium();
                if (!morningDone) {
                  router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                } else if (!eveningDone) {
                  router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening' } });
                } else if (isToday) {
                  router.push('/(app)/journal');
                }
              }}
              scaleDown={0.97}
              style={styles.journalCard}
            >
              <View style={styles.journalCardRow}>
                <View style={styles.journalMorningIcon}>
                  <Text style={{ fontSize: 18, color: '#b45309' }}>☀</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.journalCardTitle}>
                    {morningDone ? 'Morning ✓' : 'Morning journal'}
                  </Text>
                  <Text style={styles.journalCardDesc}>
                    {morningDone ? 'Completed' : isToday ? "How'd you sleep? 2 min check-in" : 'Log morning for this day'}
                  </Text>
                </View>
                {!morningDone && isToday && hour < 14 && (
                  <View style={styles.nowBadge}>
                    <Text style={styles.nowBadgeText}>NOW</Text>
                  </View>
                )}
                {morningDone && (
                  <View style={styles.journalCheckDone}>
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>✓</Text>
                  </View>
                )}
                {!morningDone && (!isToday || hour >= 14) && <View style={styles.journalEmptyCheck} />}
              </View>
              <View style={[styles.journalCardRow, { marginTop: 12 }]}>
                <View style={styles.journalEveningIcon}>
                  <Text style={{ fontSize: 18, color: '#6366f1' }}>☽</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.journalCardTitle, !eveningDone && isToday && hour < 19 && { color: '#57534e' }]}>
                    {eveningDone ? 'Evening ✓' : 'Evening reflection'}
                  </Text>
                  <Text style={styles.journalCardDesc}>
                    {eveningDone ? 'Completed' : isToday ? (hour >= 19 ? 'How was today?' : 'Available tonight at 7 PM') : 'Log evening for this day'}
                  </Text>
                </View>
                {eveningDone && (
                  <View style={styles.journalCheckDone}>
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>✓</Text>
                  </View>
                )}
                {!eveningDone && <View style={styles.journalEmptyCheck} />}
              </View>
              {/* Mini streak */}
              {streak > 0 && (
                <View style={styles.journalStreak}>
                  <Text style={styles.journalStreakText}>{streak} day streak</Text>
                </View>
              )}
            </AnimatedPressable>

            {/* Today's Meds */}
            {meds.length > 0 && isToday && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Today's meds</Text>
                  <AnimatedPressable onPress={() => { hapticLight(); router.push('/(app)/meds'); }} scaleDown={0.97}>
                    <Text style={styles.seeAll}>Manage →</Text>
                  </AnimatedPressable>
                </View>
                <View style={styles.medsCard}>
                  {meds.map((med) => {
                    const taken = isMedTaken(med.id);
                    return (
                      <AnimatedPressable
                        key={med.id}
                        onPress={async () => {
                          hapticLight();
                          try {
                            const token = await getTokenRef.current();
                            await apiRequest('/api/meds/logs', token, {
                              method: 'POST',
                              body: JSON.stringify({ medicationId: med.id, date: todayStr, taken: !taken }),
                            });
                            fetchData();
                          } catch { /* non-critical */ }
                        }}
                        scaleDown={0.97}
                        style={styles.medRow}
                      >
                        <View style={[
                          styles.medRowIcon,
                          med.type === 'supplement' ? { backgroundColor: '#fef3c7' } : { backgroundColor: '#1c1917' },
                        ]}>
                          <Text style={{ fontSize: 12, color: med.type === 'supplement' ? '#b45309' : '#fff' }}>
                            {med.type === 'supplement' ? '⬡' : '◎'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.medRowName, taken && styles.medRowNameTaken]}>
                            {med.name}
                          </Text>
                          <Text style={styles.medRowDose}>
                            {med.dose || ''}{med.time ? ` · ${med.time}` : ''}
                          </Text>
                        </View>
                        <View style={[styles.medRowCheck, taken && styles.medRowCheckDone]}>
                          {taken && <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>✓</Text>}
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                  <View style={styles.medsSummary}>
                    <Text style={styles.medsSummaryText}>
                      {medsTakenCount} of {meds.length} taken today
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Meds empty state for new users */}
            {meds.length === 0 && isToday && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today's meds</Text>
                <View style={styles.medsEmptyCard}>
                  <Text style={styles.medsEmptyIcon}>💊</Text>
                  <Text style={styles.medsEmptyTitle}>Track your medications</Text>
                  <Text style={styles.medsEmptyDesc}>
                    Add supplements, HRT, or prescriptions to track daily
                  </Text>
                  <AnimatedPressable
                    onPress={() => { hapticLight(); router.push('/(app)/meds'); }}
                    scaleDown={0.97}
                    style={styles.medsEmptyButton}
                  >
                    <Text style={styles.medsEmptyButtonText}>+ Add medications</Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}

            {/* How you're doing — symptom trend grid */}
            {(symptomTrends.length > 0 || hasLog) && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>How you're doing</Text>
                  <AnimatedPressable onPress={() => { hapticLight(); router.push('/(app)/insights'); }} scaleDown={0.97}>
                    <Text style={styles.seeAll}>See why →</Text>
                  </AnimatedPressable>
                </View>
                {symptomTrends.length > 0 ? (
                  <View style={styles.trendGrid}>
                    {symptomTrends.map((s) => (
                      <AnimatedPressable
                        key={s.name}
                        onPress={() => {
                          hapticLight();
                          router.push({ pathname: '/(app)/insights', params: { symptom: s.name } } as any);
                        }}
                        scaleDown={0.97}
                        style={styles.trendCard}
                      >
                        <View style={styles.trendBarsRow}>
                          {[1, 2, 3].map((i) => (
                            <View
                              key={i}
                              style={[
                                styles.trendBar,
                                { backgroundColor: i <= s.sev ? s.color : '#e7e5e4' },
                              ]}
                            />
                          ))}
                          <Text style={styles.trendName}>{s.name}</Text>
                        </View>
                      </AnimatedPressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.cardHintText}>
                      Log symptoms to see your trends here
                    </Text>
                  </View>
                )}

                {/* Sleep score row — tappable to edit */}
                {sleepLog?.sleepHours && (
                  <AnimatedPressable
                    onPress={() => {
                      hapticLight();
                      router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                    }}
                    scaleDown={0.97}
                    style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }]}
                  >
                    <View style={styles.trendBarsRow}>
                      {[1, 2, 3].map((i) => (
                        <View
                          key={i}
                          style={[
                            styles.trendBar,
                            { backgroundColor: i <= Math.ceil((sleepLog.sleepHours ?? 0) / 3) ? '#818cf8' : '#e7e5e4' },
                          ]}
                        />
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trendName}>
                        Sleep{' '}
                        <Text style={{ color: '#4f46e5', fontWeight: '700' }}>
                          {sleepLog.sleepHours}h
                        </Text>
                      </Text>
                      <Text style={styles.trendSubtext}>
                        {sleepLog.disruptions ? `${sleepLog.disruptions} disruption${sleepLog.disruptions !== 1 ? 's' : ''}` : 'No disruptions logged'}
                        {sleepLog.sleepQuality ? ` · ${sleepLog.sleepQuality}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#78716c' }}>Edit →</Text>
                  </AnimatedPressable>
                )}
              </View>
            )}

            {/* Insight nudge — pattern detection (from AI or fallback) */}
            {(insightNudge || (hasLog && symptomTrends.length > 0)) && (
              <AnimatedPressable
                onPress={() => { hapticLight(); router.push('/(app)/insights'); }}
                scaleDown={0.98}
                style={styles.insightCard}
              >
                <Text style={styles.insightStar}>✦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>
                    {insightNudge?.title || (
                      streak >= 14
                        ? `Overall ${symptomTrends.length > 0 ? 'improving' : 'stable'}. ${symptomTrends[0]?.name || 'Your patterns'} trending.`
                        : 'We spotted a pattern'
                    )}
                  </Text>
                  <Text style={styles.insightDesc}>
                    {insightNudge?.body || (
                      streak >= 14
                        ? `Your ${symptomTrends[0]?.name?.toLowerCase() || 'top symptom'} tends to worsen after poor sleep.`
                        : 'Keep logging daily so we can identify triggers and trends in your symptoms.'
                    )}
                  </Text>
                  <Text style={[styles.seeAll, { marginTop: 6 }]}>See why →</Text>
                </View>
              </AnimatedPressable>
            )}

            {/* Morning / Evening summary cards */}
            {dayLogs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today's journal</Text>
                <View style={{ gap: 8 }}>
                  {/* Morning summary */}
                  {(() => {
                    const amLog = dayLogs.find((e) => e.logType === 'morning');
                    if (!amLog) return null;
                    const time = amLog.loggedAt
                      ? new Date(amLog.loggedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : '';
                    // Parse notes for gratitude
                    let grateful = '';
                    try {
                      if (amLog.notes) {
                        const parsed = JSON.parse(amLog.notes);
                        if (parsed.grateful) grateful = parsed.grateful;
                      }
                    } catch { /* not JSON */ }

                    return (
                      <AnimatedPressable
                        onPress={() => {
                          hapticLight();
                          router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning', logId: String(amLog.id) } });
                        }}
                        scaleDown={0.97}
                        style={styles.summaryCard}
                      >
                        <View style={styles.summaryHeader}>
                          <Text style={styles.summaryEmoji}>☀️</Text>
                          <Text style={styles.summaryTitle}>Morning check-in</Text>
                          {time ? <Text style={styles.summaryTime}>{time}</Text> : null}
                        </View>
                        <View style={styles.summaryChips}>
                          {amLog.sleepHours && (
                            <View style={styles.summaryChip}>
                              <Text style={styles.summaryChipText}>😴 {amLog.sleepHours}h sleep</Text>
                            </View>
                          )}
                          {amLog.symptomsJson && Object.keys(amLog.symptomsJson).length > 0 && (
                            <View style={styles.summaryChip}>
                              <Text style={styles.summaryChipText}>
                                🔥 {Object.keys(amLog.symptomsJson).length} symptom{Object.keys(amLog.symptomsJson).length !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          )}
                          {amLog.energy && (
                            <View style={styles.summaryChip}>
                              <Text style={styles.summaryChipText}>
                                {amLog.energy === 1 ? '🪫' : amLog.energy === 2 ? '😐' : '⚡'} Energy
                              </Text>
                            </View>
                          )}
                        </View>
                        {grateful ? (
                          <Text style={styles.summaryGratitude}>💛 "{grateful.substring(0, 50)}{grateful.length > 50 ? '...' : ''}"</Text>
                        ) : null}
                      </AnimatedPressable>
                    );
                  })()}

                  {/* Evening summary or CTA */}
                  {(() => {
                    const pmLog = dayLogs.find((e) => e.logType === 'evening');
                    if (pmLog) {
                      const time = pmLog.loggedAt
                        ? new Date(pmLog.loggedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        : '';
                      let highlight = '';
                      try {
                        if (pmLog.notes) {
                          const parsed = JSON.parse(pmLog.notes);
                          if (parsed.highlight) highlight = parsed.highlight;
                        }
                      } catch { /* not JSON */ }

                      return (
                        <AnimatedPressable
                          onPress={() => {
                            hapticLight();
                            router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening', logId: String(pmLog.id) } });
                          }}
                          scaleDown={0.97}
                          style={styles.summaryCard}
                        >
                          <View style={styles.summaryHeader}>
                            <Text style={styles.summaryEmoji}>🌙</Text>
                            <Text style={styles.summaryTitle}>Evening reflection</Text>
                            {time ? <Text style={styles.summaryTime}>{time}</Text> : null}
                          </View>
                          <View style={styles.summaryChips}>
                            {pmLog.mood && (
                              <View style={styles.summaryChip}>
                                <Text style={styles.summaryChipText}>{MOOD_EMOJI[pmLog.mood]} {MOOD_LABEL[pmLog.mood]}</Text>
                              </View>
                            )}
                            {pmLog.symptomsJson && Object.keys(pmLog.symptomsJson).length > 0 && (
                              <View style={styles.summaryChip}>
                                <Text style={styles.summaryChipText}>
                                  {Object.keys(pmLog.symptomsJson).length} symptom{Object.keys(pmLog.symptomsJson).length !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            )}
                          </View>
                          {highlight ? (
                            <Text style={styles.summaryGratitude}>✨ "{highlight.substring(0, 50)}{highlight.length > 50 ? '...' : ''}"</Text>
                          ) : null}
                        </AnimatedPressable>
                      );
                    }

                    // Evening not done — show CTA card
                    if (isToday && morningDone && !eveningDone) {
                      return (
                        <AnimatedPressable
                          onPress={() => {
                            hapticMedium();
                            router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
                          }}
                          scaleDown={0.97}
                          style={[styles.summaryCard, styles.summaryCardHighlighted]}
                        >
                          <View style={styles.summaryHeader}>
                            <Text style={styles.summaryEmoji}>🌙</Text>
                            <Text style={[styles.summaryTitle, { fontWeight: '700' }]}>Evening reflection</Text>
                          </View>
                          <Text style={{ fontSize: 14, color: '#78716c', marginTop: 4 }}>
                            Ready when you are — 4 steps · under 2 min
                          </Text>
                        </AnimatedPressable>
                      );
                    }
                    return null;
                  })()}
                </View>
              </View>
            )}

            {/* Tonight's plan */}
            {isToday && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tonight's plan ☽</Text>
                  <Text style={styles.tonightWeekLabel}>Week 2, Day 3</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {/* 1. Program lesson — always first, from 8-week plan */}
                  <AnimatedPressable
                    onPress={() => { hapticLight(); router.push('/(app)/wellness'); }}
                    scaleDown={0.97}
                    style={styles.programLessonCard}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.programLessonIcon}>
                        <Text style={styles.programLessonIconText}>✦</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.programLessonTitle}>Building a Wind-Down Routine</Text>
                        <Text style={styles.programLessonDur}>Audio lesson · 10 min</Text>
                        <Text style={styles.programLessonWeek}>Week 2 · Your program</Text>
                      </View>
                      <View style={styles.tonightPlayBtn}>
                        <Text style={{ fontSize: 10, color: '#ffffff' }}>▶</Text>
                      </View>
                    </View>
                  </AnimatedPressable>

                  {/* 2. Suggested evening audio — with tag pills */}
                  <AnimatedPressable
                    onPress={() => { hapticLight(); router.push('/(app)/wellness'); }}
                    scaleDown={0.97}
                    style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
                  >
                    <View style={[styles.planIcon, { backgroundColor: '#e0e7ff' }]}>
                      <Text style={{ fontSize: 14 }}>🧘</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>Body Scan for Sleep</Text>
                      <Text style={styles.planSubtitle}>Meditation · 15 min</Text>
                      <View style={styles.tonightTagRow}>
                        {['evening', 'sleep', 'calm'].map((t) => (
                          <View key={t} style={styles.tonightTag}>
                            <Text style={styles.tonightTagText}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.tonightPlayBtnLight}>
                      <Text style={{ fontSize: 10, color: '#78716c' }}>▶</Text>
                    </View>
                  </AnimatedPressable>

                  {/* 3. Evening journal — when not done */}
                  {!eveningDone && (
                    <AnimatedPressable
                      onPress={() => {
                        hapticLight();
                        router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
                      }}
                      scaleDown={0.97}
                      style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
                    >
                      <View style={[styles.planIcon, { backgroundColor: '#e0e7ff' }]}>
                        <Text style={{ fontSize: 14, color: '#6366f1' }}>☽</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planTitle}>Evening journal</Text>
                        <Text style={styles.planSubtitle}>Reflect on your day · 2 min</Text>
                      </View>
                      <View style={styles.planCheckbox} />
                    </AnimatedPressable>
                  )}

                  {/* Tomorrow's forecast insight */}
                  <View style={styles.tonightInsight}>
                    <Text style={{ fontSize: 14, color: '#047857', marginTop: 2 }}>💡</Text>
                    <Text style={styles.tonightInsightText}>
                      <Text style={{ fontWeight: '500', color: '#44403c' }}>Tomorrow's forecast: </Text>
                      Sleep 7+ hours tonight and your readiness could hit 78. Your body responds well to early wind-downs.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Wellness Centre entry card */}
            {isToday && (
              <AnimatedPressable
                onPress={() => { hapticMedium(); router.push('/(app)/wellness'); }}
                scaleDown={0.97}
                style={styles.wellnessEntryCard}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.wellnessEntryIcon}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#b45309' }}>✦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wellnessEntryTitle}>Wellness Centre</Text>
                    <Text style={styles.wellnessEntrySubtitle}>Your program, meditations, podcasts & guides</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: '#78716c' }}>›</Text>
                </View>
                <View style={styles.wellnessProgressBg}>
                  <View style={[styles.wellnessProgressFill, { width: '18%' }]} />
                </View>
                <Text style={styles.wellnessProgressText}>Day 10 of 56 · Week 2: Sleep & Night Sweats</Text>
              </AnimatedPressable>
            )}

            {/* Empty state — no log for selected day */}
            {!hasLog && (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="add-circle-outline" size={36} color="#f59e0b" />
                </View>
                <Text style={styles.emptyTitle}>
                  {isToday ? 'No check-in yet today' : 'No log for this day'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {isToday
                    ? 'Track your symptoms, mood, and sleep to see patterns over time.'
                    : 'You can still add a past entry to fill in the gaps.'}
                </Text>
                <AnimatedPressable
                  onPress={() => {
                    hapticMedium();
                    router.push({
                      pathname: '/(app)/quick-log',
                      params: { date: selectedDate, mode: 'morning' },
                    });
                  }}
                  scaleDown={0.96}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>
                    {isToday ? 'Start morning journal' : 'Log this day'}
                  </Text>
                </AnimatedPressable>
              </View>
            )}

            {/* Streak */}
            {streak > 0 && (
              <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }]}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{streak}-day streak</Text>
                  <Text style={styles.planSubtitle}>
                    {streak <= 1 ? 'Great start! Keep logging daily.' : `You've been logging for ${streak} days in a row!`}
                  </Text>
                </View>
              </View>
            )}

            {/* Learn section */}
            {articles.length > 0 && (
              <View style={[styles.section, { marginTop: 8 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Learn</Text>
                  <AnimatedPressable onPress={() => { hapticLight(); router.push('/(app)/learn'); }} scaleDown={0.97}>
                    <Text style={styles.seeAll}>See all →</Text>
                  </AnimatedPressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
                  {articles.map((article) => (
                    <AnimatedPressable
                      key={article.id}
                      onPress={() => {
                        hapticLight();
                        router.push({ pathname: '/(app)/article', params: { id: String(article.id) } });
                      }}
                      scaleDown={0.97}
                      style={styles.learnCard}
                    >
                      <View style={styles.learnImage}>
                        <Text style={{ fontSize: 24 }}>
                          {article.category === 'Sleep' ? '🌙' : article.category === 'Hot Flashes' ? '❄️' : article.category === 'Mood' ? '🧠' : article.category === 'Nutrition' ? '🥗' : '🏃‍♀️'}
                        </Text>
                      </View>
                      <Text style={styles.learnMeta}>{article.category || 'General'} · {article.readTime || 3} min</Text>
                      <Text style={styles.learnTitle} numberOfLines={2}>{article.title}</Text>
                    </AnimatedPressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },
  loadingContainer: { flex: 1, paddingTop: 80, alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  dateText: { fontSize: 14, color: '#78716c', fontWeight: '300', marginBottom: 2 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#1c1917' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '500', color: '#ffffff' },

  // Week strip
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 2,
  },
  weekStripItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
  },
  weekStripItemSelected: {
    backgroundColor: '#1c1917',
  },
  weekStripDay: {
    fontSize: 14,
    color: '#78716c',
    fontWeight: '400',
    marginBottom: 3,
  },
  weekStripDaySelected: {
    color: '#78716c',
  },
  weekStripNum: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 4,
  },
  weekStripNumSelected: {
    color: '#ffffff',
  },
  weekDotRow: {
    flexDirection: 'row',
    gap: 2,
  },
  weekDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekDotAm: { backgroundColor: '#fbbf24' },
  weekDotPm: { backgroundColor: '#818cf8' },
  weekDotEmpty: { backgroundColor: '#e7e5e4' },
  weekLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  weekLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekLegendText: {
    fontSize: 14,
    color: '#78716c',
  },

  // Readiness score
  readinessCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  readinessLabel: {
    fontSize: 12,
    color: '#78716c',
    letterSpacing: 1,
    fontWeight: '300',
    textTransform: 'uppercase',
  },
  readinessValue: {
    fontSize: 40,
    fontWeight: '300',
    color: '#ffffff',
    marginTop: 4,
  },
  readinessHint: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 4,
  },
  readinessRingOuter: {
    alignItems: 'center',
  },
  readinessRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#44403c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readinessArcWrap: {
    position: 'absolute',
    top: -3,
    left: -3,
  },
  readinessRingScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  readinessRingLabel: {
    fontSize: 12,
    color: '#78716c',
    marginTop: 4,
  },

  readinessActivity: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  readinessStatsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  readinessStatText: {
    fontSize: 12,
    color: '#78716c',
  },
  readinessStatDot: {
    fontSize: 12,
    color: '#78716c',
  },

  // Journal card
  journalCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  journalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  journalMorningIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalEveningIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
  },
  journalCardDesc: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 1,
  },
  nowBadge: {
    backgroundColor: '#fbbf24',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  nowBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1c1917',
  },
  journalCheckDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalEmptyCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d6d3d1',
  },
  journalStreak: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.2)',
    alignItems: 'flex-end',
  },
  journalStreakText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b45309',
  },

  // Today's meds
  medsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  medRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medRowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1917',
  },
  medRowNameTaken: {
    color: '#78716c',
    textDecorationLine: 'line-through',
  },
  medRowDose: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 1,
  },
  medRowCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medRowCheckDone: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  medsSummary: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
  medsSummaryText: {
    fontSize: 14,
    color: '#78716c',
  },

  // SOS + Check-in row
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
  },
  sosCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    width: 90,
  },
  checkinCard: {
    flex: 1,
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkinTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  checkinSub: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 2,
  },
  checkinArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#44403c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTitle: { fontSize: 14, fontWeight: '600', color: '#115e59' },
  sosSubtitle: { fontSize: 14, color: '#5eead4' },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginBottom: 2 },
  seeAll: { fontSize: 14, color: '#78716c', fontWeight: '300' },

  // Trend grid
  trendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  trendBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendBar: {
    width: 5,
    height: 20,
    borderRadius: 3,
  },
  trendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#44403c',
    marginLeft: 6,
  },
  trendSubtext: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 1,
  },

  // Generic card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHintText: { fontSize: 16, color: '#78716c', textAlign: 'center' },

  // Insight nudge
  insightCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  insightStar: { fontSize: 18, color: '#b45309' },
  insightTitle: { fontSize: 16, fontWeight: '500', color: '#44403c' },
  insightDesc: { fontSize: 14, color: '#78716c', marginTop: 4, lineHeight: 20 },

  // Plan icons
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { fontSize: 16, fontWeight: '500', color: '#44403c' },
  planSubtitle: { fontSize: 14, color: '#78716c', marginTop: 1 },
  planCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e7e5e4',
  },
  planCheckDone: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1c1917',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyIcon: { marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 6 },
  emptyDesc: { fontSize: 16, color: '#78716c', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  emptyButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  // Summary cards
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryCardHighlighted: {
    borderWidth: 2,
    borderColor: '#1c1917',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryEmoji: { fontSize: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', flex: 1 },
  summaryTime: { fontSize: 14, color: '#78716c' },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  summaryChip: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryChipText: { fontSize: 14, color: '#78716c' },
  summaryGratitude: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Learn
  learnCard: {
    width: 200,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  learnImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnMeta: { fontSize: 14, color: '#78716c', marginBottom: 4 },
  learnTitle: { fontSize: 16, fontWeight: '500', color: '#44403c', lineHeight: 22 },

  // Meds empty state
  medsEmptyCard: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  medsEmptyIcon: { fontSize: 28, marginBottom: 8 },
  medsEmptyTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  medsEmptyDesc: { fontSize: 14, color: '#78716c', textAlign: 'center', marginBottom: 14, lineHeight: 20 },
  medsEmptyButton: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  medsEmptyButtonText: { fontSize: 16, fontWeight: '600', color: '#1c1917' },

  // Tonight's Plan — enhanced
  tonightWeekLabel: { fontSize: 14, color: '#b45309', fontWeight: '500' },
  programLessonCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  programLessonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programLessonIconText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  programLessonTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917' },
  programLessonDur: { fontSize: 14, color: '#78716c', marginTop: 1 },
  programLessonWeek: { fontSize: 14, color: '#b45309', marginTop: 2 },
  tonightPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tonightPlayBtnLight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tonightTagRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  tonightTag: {
    backgroundColor: '#f5f5f4',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tonightTagText: { fontSize: 14, color: '#78716c' },
  tonightInsight: {
    backgroundColor: '#f5f5f4',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tonightInsightText: {
    fontSize: 14,
    color: '#78716c',
    lineHeight: 20,
    flex: 1,
  },

  // Wellness Centre entry card
  wellnessEntryCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  wellnessEntryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellnessEntryTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917' },
  wellnessEntrySubtitle: { fontSize: 14, color: '#78716c', marginTop: 1 },
  wellnessProgressBg: {
    height: 4,
    backgroundColor: '#f5f5f4',
    borderRadius: 2,
    marginTop: 12,
  },
  wellnessProgressFill: {
    height: 4,
    backgroundColor: '#fbbf24',
    borderRadius: 2,
  },
  wellnessProgressText: { fontSize: 14, color: '#78716c', marginTop: 4 },
});

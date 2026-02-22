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
import { useHealthData } from '@/lib/useHealthData';

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
  const healthData = useHealthData();
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
  const [readinessComponents, setReadinessComponents] = useState<Record<string, number> | null>(null);
  const [insightNudge, setInsightNudge] = useState<{ title: string; body: string } | null>(null);
  const [tomorrowForecast, setTomorrowForecast] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [topCorrelations, setTopCorrelations] = useState<{ factor: string; symptom: string; direction: string; effectSizePct: number; humanLabel: string }[]>([]);
  const [weekTrends, setWeekTrends] = useState<Record<string, { thisWeek: number; lastWeek: number }>>({});
  const [periodEnabled, setPeriodEnabled] = useState(false);
  const [periodCycle, setPeriodCycle] = useState<any>(null);
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
      const [logData, medsData, medLogsData, recentLogs, articlesData, homeData, periodSettings, periodCurrent] = await Promise.all([
        apiRequest(`/api/logs?date=${selectedDate}`, token).catch(() => []),
        apiRequest('/api/meds', token).catch(() => []),
        apiRequest(`/api/meds/logs?date=${todayDate}`, token).catch(() => []),
        apiRequest('/api/logs?range=28d', token).catch(() => []),
        apiRequest('/api/articles', token).catch(() => []),
        apiRequest(`/api/insights/home?date=${selectedDate}`, token).catch(() => null),
        apiRequest('/api/period/settings', token).catch(() => null),
        apiRequest('/api/period/cycles/current', token).catch(() => null),
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
        if (homeData.readinessComponents) setReadinessComponents(homeData.readinessComponents);
        if (homeData.insightNudge) setInsightNudge(homeData.insightNudge);
        if (homeData.tomorrowForecast) setTomorrowForecast(homeData.tomorrowForecast);
        if (homeData.narrative) setNarrative(homeData.narrative);
        if (homeData.topCorrelations) setTopCorrelations(homeData.topCorrelations);
      }

      // Compute weekly symptom trends from 28-day logs
      if (Array.isArray(recentLogs) && recentLogs.length > 0) {
        const now = new Date();
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - 7);
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - 14);

        const thisWeekStr = toDateStr(thisWeekStart);
        const lastWeekStr = toDateStr(lastWeekStart);

        const thisWeekSymptoms: Record<string, number[]> = {};
        const lastWeekSymptoms: Record<string, number[]> = {};

        for (const log of recentLogs) {
          if (!log.symptomsJson || typeof log.symptomsJson !== 'object') continue;
          const bucket = log.date >= thisWeekStr ? thisWeekSymptoms : (log.date >= lastWeekStr ? lastWeekSymptoms : null);
          if (!bucket) continue;
          for (const [k, v] of Object.entries(log.symptomsJson)) {
            const sev = typeof v === 'number' ? v : (typeof v === 'object' && v !== null ? ((v as any).severity ?? 1) : 1);
            if (!bucket[k]) bucket[k] = [];
            bucket[k].push(sev);
          }
        }

        const trends: Record<string, { thisWeek: number; lastWeek: number }> = {};
        const allKeys = new Set([...Object.keys(thisWeekSymptoms), ...Object.keys(lastWeekSymptoms)]);
        for (const k of allKeys) {
          const tw = thisWeekSymptoms[k] || [];
          const lw = lastWeekSymptoms[k] || [];
          trends[k] = {
            thisWeek: tw.length > 0 ? tw.reduce((a, b) => a + b, 0) / tw.length : 0,
            lastWeek: lw.length > 0 ? lw.reduce((a, b) => a + b, 0) / lw.length : 0,
          };
        }
        setWeekTrends(trends);
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

      // Period tracker state
      if (periodSettings && periodSettings.enabled) {
        setPeriodEnabled(true);
        if (periodSettings.homeWidget !== false) {
          setPeriodCycle(periodCurrent || null);
        }
      } else {
        setPeriodEnabled(false);
        setPeriodCycle(null);
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
    // Color based on severity: mild = green, moderate = amber, severe = red
    const sevColor = (s: number) => s >= 3 ? '#ef4444' : s >= 2 ? '#f59e0b' : '#78716c';
    return entries.map(([name, sev], i) => {
      const trend = weekTrends[name];
      let weekChange: string | null = null;
      if (trend && trend.lastWeek > 0) {
        const pctChange = Math.round(((trend.thisWeek - trend.lastWeek) / trend.lastWeek) * 100);
        if (pctChange <= -10) weekChange = `↓ ${Math.abs(pctChange)}% this week`;
        else if (pctChange >= 10) weekChange = `↑ ${pctChange}% this week`;
        else weekChange = '— same this week';
      } else if (trend && trend.thisWeek > 0) {
        weekChange = '↑ new this week';
      } else {
        weekChange = '— steady this week';
      }
      return {
        name: name
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .replace(/\b\w/g, (s) => s.toUpperCase())
          .trim(),
        rawName: name,
        sev: Math.min(sev, 3),
        color: sevColor(sev),
        weekChange,
        improving: trend ? trend.thisWeek < trend.lastWeek : false,
      };
    });
  }, [dayLogs, weekTrends]);

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
            {/* Readiness Score Card — dark, with AI activity recommendation */}
            {(() => {
              // Prefer server-computed score, fall back to client-side
              const score = serverReadiness ?? readinessScore;
              const scoreNum = score ?? 0;
              const circumference = 163.4;
              const arcLength = (scoreNum / 100) * circumference;
              const activityLabel = (score ?? 0) >= 70 ? 'Your body is ready' : (score ?? 0) >= 40 ? 'Mixed day' : 'Go gentle';
              const activityColor = (score ?? 0) >= 70 ? '#34d399' : (score ?? 0) >= 40 ? '#fbbf24' : '#fca5a5';
              const activityBg = (score ?? 0) >= 70 ? 'rgba(52,211,153,0.12)' : (score ?? 0) >= 40 ? 'rgba(251,191,36,0.12)' : 'rgba(252,165,165,0.12)';

              // Stressor level from contextTags or aggregate
              const allStressors = new Set<string>();
              dayLogs.forEach((e) => (e.contextTags || []).forEach((t) => allStressors.add(t)));
              const stressorCount = allStressors.size;
              const stressLabel = stressorCount === 0 ? 'Low ✓' : stressorCount <= 2 ? 'Moderate' : 'High';

              // AI narrative: prefer recommendation, then narrative, then smart fallback
              const aiNarrative = recommendation || narrative || null;

              return (
                <View style={styles.readinessCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.readinessLabel}>READINESS SCORE</Text>
                        <Text style={styles.readinessValue}>{score ?? '—'}</Text>
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
                    {hasLog && (
                      <>
                        {/* Activity recommendation pill with AI explanation */}
                        <View style={[styles.readinessActivityPill, { backgroundColor: activityBg }]}>
                          <Text style={[styles.readinessActivity, { color: activityColor }]}>{activityLabel}</Text>
                          {(() => {
                            // Use AI narrative if available, otherwise build a proper client-side one
                            if (aiNarrative) {
                              return <Text style={styles.readinessNarrative}>{aiNarrative}</Text>;
                            }
                            // Warm client-side fallback
                            const hrs = sleepLog?.sleepHours;
                            const topSym = symptomTrends.length > 0 ? symptomTrends[0].name.replace(/_/g, ' ') : null;
                            let msg = '';
                            if (scoreNum >= 70) {
                              const sleepNote = hrs ? `${hrs} hours of sleep and your body is responding well` : 'Your body is doing well today';
                              msg = `${sleepNote} — a great day to enjoy something active if you're up for it.`;
                            } else if (scoreNum >= 40) {
                              const sleepNote = hrs ? `${hrs} hours of sleep is keeping things steady` : 'Some things are working in your favour';
                              const dragNote = topSym ? `, but ${topSym} is weighing on things` : ', though your body could use some extra care';
                              msg = `${sleepNote}${dragNote}. Listen to what you need today.`;
                            } else {
                              const context = hrs && hrs < 6
                                ? `Only ${hrs} hours of sleep makes everything feel harder`
                                : topSym ? `${topSym.charAt(0).toUpperCase() + topSym.slice(1)} is weighing heavily today`
                                : 'Your body is carrying a lot today';
                              msg = `${context}. Be extra gentle with yourself — rest is productive too.`;
                            }
                            return <Text style={styles.readinessNarrative}>{msg}</Text>;
                          })()}
                        </View>
                        {/* Stats row — Sleep, HRV, Symptoms, RHR, Stress */}
                        <View style={styles.readinessStatsInline}>
                          <View style={styles.readinessStatItem}>
                            <Text style={styles.readinessStatText}>
                              Sleep: {sleepLog?.sleepHours ? `${sleepLog.sleepHours}h` : '—'}
                            </Text>
                            {sleepLog?.sleepHours && sleepLog.sleepHours >= 6 && <Text style={styles.readinessStatCheck}> ✓</Text>}
                          </View>
                          {healthData.connected && healthData.data.hrv != null && (
                            <View style={styles.readinessStatItem}>
                              <Text style={styles.readinessStatText}>
                                HRV: {healthData.data.hrv}ms
                              </Text>
                              <Text style={styles.readinessStatCheck}> ✓</Text>
                            </View>
                          )}
                          <View style={styles.readinessStatItem}>
                            <Text style={styles.readinessStatText}>
                              Symptoms: {symptomTrends.length > 0 ? (symptomTrends.length <= 2 ? 'Low' : 'Moderate') : 'None'}
                            </Text>
                            {symptomTrends.length <= 2 && <Text style={styles.readinessStatCheck}> ✓</Text>}
                          </View>
                          {healthData.connected && healthData.data.rhr != null && (
                            <View style={styles.readinessStatItem}>
                              <Text style={styles.readinessStatText}>
                                RHR: {healthData.data.rhr}
                              </Text>
                              <Text style={styles.readinessStatCheck}> ✓</Text>
                            </View>
                          )}
                          <View style={styles.readinessStatItem}>
                            <Text style={styles.readinessStatText}>
                              Stress: {stressLabel.replace(' ✓', '')}
                            </Text>
                            {stressorCount <= 0 && <Text style={styles.readinessStatCheck}> ✓</Text>}
                          </View>
                        </View>
                        {/* Wearable sync indicator */}
                        {healthData.connected && (
                          <View style={styles.wearableSyncRow}>
                            <View style={styles.wearableSyncDot} />
                            <Text style={styles.wearableSyncText}>
                              {healthData.source === 'apple_watch' ? 'Apple Watch' : healthData.source || 'Wearable'} synced
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                    {!hasLog && (
                      <Text style={styles.readinessHint}>
                        {isToday ? 'A few check-ins and we can show you how your day is shaping up' : 'Nothing logged for this day'}
                      </Text>
                    )}
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
                    router.navigate('/(app)/log' as any);
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
            <View style={styles.journalCard}>
              <AnimatedPressable
                onPress={() => {
                  hapticMedium();
                  const amLog = dayLogs.find((e) => e.logType === 'morning');
                  if (amLog) {
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning', logId: String(amLog.id) } });
                  } else {
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                  }
                }}
                scaleDown={0.97}
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
                      {morningDone ? 'Done' : isToday ? "How did you sleep? Takes 2 min" : 'Add a morning entry for this day'}
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
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  hapticMedium();
                  const pmLog = dayLogs.find((e) => e.logType === 'evening');
                  if (pmLog) {
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening', logId: String(pmLog.id) } });
                  } else {
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening' } });
                  }
                }}
                scaleDown={0.97}
                style={{ marginTop: 12 }}
              >
                <View style={styles.journalCardRow}>
                  <View style={styles.journalEveningIcon}>
                    <Text style={{ fontSize: 18, color: '#6366f1' }}>☽</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.journalCardTitle, !eveningDone && isToday && hour < 19 && { color: '#57534e' }]}>
                      {eveningDone ? 'Evening ✓' : 'Evening reflection'}
                    </Text>
                    <Text style={styles.journalCardDesc}>
                      {eveningDone ? 'Done' : isToday ? (hour >= 19 ? 'How was your day?' : 'Opens tonight at 7 PM') : 'Add an evening entry for this day'}
                    </Text>
                  </View>
                  {eveningDone && (
                    <View style={styles.journalCheckDone}>
                      <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>✓</Text>
                    </View>
                  )}
                  {!eveningDone && <View style={styles.journalEmptyCheck} />}
                </View>
              </AnimatedPressable>
              {/* Mini streak */}
              {streak > 0 && (
                <View style={styles.journalStreak}>
                  <Text style={styles.journalStreakText}>{streak} days in a row</Text>
                </View>
              )}
            </View>

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
                    <AnimatedPressable
                      onPress={() => { hapticLight(); router.push('/(app)/meds'); }}
                      scaleDown={0.97}
                      style={styles.medsAddButton}
                    >
                      <Text style={styles.medsAddButtonText}>+ Add</Text>
                    </AnimatedPressable>
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
                  <Text style={styles.medsEmptyTitle}>Meds and supplements</Text>
                  <Text style={styles.medsEmptyDesc}>
                    Track HRT, supplements, or prescriptions so we can spot what helps
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
                  <AnimatedPressable onPress={() => { hapticLight(); router.navigate('/(app)/insights' as any); }} scaleDown={0.97}>
                    <Text style={styles.seeAll}>See why →</Text>
                  </AnimatedPressable>
                </View>
                {/* Weekly narrative summary — from AI or smart fallback */}
                {narrative && (
                  <View style={styles.narrativeCard}>
                    <Text style={{ fontSize: 16, color: '#059669', marginTop: 2 }}>↓</Text>
                    <Text style={styles.narrativeText}>{narrative}</Text>
                  </View>
                )}
                {symptomTrends.length > 0 ? (
                  <View style={styles.trendGrid}>
                    {symptomTrends.map((s) => {
                      const changeColor = s.weekChange?.startsWith('↓') ? '#059669' : s.weekChange?.startsWith('↑') ? '#dc2626' : '#78716c';
                      return (
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
                          {s.weekChange && (
                            <Text style={[styles.trendWeekChange, { color: changeColor }]}>{s.weekChange}</Text>
                          )}
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.cardHintText}>
                      Once you log symptoms, your trends will appear here
                    </Text>
                  </View>
                )}

                {/* Sleep Score card — shows score from readiness components */}
                {sleepLog?.sleepHours && (
                  <AnimatedPressable
                    onPress={() => {
                      hapticLight();
                      router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                    }}
                    scaleDown={0.97}
                    style={[styles.card, { marginTop: 8 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                          Sleep Score{' '}
                          <Text style={{ color: '#4f46e5', fontWeight: '700' }}>
                            {readinessComponents?.sleep ? Math.round(readinessComponents.sleep) : sleepLog.sleepHours ? Math.round(Math.min(100, (sleepLog.sleepHours / 9) * 100)) : '—'}
                          </Text>
                        </Text>
                        <Text style={styles.trendSubtext}>
                          {sleepLog.sleepHours}h
                          {sleepLog.disruptions ? ` · ${sleepLog.disruptions} disruption${sleepLog.disruptions !== 1 ? 's' : ''}` : ''}
                          {sleepLog.sleepQuality ? ` · ${sleepLog.sleepQuality}` : ''}
                        </Text>
                      </View>
                    </View>
                  </AnimatedPressable>
                )}
              </View>
            )}

            {/* Insight nudge — pattern detection (from correlations or AI fallback) */}
            {(insightNudge || topCorrelations.length > 0 || (hasLog && symptomTrends.length > 0)) && (
              <AnimatedPressable
                onPress={() => { hapticLight(); router.navigate('/(app)/insights' as any); }}
                scaleDown={0.98}
                style={styles.insightCard}
              >
                <Text style={styles.insightStar}>✦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>
                    {insightNudge?.title || (
                      topCorrelations.length > 0
                        ? 'Something showed up in your data'
                        : streak >= 14
                          ? `${symptomTrends.some((s) => s.improving) ? 'Things are shifting' : 'Holding steady'}. ${symptomTrends[0]?.name || 'Your patterns'} worth watching.`
                          : 'Your picture is taking shape'
                    )}
                  </Text>
                  <Text style={styles.insightDesc}>
                    {insightNudge?.body || (
                      topCorrelations.length > 0
                        ? topCorrelations[0].humanLabel + (topCorrelations.length > 1 ? ` ${topCorrelations.length} connections found so far.` : '')
                        : streak >= 7
                          ? `${streak} days logged. A few more and we can start connecting the dots.`
                          : 'A few more check-ins and we can start spotting what triggers your symptoms.'
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
                            Whenever you are ready. 4 quick steps, under 2 min.
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
                    onPress={() => { hapticLight(); router.push('/(app)/player' as any); }}
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
                    onPress={() => { hapticLight(); router.push('/(app)/player' as any); }}
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
                        <Text style={styles.planTitle}>Evening reflection</Text>
                        <Text style={styles.planSubtitle}>How was today? Under 2 min</Text>
                      </View>
                      <View style={styles.planCheckbox} />
                    </AnimatedPressable>
                  )}

                  {/* Tomorrow's forecast insight */}
                  {tomorrowForecast ? (
                    <View style={styles.tonightInsight}>
                      <Text style={{ fontSize: 14, color: '#047857', marginTop: 2 }}>💡</Text>
                      <Text style={styles.tonightInsightText}>
                        <Text style={{ fontWeight: '500', color: '#44403c' }}>Looking ahead: </Text>
                        {tomorrowForecast}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* Wellness Centre entry card */}
            {isToday && (
              <AnimatedPressable
                onPress={() => { hapticMedium(); router.navigate('/(app)/wellness' as any); }}
                scaleDown={0.97}
                style={styles.wellnessEntryCard}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.wellnessEntryIcon}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#b45309' }}>✦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wellnessEntryTitle}>Wellness Centre</Text>
                    <Text style={styles.wellnessEntrySubtitle}>Your program, meditations, podcasts, and guides</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: '#78716c' }}>›</Text>
                </View>
                <View style={styles.wellnessProgressBg}>
                  <View style={[styles.wellnessProgressFill, { width: '18%' }]} />
                </View>
                <Text style={styles.wellnessProgressText}>Day 10 of 56 · Week 2: Sleep & Night Sweats</Text>
              </AnimatedPressable>
            )}

            {/* Period Tracker Widget — 3 states */}
            {isToday && periodEnabled && (() => {
              const hasCycleData = periodCycle && periodCycle.cycle;
              const isActive = hasCycleData && periodCycle.cycle.status === 'active' && periodCycle.daysSinceStart != null && periodCycle.daysSinceStart <= 10;

              // Helper: human-friendly time since last period
              const timeAgo = (dateStr: string) => {
                const days = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
                if (days === 0) return 'Today';
                if (days === 1) return 'Yesterday';
                if (days < 7) return `${days} days ago`;
                const weeks = Math.round(days / 7);
                if (weeks <= 8) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
                const months = Math.round(days / 30);
                return `${months} month${months > 1 ? 's' : ''} ago`;
              };

              // State 3: Active period (promoted, rose card)
              if (isActive) {
                return (
                  <AnimatedPressable
                    onPress={() => { hapticMedium(); router.push('/(app)/period-tracker'); }}
                    scaleDown={0.97}
                    style={styles.periodWidgetActive}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.periodWidgetActiveIcon}>
                        <Text style={{ fontSize: 14 }}>🩸</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.periodWidgetActiveTitle}>Period — Day {periodCycle.daysSinceStart}</Text>
                        <Text style={styles.periodWidgetActiveSub}>Tap to log today's flow</Text>
                      </View>
                      <AnimatedPressable
                        onPress={() => { hapticLight(); router.push('/(app)/period-daily'); }}
                        scaleDown={0.95}
                        style={styles.periodWidgetLogBtn}
                      >
                        <Text style={styles.periodWidgetLogBtnText}>Log</Text>
                      </AnimatedPressable>
                    </View>
                  </AnimatedPressable>
                );
              }

              // State 2: Waiting (has cycle data, not currently active)
              if (hasCycleData) {
                return (
                  <AnimatedPressable
                    onPress={() => { hapticLight(); router.push('/(app)/period-tracker'); }}
                    scaleDown={0.97}
                    style={styles.periodWidgetWaiting}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.periodWidgetWaitingIcon}>
                        <Text style={{ fontSize: 14 }}>◯</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.periodWidgetWaitingTitle}>Period Tracker</Text>
                        <Text style={styles.periodWidgetWaitingSub}>
                          Last period: {timeAgo(periodCycle.cycle.startDate)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 18, color: '#d6d3d1' }}>›</Text>
                    </View>
                  </AnimatedPressable>
                );
              }

              // State 1: Empty (enabled but no data yet)
              return (
                <AnimatedPressable
                  onPress={() => { hapticLight(); router.push('/(app)/period-tracker'); }}
                  scaleDown={0.97}
                  style={styles.periodWidgetEmpty}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.periodWidgetEmptyIcon}>
                      <Text style={{ fontSize: 14, color: '#f43f5e' }}>✦</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.periodWidgetEmptyTitle}>Period Tracker</Text>
                      <Text style={styles.periodWidgetEmptySub}>Tap to start tracking your cycle</Text>
                    </View>
                    <Text style={{ fontSize: 18, color: '#d6d3d1' }}>›</Text>
                  </View>
                </AnimatedPressable>
              );
            })()}

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
                    ? 'A quick check-in helps us learn what affects your symptoms, mood, and sleep.'
                    : 'You can still log a past entry to fill in the picture.'}
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

  readinessActivityPill: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  readinessActivity: {
    fontSize: 16,
    fontWeight: '600',
  },
  readinessNarrative: {
    fontSize: 12,
    color: '#d6d3d1',
    marginTop: 6,
    lineHeight: 18,
  },
  readinessStatsInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  readinessStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readinessStatText: {
    fontSize: 12,
    color: '#78716c',
  },
  readinessStatDot: {
    fontSize: 12,
    color: '#78716c',
  },
  readinessStatCheck: {
    fontSize: 12,
    color: '#34d399',
  },
  wearableSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  wearableSyncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  wearableSyncText: {
    fontSize: 11,
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  medsSummaryText: {
    fontSize: 14,
    color: '#78716c',
  },
  medsAddButton: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  medsAddButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1c1917',
  },

  // SOS + Check-in row
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
  },
  sosCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTitle: { fontSize: 14, fontWeight: '700', color: '#1c1917', textAlign: 'center' as const },
  sosSubtitle: { fontSize: 12, color: '#78716c', textAlign: 'center' as const },

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
  trendWeekChange: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },

  // Narrative card
  narrativeCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d1fae5',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  narrativeText: {
    fontSize: 14,
    color: '#1c1917',
    lineHeight: 20,
    flex: 1,
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

  // Period widget — Active (rose, promoted)
  periodWidgetActive: {
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#fecdd3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  periodWidgetActiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fecdd3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodWidgetActiveTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  periodWidgetActiveSub: { fontSize: 14, color: '#78716c', marginTop: 1 },
  periodWidgetLogBtn: {
    backgroundColor: '#f43f5e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  periodWidgetLogBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

  // Period widget — Waiting (has data)
  periodWidgetWaiting: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  periodWidgetWaitingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodWidgetWaitingTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  periodWidgetWaitingSub: { fontSize: 14, color: '#78716c', marginTop: 1 },

  // Period widget — Empty (no data yet)
  periodWidgetEmpty: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    borderStyle: 'dashed',
  },
  periodWidgetEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodWidgetEmptyTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  periodWidgetEmptySub: { fontSize: 14, color: '#78716c', marginTop: 1 },
});

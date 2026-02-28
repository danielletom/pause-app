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
import { useSleepTracking } from '@/lib/useSleepTracking';
import { getTrialDay, isTrialExpired, getTrialDaysLeft, getCheckInDays, getDaysUntilInsights, getStreakMessage } from '@/lib/trial';
import { useDelight, DELIGHT_KEYS } from '@/lib/delight-context';

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
  const { sleep: autoSleep } = useSleepTracking();
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
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverReadiness, setServerReadiness] = useState<number | null>(null);
  const [readinessComponents, setReadinessComponents] = useState<Record<string, number> | null>(null);
  const [insightNudge, setInsightNudge] = useState<{ title: string; body: string } | null>(null);
  const [tomorrowForecast, setTomorrowForecast] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [topCorrelations, setTopCorrelations] = useState<{ factor: string; symptom: string; direction: string; effectSizePct: number; humanLabel: string }[]>([]);
  const [weekTrends, setWeekTrends] = useState<Record<string, { thisWeek: number; lastWeek: number }>>({});
  const [periodEnabled, setPeriodEnabled] = useState(false);
  const [periodCycle, setPeriodCycle] = useState<any>(null);
  const [sleepCompare, setSleepCompare] = useState<{ lastNight: number; nightBefore: number } | null>(null);
  const hasLoadedOnce = useRef(false);

  // Delight system
  const { hasSeen, markSeen } = useDelight();
  const trialDay = getTrialDay(profile?.createdAt);
  const trialExpired = isTrialExpired(profile?.createdAt);

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
      // Track refreshing state for analyzing animation
      if (hasLoadedOnce.current) {
        setIsRefreshing(true);
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
      // Sleep comparison for Day 2 card
      if (Array.isArray(recentLogs) && recentLogs.length >= 2) {
        const mornings = recentLogs
          .filter((l: any) => l.logType === 'morning' && l.sleepHours != null)
          .sort((a: any, b: any) => b.date.localeCompare(a.date));
        if (mornings.length >= 2) {
          setSleepCompare({ lastNight: mornings[0].sleepHours, nightBefore: mornings[1].sleepHours });
        }
      }

      // Set recommendation + AI data from home API
      if (homeData) {
        if (homeData.recommendation) setRecommendation(homeData.recommendation);
        setIsAiGenerated(!!homeData.isAiGenerated);
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
      setIsRefreshing(false);
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
        {/* Header — greeting, name, avatar */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateText}>
              {isToday
                ? hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
                : dateString}
            </Text>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
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
            {/* ══════════ DELIGHT: TRIAL EXPIRED BANNER ══════════ */}
            {trialExpired && isToday && (
              <View style={styles.trialEndedBanner}>
                <Text style={{ fontSize: 13 }}>💜</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trialEndedTitle}>Your free trial ended</Text>
                  <Text style={styles.trialEndedSub}>Subscribe to keep logging + unlock new insights</Text>
                </View>
                <AnimatedPressable onPress={() => router.push('/(app)/paywall' as any)} scaleDown={0.97}>
                  <Text style={{ fontSize: 13, color: '#a78bfa', fontWeight: '600' }}>→</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* ══════════ DELIGHT: WELCOME BANNER (Day 0, shows once) ══════════ */}
            {!hasSeen(DELIGHT_KEYS.WELCOME_BANNER) && isToday && trialDay <= 1 && (
              <AnimatedPressable
                onPress={() => markSeen(DELIGHT_KEYS.WELCOME_BANNER)}
                scaleDown={0.99}
                style={styles.welcomeBanner}
              >
                <Text style={{ fontSize: 15 }}>✦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeTitle}>Welcome, {firstName}</Text>
                  <Text style={styles.welcomeSub}>Your body has a story — let's start reading it.</Text>
                </View>
              </AnimatedPressable>
            )}

            {/* ══════════ DELIGHT: QUIZ DATA CARD (Day 0, shows once) ══════════ */}
            {!hasSeen(DELIGHT_KEYS.QUIZ_DATA_CARD) && isToday && trialDay <= 2 && profile?.symptoms && profile.symptoms.length > 0 && (
              <View style={styles.quizDataCard}>
                <Text style={styles.quizDataLabel}>Based on what you told us</Text>
                <Text style={styles.quizDataTitle}>
                  You told us about {profile.symptoms.slice(0, 3).map((s: string) => s.replace(/_/g, ' ')).join(', ')}
                </Text>
                <Text style={styles.quizDataBody}>
                  82% of women in {profile.stage === 'peri' ? 'perimenopause' : profile.stage === 'meno' ? 'menopause' : profile.stage === 'post' ? 'post-menopause' : 'this stage'} experience these. You're not alone — and now we know what to watch for.
                </Text>
              </View>
            )}

            {/* ══════════ DELIGHT: SLEEP COMPARISON (Day 2-3) ══════════ */}
            {!hasSeen(DELIGHT_KEYS.SLEEP_COMPARISON) && isToday && trialDay >= 2 && trialDay <= 3 && sleepCompare && (
              <View style={styles.sleepCompareCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sleepCompareTitle}>Your sleep, side by side</Text>
                  <AnimatedPressable onPress={() => markSeen(DELIGHT_KEYS.SLEEP_COMPARISON)} scaleDown={0.95}>
                    <Text style={{ fontSize: 12, color: '#5eead4' }}>Dismiss</Text>
                  </AnimatedPressable>
                </View>
                <View style={styles.sleepCompareBars}>
                  <View style={styles.sleepCompareBarWrap}>
                    <View style={[styles.sleepCompareBar, { height: Math.min(80, sleepCompare.nightBefore * 10) }]} />
                    <Text style={styles.sleepCompareHours}>{sleepCompare.nightBefore}h</Text>
                    <Text style={styles.sleepCompareDay}>Night before</Text>
                  </View>
                  <View style={styles.sleepCompareBarWrap}>
                    <View style={[styles.sleepCompareBar, styles.sleepCompareBarActive, { height: Math.min(80, sleepCompare.lastNight * 10) }]} />
                    <Text style={styles.sleepCompareHours}>{sleepCompare.lastNight}h</Text>
                    <Text style={styles.sleepCompareDay}>Last night</Text>
                  </View>
                </View>
                <Text style={styles.sleepCompareHint}>
                  {sleepCompare.lastNight >= sleepCompare.nightBefore
                    ? 'Trending up \u2014 keep it going!'
                    : 'A bit less sleep. Watch how you feel today.'}
                </Text>
              </View>
            )}

            {/* ══════════ DELIGHT: FIRST PATTERN (Day 4-7) ══════════ */}
            {!hasSeen(DELIGHT_KEYS.FIRST_PATTERN) && isToday && trialDay >= 4 && trialDay <= 7 && topCorrelations.length > 0 && (
              <View style={styles.firstPatternCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <View style={styles.firstPatternDot} />
                  <Text style={styles.firstPatternLabel}>FIRST PATTERN DETECTED</Text>
                </View>
                <Text style={styles.firstPatternTitle}>{topCorrelations[0].humanLabel || `${topCorrelations[0].factor} \u2192 ${topCorrelations[0].symptom}`}</Text>
                <Text style={styles.firstPatternSub}>
                  {topCorrelations[0].direction === 'positive'
                    ? `When ${topCorrelations[0].factor.replace(/_/g, ' ')} is higher, ${topCorrelations[0].symptom.replace(/_/g, ' ')} tends to be worse.`
                    : `When ${topCorrelations[0].factor.replace(/_/g, ' ')} is lower, ${topCorrelations[0].symptom.replace(/_/g, ' ')} tends to improve.`}
                </Text>
                <Text style={styles.firstPatternHint}>Based on your first {trialDay} days of data.</Text>
                <AnimatedPressable
                  onPress={() => { markSeen(DELIGHT_KEYS.FIRST_PATTERN); router.push('/(app)/(tabs)/insights'); }}
                  scaleDown={0.97}
                  style={styles.firstPatternBtn}
                >
                  <Text style={styles.firstPatternBtnText}>{'See all patterns \u2192'}</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* ══════════ DELIGHT: CORRELATION CARD (Day 8-10) ══════════ */}
            {!hasSeen(DELIGHT_KEYS.CORRELATION_CARD) && isToday && trialDay >= 8 && trialDay <= 10 && topCorrelations.length >= 2 && (
              <View style={styles.correlationCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 14 }}>🧠</Text>
                  <Text style={styles.correlationLabel}>YOUR TOP CORRELATIONS</Text>
                </View>
                <Text style={styles.correlationTitle}>Patterns only visible with {trialDay}+ days of data</Text>
                {topCorrelations.slice(0, 2).map((c, i) => (
                  <View key={i} style={styles.correlationRow}>
                    <View style={[styles.correlationDot, { backgroundColor: i === 0 ? '#2dd4bf' : '#f59e0b' }]} />
                    <Text style={styles.correlationText}>{c.humanLabel || `${c.factor} \u2192 ${c.symptom}`}</Text>
                  </View>
                ))}
                <AnimatedPressable
                  onPress={() => { markSeen(DELIGHT_KEYS.CORRELATION_CARD); router.push('/(app)/(tabs)/insights'); }}
                  scaleDown={0.97}
                  style={{ marginTop: 10 }}
                >
                  <Text style={{ fontSize: 12, color: '#2dd4bf', fontWeight: '600' }}>{'Explore insights \u2192'}</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* ══════════ DELIGHT: DAY 10 BANNER ══════════ */}
            {!hasSeen(DELIGHT_KEYS.DAY10_BANNER) && isToday && trialDay >= 10 && trialDay <= 11 && (
              <AnimatedPressable
                onPress={() => markSeen(DELIGHT_KEYS.DAY10_BANNER)}
                scaleDown={0.99}
                style={styles.day10Banner}
              >
                <Text style={{ fontSize: 13 }}>💛</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.day10Title}>10 days of showing up for yourself</Text>
                  <Text style={styles.day10Sub}>Most people stop at 3. You're building something real.</Text>
                </View>
              </AnimatedPressable>
            )}

            {/* ══════════ DELIGHT: DAY 3 MILESTONE ══════════ */}
            {!hasSeen(DELIGHT_KEYS.DAY3_MILESTONE) && isToday && streak >= 3 && trialDay <= 5 && (
              <View style={styles.milestoneCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 15 }}>✦</Text>
                  <Text style={styles.milestoneTitle}>3 days of data</Text>
                  <View style={styles.milestonePill}><Text style={styles.milestonePillText}>Milestone</Text></View>
                </View>
                <Text style={styles.milestoneSub}>You're building a picture of your health.</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  <View style={styles.milestoneStatBox}><Text style={styles.milestoneStatNum}>3</Text><Text style={styles.milestoneStatLabel}>check-ins</Text></View>
                  <View style={styles.milestoneStatBox}><Text style={styles.milestoneStatNum}>{symptomTrends.length}</Text><Text style={styles.milestoneStatLabel}>symptoms</Text></View>
                  <View style={styles.milestoneStatBox}><Text style={styles.milestoneStatNum}>{sleepLog?.sleepHours ? `${sleepLog.sleepHours}h` : '—'}</Text><Text style={styles.milestoneStatLabel}>avg sleep</Text></View>
                </View>
                <Text style={{ fontSize: 12, color: '#78716c', marginTop: 8 }}>{getDaysUntilInsights(streak)} more days until your first insights unlock.</Text>
                <AnimatedPressable onPress={() => markSeen(DELIGHT_KEYS.DAY3_MILESTONE)} scaleDown={0.97} style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: '#f59e0b', fontWeight: '600' }}>Got it ✓</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* ══════════ DELIGHT: DAY 17-19 BODY MAP ══════════ */}
            {!hasSeen(DELIGHT_KEYS.DAY17_BODY_MAP) && isToday && trialDay >= 17 && trialDay <= 19 && (
              <View style={styles.bodyMapCard}>
                <Text style={styles.bodyMapLabel}>✦ YOUR {trialDay}-DAY BODY MAP</Text>
                <Text style={styles.bodyMapTitle}>Here's what {trialDay} days{'\n'}of tracking built</Text>
                <View style={styles.bodyMapGrid}>
                  <View style={styles.bodyMapStat}><Text style={[styles.bodyMapNum, { color: '#f59e0b' }]}>{trialDay}</Text><Text style={styles.bodyMapStatLabel}>check-ins</Text></View>
                  <View style={styles.bodyMapStat}><Text style={[styles.bodyMapNum, { color: '#2dd4bf' }]}>{symptomTrends.length || '—'}</Text><Text style={styles.bodyMapStatLabel}>symptoms</Text></View>
                  <View style={styles.bodyMapStat}><Text style={[styles.bodyMapNum, { color: '#fb7185' }]}>{sleepLog?.sleepHours ? `${sleepLog.sleepHours}h` : '—'}</Text><Text style={styles.bodyMapStatLabel}>avg sleep</Text></View>
                  <View style={styles.bodyMapStat}><Text style={[styles.bodyMapNum, { color: '#a78bfa' }]}>{topCorrelations.length}</Text><Text style={styles.bodyMapStatLabel}>correlations</Text></View>
                </View>
                <Text style={styles.bodyMapHint}>Scroll down for your regular dashboard ↓</Text>
              </View>
            )}

            {/* ══════════ LOCKED STATE (Day 20+): Full locked home ══════════ */}
            {trialExpired && isToday && (
              <View>
                {/* Locked check-in card */}
                <AnimatedPressable
                  onPress={() => { hapticLight(); router.push('/(app)/paywall' as any); }}
                  scaleDown={0.97}
                  style={styles.lockedCheckinCard}
                >
                  <View style={styles.lockedOverlay}>
                    <Text style={{ fontSize: 24 }}>🔒</Text>
                  </View>
                  <View style={{ opacity: 0.5 }}>
                    <View style={styles.heroContentRow}>
                      <View style={styles.heroIconWrap}>
                        <Text style={{ fontSize: 24 }}>🌤</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.heroTitle}>Morning check-in</Text>
                        <Text style={styles.heroSubtitle}>Subscribe to continue logging</Text>
                      </View>
                    </View>
                  </View>
                </AnimatedPressable>

                {/* Readiness locked */}
                <View style={[styles.readinessCard, { opacity: 0.4 }]}>
                  <Text style={styles.readinessLabel}>READINESS SCORE</Text>
                  <Text style={[styles.readinessValue, { fontSize: 32 }]}>{'\u2014'}</Text>
                  <Text style={styles.readinessNarrative}>Subscribe to see your daily readiness</Text>
                </View>

                {/* SOS always free */}
                <AnimatedPressable
                  onPress={() => { hapticMedium(); router.push('/(app)/sos'); }}
                  scaleDown={0.97}
                  style={styles.sosAlwaysFree}
                >
                  <View style={styles.sosIcon}>
                    <Text style={{ fontSize: 14 }}>❄️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sosTitle}>SOS — Hot flash?</Text>
                    <Text style={styles.sosSubtitle}>Always free — breathing + grounding</Text>
                  </View>
                  <View style={styles.sosFreeBadge}>
                    <Text style={styles.sosFreeText}>Free</Text>
                  </View>
                </AnimatedPressable>

                {/* Past data accessible */}
                <AnimatedPressable
                  onPress={() => { hapticLight(); router.push('/(app)/calendar'); }}
                  scaleDown={0.97}
                  style={styles.pastDataCard}
                >
                  <View style={styles.pastDataIcon}>
                    <Text style={{ fontSize: 14 }}>📊</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pastDataTitle}>Your past data</Text>
                    <Text style={styles.pastDataSub}>Everything you logged is still yours</Text>
                  </View>
                  <Text style={{ fontSize: 16, color: '#d6d3d1' }}>{'\u203A'}</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* ══════════ STATE 1: BEFORE CHECK-INS ══════════ */}
            {isToday && !trialExpired && !morningDone && !eveningDone && (
              <AnimatedPressable
                onPress={() => {
                  hapticMedium();
                  router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                }}
                scaleDown={0.97}
                style={styles.morningHeroCard}
              >
                {streak > 0 && (
                  <View style={styles.heroStreakRow}>
                    <Text style={{ fontSize: 13 }}>🔥</Text>
                    <Text style={styles.heroStreakText}>{streak} days in a row</Text>
                  </View>
                )}
                <View style={styles.heroContentRow}>
                  <View style={styles.heroIconWrap}>
                    <Text style={{ fontSize: 24 }}>🌤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroTitle}>Morning check-in</Text>
                    <Text style={styles.heroSubtitle}>How did you sleep? How are you feeling?</Text>
                  </View>
                </View>
                <View style={styles.heroButton}>
                  <Text style={styles.heroButtonText}>Start check-in</Text>
                </View>
                <Text style={styles.heroHint}>Takes about 2 minutes</Text>
              </AnimatedPressable>
            )}

            {/* ══════════ STATE 2: MORNING DONE, EVENING PENDING ══════════ */}
            {isToday && !trialExpired && morningDone && !eveningDone && (
              <View style={styles.comboCard}>
                {/* Morning done row */}
                <AnimatedPressable
                  onPress={() => {
                    hapticLight();
                    const amLog = dayLogs.find((e) => e.logType === 'morning');
                    if (amLog) router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning', logId: String(amLog.id) } });
                  }}
                  scaleDown={0.98}
                  style={styles.comboDoneRow}
                >
                  <Text style={{ fontSize: 14 }}>🌤</Text>
                  <Text style={styles.comboDoneText}>Morning check-in ✓</Text>
                  <Text style={styles.comboDoneTime}>
                    {dayLogs.find((e) => e.logType === 'morning')?.loggedAt
                      ? new Date(dayLogs.find((e) => e.logType === 'morning')!.loggedAt!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : ''}
                  </Text>
                </AnimatedPressable>
                {/* Evening CTA */}
                <AnimatedPressable
                  onPress={() => {
                    hapticMedium();
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening' } });
                  }}
                  scaleDown={0.97}
                  style={styles.comboEveningCta}
                >
                  {streak > 0 && (
                    <View style={styles.heroStreakRow}>
                      <Text style={{ fontSize: 13 }}>🔥</Text>
                      <Text style={styles.heroStreakText}>{streak} days in a row — keep it going!</Text>
                    </View>
                  )}
                  <View style={styles.heroContentRow}>
                    <View style={[styles.heroIconWrap, { backgroundColor: '#ffffff' }]}>
                      <Text style={{ fontSize: 22 }}>🌙</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroTitle}>Evening check-in</Text>
                      <Text style={styles.heroSubtitle}>How was your day? Wind down.</Text>
                    </View>
                  </View>
                  <View style={styles.heroButton}>
                    <Text style={styles.heroButtonText}>Start check-in</Text>
                  </View>
                  <Text style={styles.heroHint}>Takes about 2 minutes</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* ══════════ STATE 3: BOTH DONE — Collapsed check-ins ══════════ */}
            {isToday && !trialExpired && morningDone && eveningDone && (
              <AnimatedPressable
                onPress={() => { hapticLight(); router.navigate('/(app)/calendar' as any); }}
                scaleDown={0.98}
                style={styles.collapsedCheckins}
              >
                <View style={styles.collapsedTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {streak > 0 && <Text style={{ fontSize: 13 }}>🔥</Text>}
                    <Text style={styles.collapsedStreakText}>{streak > 0 ? `${streak} days in a row` : 'All done today'}</Text>
                  </View>
                  <Text style={styles.seeAll}>View →</Text>
                </View>
                <View style={styles.collapsedPillRow}>
                  <AnimatedPressable
                    onPress={() => {
                      hapticLight();
                      const amLog = dayLogs.find((e) => e.logType === 'morning');
                      if (amLog) router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning', logId: String(amLog.id) } });
                    }}
                    scaleDown={0.97}
                    style={styles.collapsedPill}
                  >
                    <Text style={{ fontSize: 14 }}>🌤</Text>
                    <Text style={styles.collapsedPillText}>Morning ✓</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => {
                      hapticLight();
                      const pmLog = dayLogs.find((e) => e.logType === 'evening');
                      if (pmLog) router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening', logId: String(pmLog.id) } });
                    }}
                    scaleDown={0.97}
                    style={styles.collapsedPill}
                  >
                    <Text style={{ fontSize: 14 }}>🌙</Text>
                    <Text style={styles.collapsedPillText}>Evening ✓</Text>
                  </AnimatedPressable>
                </View>
              </AnimatedPressable>
            )}

            {/* Past day — journal card for non-today */}
            {!isToday && (
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
                      <Text style={styles.journalCardTitle}>{morningDone ? 'Morning ✓' : 'Morning journal'}</Text>
                      <Text style={styles.journalCardDesc}>{morningDone ? 'Done' : 'Add a morning entry for this day'}</Text>
                    </View>
                    {morningDone ? (
                      <View style={styles.journalCheckDone}><Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>✓</Text></View>
                    ) : <View style={styles.journalEmptyCheck} />}
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
                      <Text style={styles.journalCardTitle}>{eveningDone ? 'Evening ✓' : 'Evening reflection'}</Text>
                      <Text style={styles.journalCardDesc}>{eveningDone ? 'Done' : 'Add an evening entry for this day'}</Text>
                    </View>
                    {eveningDone ? (
                      <View style={styles.journalCheckDone}><Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>✓</Text></View>
                    ) : <View style={styles.journalEmptyCheck} />}
                  </View>
                </AnimatedPressable>
              </View>
            )}

            {/* ══════════ READINESS SCORE — blue gradient (shows after morning done) ══════════ */}
            {hasLog && (() => {
              const score = serverReadiness ?? readinessScore;
              const scoreNum = score ?? 0;
              const circumference = 150.8;
              const arcLength = (scoreNum / 100) * circumference;
              const activityLabel = scoreNum >= 70 ? 'Your body is ready' : scoreNum >= 40 ? 'Mixed day' : 'Go gentle';
              const aiNarrative = recommendation || narrative || null;

              return (
                <View style={styles.readinessCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View>
                      <Text style={styles.readinessLabel}>READINESS SCORE</Text>
                      <Text style={styles.readinessValue}>{score ?? '—'}</Text>
                    </View>
                    <View style={{ width: 56, height: 56 }}>
                      <Svg width={56} height={56} viewBox="0 0 56 56">
                        <Circle cx={28} cy={28} r={24} fill="none" stroke="#bfdbfe" strokeWidth={5} />
                        {score !== null && (
                          <Circle
                            cx={28} cy={28} r={24} fill="none"
                            stroke="#3b82f6" strokeWidth={5}
                            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                            strokeLinecap="round"
                            transform="rotate(-90 28 28)"
                          />
                        )}
                      </Svg>
                    </View>
                  </View>
                  <Text style={styles.readinessActivityLabel}>{activityLabel}</Text>
                  {(() => {
                    if (isRefreshing && !aiNarrative) {
                      return (
                        <View style={styles.analyzingRow}>
                          <ActivityIndicator size="small" color="#94a3b8" />
                          <Text style={styles.analyzingTextBlue}>Analysing your day...</Text>
                        </View>
                      );
                    }
                    if (aiNarrative) {
                      return <Text style={styles.readinessNarrative}>{aiNarrative}</Text>;
                    }
                    if (!morningDone && !eveningDone) return null;
                    const hrs = sleepLog?.sleepHours;
                    const topSym = symptomTrends.length > 0 ? symptomTrends[0].name.replace(/_/g, ' ') : null;
                    let msg = '';
                    if (scoreNum >= 70) {
                      msg = hrs ? `${hrs} hours of sleep and your body is responding well — a good day to be active.` : 'Your body is doing well today.';
                    } else if (scoreNum >= 40) {
                      const sleepNote = hrs ? `${hrs} hours of sleep is keeping things steady` : 'Some things are working in your favour';
                      const dragNote = topSym ? `, but ${topSym} is weighing on things` : ', though your body could use some care';
                      msg = `${sleepNote}${dragNote}.${!eveningDone ? ' Your evening check-in will complete today\'s picture.' : ''}`;
                    } else {
                      const context = hrs && hrs < 6 ? `Only ${hrs} hours of sleep is making everything feel harder` : topSym ? `${topSym.charAt(0).toUpperCase() + topSym.slice(1)} is weighing heavily today` : 'Your body is carrying a lot today';
                      msg = `${context}. Be extra gentle with yourself.`;
                    }
                    return <Text style={styles.readinessNarrative}>{msg}</Text>;
                  })()}
                </View>
              );
            })()}

            {/* ══════════ SOS — slim row ══════════ */}
            <AnimatedPressable
              onPress={() => { hapticMedium(); router.push('/(app)/sos'); }}
              scaleDown={0.97}
              style={styles.sosRow}
            >
              <View style={styles.sosIcon}>
                <Text style={{ fontSize: 14 }}>❄️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosTitle}>SOS — Hot flash?</Text>
                <Text style={styles.sosSubtitle}>Breathing exercise + grounding</Text>
              </View>
              <Text style={{ fontSize: 16, color: '#d6d3d1' }}>›</Text>
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

                {/* Auto-detected sleep card — from HealthKit step data (Rise-style) */}
                {autoSleep && healthData.connected && !sleepLog?.sleepHours && (
                  <AnimatedPressable
                    onPress={() => {
                      hapticLight();
                      router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                    }}
                    scaleDown={0.97}
                    style={[styles.card, { marginTop: 8, borderWidth: 1, borderColor: '#dbeafe' }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>🌙</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.trendName}>
                            {autoSleep.hours}h sleep detected
                          </Text>
                          <View style={{ backgroundColor: '#dbeafe', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: '500', color: '#2563eb' }}>Auto</Text>
                          </View>
                        </View>
                        <Text style={styles.trendSubtext}>
                          ~{autoSleep.sleepStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — ~{autoSleep.sleepEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Tap to log your morning
                        </Text>
                      </View>
                    </View>
                  </AnimatedPressable>
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
                          ? `${symptomTrends.some((s) => s.improving) ? 'Things are shifting' : 'Holding steady'}`
                          : streak >= 3
                            ? 'Building your picture'
                            : 'Getting started'
                    )}
                  </Text>
                  <Text style={styles.insightDesc}>
                    {insightNudge?.body || (
                      topCorrelations.length > 0
                        ? topCorrelations[0].humanLabel + (topCorrelations.length > 1 ? ` ${topCorrelations.length} patterns found so far.` : '')
                        : streak >= 14
                          ? `${streak} days logged — check your insights for patterns we've found.`
                          : streak >= 7
                            ? `${streak} days logged. A few more and we can start connecting the dots.`
                            : 'Log daily so we can start spotting what triggers your symptoms.'
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

            {/* ══════════ TONIGHT'S PLAN ══════════ */}
            {isToday && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Text style={styles.sectionTitle}>Tonight's plan</Text>
                  <Text style={{ fontSize: 14 }}>🌙</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {/* Program audio — next episode (no week/day label) */}
                  <AnimatedPressable
                    onPress={() => { hapticLight(); router.push('/(app)/player' as any); }}
                    scaleDown={0.97}
                    style={styles.tonightProgramCard}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.tonightProgramIcon}>
                        <Text style={{ fontSize: 16, color: '#ffffff' }}>✦</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tonightProgramTitle, { color: '#ffffff' }]}>
                          {/* Use suggestedAudio title if from program, else default */}
                          Why Sleep Changes in Perimenopause
                        </Text>
                        <Text style={[styles.tonightProgramSub, { color: '#a8a29e' }]}>Podcast · 20 min</Text>
                      </View>
                      <View style={[styles.tonightPlayBtn, { backgroundColor: '#44403c' }]}>
                        <Text style={{ fontSize: 12, color: '#ffffff', marginLeft: 2 }}>▶</Text>
                      </View>
                    </View>
                  </AnimatedPressable>

                  {/* Evening meditation */}
                  <AnimatedPressable
                    onPress={() => { hapticLight(); router.push('/(app)/player' as any); }}
                    scaleDown={0.97}
                    style={styles.tonightMeditationCard}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.tonightMeditationIcon}>
                        <Text style={{ fontSize: 18 }}>🧘‍♀️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tonightProgramTitle}>Body Scan for Sleep</Text>
                        <Text style={styles.tonightProgramSub}>Meditation · 15 min</Text>
                      </View>
                      <View style={styles.tonightPlayBtn}>
                        <Text style={{ fontSize: 12, color: '#a8a29e', marginLeft: 2 }}>▶</Text>
                      </View>
                    </View>
                  </AnimatedPressable>

                  {/* Tomorrow forecast */}
                  {tomorrowForecast && (
                    <View style={styles.tonightInsight}>
                      <Text style={{ fontSize: 14, color: '#047857', marginTop: 2 }}>💡</Text>
                      <Text style={styles.tonightInsightText}>
                        <Text style={{ fontWeight: '500', color: '#44403c' }}>Looking ahead: </Text>
                        {tomorrowForecast}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ══════════ PERIOD WIDGET — perimenopause users only ══════════ */}
            {isToday && periodEnabled && profile?.stage === 'peri' && (() => {
              const hasCycleData = periodCycle && periodCycle.cycle;
              const isActive = hasCycleData && periodCycle.cycle.status === 'active' && periodCycle.daysSinceStart != null && periodCycle.daysSinceStart <= 10;

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
                        <Text style={styles.periodWidgetWaitingSub}>Last period: {timeAgo(periodCycle.cycle.startDate)}</Text>
                      </View>
                      <Text style={{ fontSize: 18, color: '#d6d3d1' }}>›</Text>
                    </View>
                  </AnimatedPressable>
                );
              }
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

            {/* Empty state — no log for past day */}
            {!hasLog && !isToday && (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="add-circle-outline" size={36} color="#f59e0b" />
                </View>
                <Text style={styles.emptyTitle}>No log for this day</Text>
                <Text style={styles.emptyDesc}>You can still log a past entry to fill in the picture.</Text>
                <AnimatedPressable
                  onPress={() => {
                    hapticMedium();
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                  }}
                  scaleDown={0.96}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Log this day</Text>
                </AnimatedPressable>
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

  // ═══ State 1: Morning hero CTA ═══
  morningHeroCard: {
    backgroundColor: '#fef9c3',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  heroStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  heroStreakText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1c1917',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#78716c',
    marginTop: 3,
  },
  heroButton: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  heroHint: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
  },

  // ═══ State 2: Combo card (morning done + evening CTA) ═══
  comboCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  comboDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  comboDoneText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#057a55',
    flex: 1,
  },
  comboDoneTime: {
    fontSize: 13,
    color: '#a8a29e',
  },
  comboEveningCta: {
    backgroundColor: '#fef3c7',
    padding: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },

  // ═══ State 3: Collapsed check-ins ═══
  collapsedCheckins: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  collapsedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  collapsedStreakText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
  },
  collapsedPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  collapsedPill: {
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  collapsedPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#057a55',
  },

  // Readiness score — blue gradient card
  readinessCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  readinessLabel: {
    fontSize: 12,
    color: '#1e40af',
    letterSpacing: 1,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  readinessValue: {
    fontSize: 40,
    fontWeight: '300',
    color: '#1e3a5f',
    marginTop: 4,
  },
  readinessActivityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginTop: 2,
  },
  readinessHint: {
    fontSize: 14,
    color: '#64748b',
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
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 19,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  analyzingText: {
    fontSize: 12,
    color: '#a8a29e',
    fontStyle: 'italic',
  },
  analyzingTextBlue: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
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

  // SOS — slim row
  sosRow: {
    backgroundColor: '#fff1f2',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sosIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fecdd3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  sosSubtitle: { fontSize: 12, color: '#78716c', marginTop: 1 },

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

  // Tonight's Plan — program + meditation cards
  tonightProgramCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tonightProgramIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#44403c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tonightProgramTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1917',
  },
  tonightProgramSub: {
    fontSize: 13,
    color: '#78716c',
    marginTop: 2,
  },
  tonightMeditationCard: {
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
  tonightMeditationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Wellness Centre entry card (legacy — removed from view)
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

  // ═══ Delight Cards ═══

  // Trial expired banner (purple)
  trialEndedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f3ff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  trialEndedTitle: { fontSize: 14, fontWeight: '600', color: '#5b21b6' },
  trialEndedSub: { fontSize: 12, color: '#7c3aed', marginTop: 2 },

  // Welcome banner (amber gradient feel)
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  welcomeTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  welcomeSub: { fontSize: 12, color: '#b45309', marginTop: 2 },

  // Quiz data card
  quizDataCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  quizDataLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  quizDataTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  quizDataBody: { fontSize: 13, color: '#78716c', lineHeight: 19 },

  // Day 10 banner (rose)
  day10Banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  day10Title: { fontSize: 14, fontWeight: '600', color: '#9f1239' },
  day10Sub: { fontSize: 12, color: '#e11d48', marginTop: 2 },

  // Day 3 milestone card (amber)
  milestoneCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  milestoneTitle: { fontSize: 14, fontWeight: '700', color: '#1c1917' },
  milestonePill: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  milestonePillText: { fontSize: 10, fontWeight: '700', color: '#d97706' },
  milestoneSub: { fontSize: 13, color: '#78716c' },
  milestoneStatBox: {
    flex: 1,
    backgroundColor: '#fafaf9',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  milestoneStatNum: { fontSize: 18, fontWeight: '800', color: '#1c1917' },
  milestoneStatLabel: { fontSize: 11, color: '#a8a29e', marginTop: 2 },

  // Day 17-19 body map (dark)
  bodyMapCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  bodyMapLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a8a29e',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bodyMapTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 24,
    marginBottom: 12,
  },
  bodyMapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bodyMapStat: {
    width: '48%',
    backgroundColor: '#292524',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  bodyMapNum: { fontSize: 20, fontWeight: '800' },
  bodyMapStatLabel: { fontSize: 11, color: '#78716c', marginTop: 2 },
  bodyMapHint: {
    fontSize: 11,
    color: '#78716c',
    textAlign: 'center',
    marginTop: 10,
  },

  // Sleep comparison card (teal, Day 2-3)
  sleepCompareCard: {
    backgroundColor: '#042f2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sleepCompareTitle: { fontSize: 14, fontWeight: '700', color: '#ccfbf1' },
  sleepCompareBars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 14,
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  sleepCompareBarWrap: { alignItems: 'center', gap: 4 },
  sleepCompareBar: {
    width: 36,
    borderRadius: 6,
    backgroundColor: '#115e59',
  },
  sleepCompareBarActive: { backgroundColor: '#2dd4bf' },
  sleepCompareHours: { fontSize: 14, fontWeight: '800', color: '#f0fdfa' },
  sleepCompareDay: { fontSize: 11, color: '#5eead4' },
  sleepCompareHint: { fontSize: 12, color: '#99f6e4', textAlign: 'center' },

  // First pattern card (dark + teal accent, Day 4-7)
  firstPatternCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2dd4bf',
  },
  firstPatternDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2dd4bf',
  },
  firstPatternLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5eead4',
    letterSpacing: 1,
  },
  firstPatternTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  firstPatternSub: { fontSize: 13, color: '#a8a29e', lineHeight: 18 },
  firstPatternHint: { fontSize: 11, color: '#78716c', marginTop: 6 },
  firstPatternBtn: {
    marginTop: 10,
    backgroundColor: '#292524',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  firstPatternBtnText: { fontSize: 13, fontWeight: '600', color: '#2dd4bf' },

  // Correlation card (dark, Day 8-10)
  correlationCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  correlationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a8a29e',
    letterSpacing: 1,
  },
  correlationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
  },
  correlationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  correlationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  correlationText: { fontSize: 13, color: '#d6d3d1' },

  // Locked state (Day 20+)
  lockedCheckinCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    position: 'relative',
    overflow: 'hidden',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  sosAlwaysFree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  sosFreeBadge: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sosFreeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  pastDataCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  pastDataIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastDataTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  pastDataSub: { fontSize: 12, color: '#78716c', marginTop: 1 },
});

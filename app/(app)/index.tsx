import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
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

function buildDateStrip(count = 14): { dateStr: string; day: string; num: number; isToday: boolean }[] {
  const today = new Date();
  const days: { dateStr: string; day: string; num: number; isToday: boolean }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      dateStr: toDateStr(d),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
      num: d.getDate(),
      isToday: i === 0,
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
  const allSymptoms: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.symptomsJson) {
      Object.entries(e.symptomsJson).forEach(([k, v]) => {
        allSymptoms[k] = Math.max(allSymptoms[k] || 0, v as number);
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

  // Sleep score (0-100): 8h = 100, <4h = 20, quality bonus/penalty
  let sleepScore = 50; // default if no data
  if (sleepHours !== null) {
    sleepScore = Math.min(100, Math.max(10, (sleepHours / 8) * 85));
    if (sleepQuality === 'great') sleepScore = Math.min(100, sleepScore + 15);
    else if (sleepQuality === 'poor') sleepScore -= 15;
    else if (sleepQuality === 'terrible') sleepScore -= 25;
    sleepScore -= Math.min(20, (disruptions ?? 0) * 7);
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
  const { profile } = useProfile();
  const router = useRouter();
  const [dayLogs, setDayLogs] = useState<LogEntry[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [todayMedLogs, setTodayMedLogs] = useState<MedLog[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [lastLoggedHoursAgo, setLastLoggedHoursAgo] = useState<number | null>(null);
  const hasLoadedOnce = useRef(false);
  const dateStripRef = useRef<FlatList>(null);

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const dateStrip = useMemo(() => buildDateStrip(14), []);
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
      const token = await getToken();
      const todayDate = toDateStr(new Date());
      const [logData, medsData, medLogsData, recentLogs, articlesData] = await Promise.all([
        apiRequest(`/api/logs?date=${selectedDate}`, token).catch(() => []),
        apiRequest('/api/meds', token).catch(() => []),
        apiRequest(`/api/meds/logs?date=${todayDate}`, token).catch(() => []),
        apiRequest('/api/logs?range=28d', token).catch(() => []),
        apiRequest('/api/articles', token).catch(() => []),
      ]);
      // API now returns array of entries per day
      setDayLogs(Array.isArray(logData) ? logData : logData ? [logData] : []);
      setMeds(medsData);
      if (Array.isArray(medLogsData)) setTodayMedLogs(medLogsData);
      if (Array.isArray(articlesData)) setArticles(articlesData.slice(0, 3));

      // Calculate streak
      if (Array.isArray(recentLogs) && recentLogs.length > 0) {
        let count = 0;
        const sorted = recentLogs.sort(
          (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const checkDate = new Date();
        for (const log of sorted) {
          const logDate = log.date;
          const expected = checkDate.toISOString().split('T')[0];
          if (logDate === expected) {
            count++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
        setStreak(count);
        // Hours since last log
        if (sorted.length > 0) {
          const lastDate = new Date(sorted[0].date + 'T12:00:00');
          const hrs = Math.round((Date.now() - lastDate.getTime()) / 3600000);
          setLastLoggedHoursAgo(hrs);
        }
      }
      hasLoadedOnce.current = true;
    } catch {
      // Non-critical
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedDate]);

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
  const symptomTrends = useMemo(() => {
    const merged: Record<string, number> = {};
    dayLogs.forEach((log) => {
      if (log.symptomsJson) {
        Object.entries(log.symptomsJson).forEach(([k, v]) => {
          merged[k] = Math.max(merged[k] || 0, v as number);
        });
      }
    });
    const entries = Object.entries(merged)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
    const colors = ['#fbbf24', '#818cf8', '#34d399', '#fda4af'];
    return entries.map(([name, sev], i) => ({
      name: name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      sev: Math.min(Math.ceil(sev / 3.3), 3),
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

        {/* Date strip — last 14 days */}
        <FlatList
          ref={dateStripRef}
          horizontal
          data={dateStrip}
          keyExtractor={(item) => item.dateStr}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStripContent}
          style={styles.dateStrip}
          initialScrollIndex={dateStrip.length - 1}
          getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
          renderItem={({ item }) => {
            const selected = item.dateStr === selectedDate;
            return (
              <AnimatedPressable
                onPress={() => {
                  hapticSelection();
                  setSelectedDate(item.dateStr);
                }}
                scaleDown={0.9}
                style={[
                  styles.dateStripItem,
                  selected && styles.dateStripItemSelected,
                ]}
              >
                <Text style={[styles.dateStripDay, selected && styles.dateStripDaySelected]}>
                  {item.day}
                </Text>
                <Text style={[styles.dateStripNum, selected && styles.dateStripNumSelected]}>
                  {item.num}
                </Text>
                {item.isToday && <View style={[styles.dateStripDot, selected && styles.dateStripDotSelected]} />}
              </AnimatedPressable>
            );
          }}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : (
          <>
            {/* Readiness Score Card — dark */}
            {(() => {
              const score = readinessScore;
              const scoreNum = score ?? 0;
              const circumference = 163.4;
              const arcLength = (scoreNum / 100) * circumference;
              return (
                <View style={styles.readinessCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readinessLabel}>READINESS SCORE</Text>
                    <Text style={styles.readinessValue}>{score ?? '—'}</Text>
                    {hasLog && (
                      <Text style={styles.readinessHint}>
                        {sleepLog?.sleepHours ? `${sleepLog.sleepHours}h sleep` : 'No sleep data'} · {latestMood ? MOOD_LABEL[latestMood] : 'No mood'}
                      </Text>
                    )}
                    {!hasLog && (
                      <Text style={styles.readinessHint}>
                        {isToday ? 'Log today to see your score' : 'No data for this day'}
                      </Text>
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

            {/* SOS + Quick check-in — side by side */}
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
                  if (!isToday) {
                    router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
                  } else if (morningDone && eveningDone) {
                    router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
                  } else {
                    router.push({ pathname: '/(app)/quick-log', params: { mode: suggestEvening ? 'evening' : 'morning' } });
                  }
                }}
                scaleDown={0.97}
                style={styles.quickLogCard}
              >
                <View style={styles.quickLogIcon}>
                  <Text style={styles.quickLogIconText}>
                    {isToday ? (suggestEvening && !eveningDone ? '🌙' : morningDone && eveningDone ? '+' : '☀️') : '+'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickLogTitle}>
                    {!isToday
                      ? 'Log this day'
                      : morningDone && eveningDone
                        ? 'Add another'
                        : suggestEvening && !eveningDone
                          ? 'Evening check-in'
                          : 'Morning check-in'}
                  </Text>
                  <Text style={styles.quickLogSub}>
                    {!isToday
                      ? hasLog ? `${dayLogs.length} entr${dayLogs.length === 1 ? 'y' : 'ies'}` : 'Add a past entry'
                      : morningDone && eveningDone
                        ? 'Both check-ins done ✓'
                        : '4 steps · under 2 min'}
                  </Text>
                </View>
              </AnimatedPressable>
            </View>

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

                {/* Sleep score row */}
                {sleepLog?.sleepHours && (
                  <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }]}>
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
                        <Text style={{ color: '#818cf8', fontWeight: '700' }}>
                          {sleepLog.sleepHours}h
                        </Text>
                      </Text>
                      <Text style={styles.trendSubtext}>
                        {sleepLog.disruptions ? `${sleepLog.disruptions} disruption${sleepLog.disruptions !== 1 ? 's' : ''}` : 'No disruptions logged'}
                        {sleepLog.sleepQuality ? ` · ${sleepLog.sleepQuality}` : ''}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Insight nudge — pattern detection */}
            {hasLog && symptomTrends.length > 0 && (
              <AnimatedPressable
                onPress={() => { hapticLight(); router.push('/(app)/insights'); }}
                scaleDown={0.98}
                style={styles.insightCard}
              >
                <Text style={styles.insightStar}>✦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>
                    {streak >= 14
                      ? `Overall ${symptomTrends.length > 0 ? 'improving' : 'stable'}. ${symptomTrends[0]?.name || 'Your patterns'} trending.`
                      : 'We spotted a pattern'}
                  </Text>
                  <Text style={styles.insightDesc}>
                    {streak >= 14
                      ? `Your ${symptomTrends[0]?.name?.toLowerCase() || 'top symptom'} tends to worsen after poor sleep.`
                      : 'Keep logging daily so we can identify triggers and trends in your symptoms.'}
                  </Text>
                  <Text style={[styles.seeAll, { marginTop: 6 }]}>See why →</Text>
                </View>
              </AnimatedPressable>
            )}

            {/* Morning / Evening summary cards */}
            {dayLogs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Check-ins</Text>
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
                          router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'morning' } });
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
                            router.push({ pathname: '/(app)/quick-log', params: { date: selectedDate, mode: 'evening' } });
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
                          <Text style={{ fontSize: 12, color: '#78716c', marginTop: 4 }}>
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

            {/* Meds empty state — opt-in, off by default */}
            {false && (
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
                      params: { date: selectedDate, mode: suggestEvening ? 'evening' : 'morning' },
                    });
                  }}
                  scaleDown={0.96}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>
                    {isToday ? 'Quick check-in' : 'Log this day'}
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
  dateText: { fontSize: 12, color: '#a8a29e', fontWeight: '300', marginBottom: 2 },
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

  // Date strip
  dateStrip: {
    marginBottom: 16,
    marginHorizontal: -24,
  },
  dateStripContent: {
    paddingHorizontal: 24,
    gap: 4,
  },
  dateStripItem: {
    width: 48,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
  },
  dateStripItemSelected: {
    backgroundColor: '#1c1917',
  },
  dateStripDay: {
    fontSize: 11,
    color: '#a8a29e',
    fontWeight: '400',
    marginBottom: 4,
  },
  dateStripDaySelected: {
    color: '#78716c',
  },
  dateStripNum: {
    fontSize: 16,
    fontWeight: '600',
    color: '#44403c',
  },
  dateStripNumSelected: {
    color: '#ffffff',
  },
  dateStripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1c1917',
    marginTop: 4,
  },
  dateStripDotSelected: {
    backgroundColor: '#ffffff',
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
    fontSize: 10,
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
    fontSize: 12,
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
    fontSize: 10,
    color: '#78716c',
    marginTop: 4,
  },

  // SOS + Quick log row
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  sosIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTitle: { fontSize: 12, fontWeight: '600', color: '#115e59' },
  sosSubtitle: { fontSize: 11, color: '#5eead4' },
  quickLogCard: {
    flex: 1,
    backgroundColor: '#f5f5f4',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickLogIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogIconText: { fontSize: 20, fontWeight: '300', color: '#ffffff' },
  quickLogTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  quickLogSub: { fontSize: 11, color: '#a8a29e', marginTop: 1 },

  // Sections
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  seeAll: { fontSize: 12, color: '#a8a29e', fontWeight: '300' },

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
    fontSize: 12,
    fontWeight: '500',
    color: '#44403c',
    marginLeft: 6,
  },
  trendSubtext: {
    fontSize: 11,
    color: '#a8a29e',
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
  cardHintText: { fontSize: 13, color: '#a8a29e', textAlign: 'center' },

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
  insightStar: { fontSize: 18, color: '#f59e0b' },
  insightTitle: { fontSize: 14, fontWeight: '500', color: '#44403c' },
  insightDesc: { fontSize: 12, color: '#78716c', marginTop: 4, lineHeight: 18 },

  // Plan icons
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { fontSize: 13, fontWeight: '500', color: '#44403c' },
  planSubtitle: { fontSize: 11, color: '#a8a29e', marginTop: 1 },
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
  emptyDesc: { fontSize: 13, color: '#78716c', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

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
  summaryTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', flex: 1 },
  summaryTime: { fontSize: 11, color: '#a8a29e' },
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
  summaryChipText: { fontSize: 11, color: '#78716c' },
  summaryGratitude: {
    fontSize: 12,
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
  learnMeta: { fontSize: 11, color: '#a8a29e', marginBottom: 4 },
  learnTitle: { fontSize: 12, fontWeight: '500', color: '#44403c', lineHeight: 17 },

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
  medsEmptyTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  medsEmptyDesc: { fontSize: 12, color: '#a8a29e', textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  medsEmptyButton: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  medsEmptyButtonText: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
});

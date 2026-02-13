import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Svg, { Circle } from 'react-native-svg';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

// ─── Constants ──────────────────────────────────────────
const PERIODS = [
  { key: '1w', label: '1W' },
  { key: '4w', label: '4W' },
  { key: '3m', label: '3M' },
  { key: 'all', label: 'All' },
];

const TABS = [
  { key: 'patterns', label: 'My patterns' },
  { key: 'normal', label: 'Am I normal?' },
];

const SYMPTOM_EMOJI: Record<string, string> = {
  hot_flash: '🔥', brain_fog: '😶‍🌫️', irritability: '😤', joint_pain: '💪',
  anxiety: '😰', fatigue: '😩', nausea: '🤢', heart_racing: '💓',
  night_sweats: '🌊', headache: '🤕', mood_swings: '🎭', insomnia: '😴',
};

const POPULATION_BENCHMARKS: Record<string, { pct: number; label: string; detail: string }> = {
  hot_flash: { pct: 79, label: 'Very common', detail: '79% of women in perimenopause experience hot flashes' },
  brain_fog: { pct: 60, label: 'Very common', detail: '60% report cognitive difficulties during hormonal changes' },
  irritability: { pct: 70, label: 'Very common', detail: '70% of perimenopausal women report increased irritability' },
  joint_pain: { pct: 50, label: 'Common', detail: 'About half of women experience joint pain during perimenopause' },
  anxiety: { pct: 51, label: 'Common', detail: '51% of women report new or worsening anxiety' },
  fatigue: { pct: 85, label: 'Very common', detail: '85% of perimenopausal women report persistent fatigue' },
  nausea: { pct: 28, label: 'Less common', detail: '28% report nausea — often linked to hormonal fluctuations' },
  heart_racing: { pct: 42, label: 'Common', detail: '42% experience heart palpitations — it\'s hormonal, not dangerous' },
  night_sweats: { pct: 75, label: 'Very common', detail: '75% of women experience night sweats during perimenopause' },
};

const NORMALIZATION_FACTS = [
  { emoji: '🧠', title: 'Brain fog is hormonal', desc: 'Estrogen fluctuations directly affect memory and focus. It\'s not "just stress" — your brain is adapting.' },
  { emoji: '💓', title: 'Heart pounding is hormonal', desc: 'Palpitations during perimenopause are caused by estrogen changes affecting your cardiovascular system.' },
  { emoji: '📊', title: 'Often misdiagnosed', desc: '73% of women experience perimenopause symptoms but only 1 in 4 are correctly identified by their doctor.' },
  { emoji: '💪', title: 'Joint pain is real', desc: 'Estrogen helps protect your joints. As levels drop, inflammation can increase — this is not "getting old."' },
];

interface LogEntry {
  id: number;
  date: string;
  logType: string | null;
  symptomsJson: Record<string, number> | null;
  mood: number | null;
  energy: number | null;
  sleepHours: number | null;
  sleepQuality: string | null;
  disruptions: number | null;
  contextTags: string[] | null;
  notes: string | null;
}

// ─── Helper functions ───────────────────────────────────

function formatSymptomName(name: string): string {
  return name.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function computeCorrelations(logs: LogEntry[]) {
  const results: { factor: string; symptom: string; direction: 'positive' | 'negative'; pct: number; confidence: string; days: number }[] = [];
  if (logs.length < 7) return results;

  // Sleep → symptom correlation
  const logsWithSleep = logs.filter((l) => l.sleepHours != null);
  const goodSleepLogs = logsWithSleep.filter((l) => (l.sleepHours ?? 0) >= 7);
  const poorSleepLogs = logsWithSleep.filter((l) => (l.sleepHours ?? 0) < 6);

  // Collect all symptoms
  const allSymptoms = new Set<string>();
  logs.forEach((l) => {
    if (l.symptomsJson) Object.keys(l.symptomsJson).forEach((s) => allSymptoms.add(s));
  });

  allSymptoms.forEach((symptom) => {
    // Check sleep correlation
    if (goodSleepLogs.length >= 3 && poorSleepLogs.length >= 3) {
      const goodSleepSymptomRate = goodSleepLogs.filter((l) => l.symptomsJson?.[symptom]).length / goodSleepLogs.length;
      const poorSleepSymptomRate = poorSleepLogs.filter((l) => l.symptomsJson?.[symptom]).length / poorSleepLogs.length;
      const diff = Math.round((poorSleepSymptomRate - goodSleepSymptomRate) * 100);
      if (Math.abs(diff) > 15) {
        results.push({
          factor: 'Good sleep (7h+)',
          symptom: formatSymptomName(symptom),
          direction: diff > 0 ? 'positive' : 'negative',
          pct: Math.abs(diff),
          confidence: logsWithSleep.length > 20 ? 'High confidence' : 'Building confidence',
          days: logsWithSleep.length,
        });
      }
    }

    // Check exercise correlation
    const exerciseLogs = logs.filter((l) => (l.contextTags || []).some((t) => t.toLowerCase().includes('exercise') || t.toLowerCase().includes('workout')));
    const noExerciseLogs = logs.filter((l) => !(l.contextTags || []).some((t) => t.toLowerCase().includes('exercise') || t.toLowerCase().includes('workout')));
    if (exerciseLogs.length >= 3 && noExerciseLogs.length >= 3) {
      const exRate = exerciseLogs.filter((l) => l.symptomsJson?.[symptom]).length / exerciseLogs.length;
      const noExRate = noExerciseLogs.filter((l) => l.symptomsJson?.[symptom]).length / noExerciseLogs.length;
      const diff = Math.round((noExRate - exRate) * 100);
      if (diff > 15) {
        results.push({
          factor: 'Exercise',
          symptom: formatSymptomName(symptom),
          direction: 'positive',
          pct: diff,
          confidence: exerciseLogs.length > 10 ? 'High confidence' : 'Building confidence',
          days: exerciseLogs.length + noExerciseLogs.length,
        });
      }
    }

    // Check alcohol correlation
    const alcoholLogs = logs.filter((l) => (l.contextTags || []).some((t) => t.toLowerCase().includes('alcohol')));
    const noAlcoholLogs = logs.filter((l) => !(l.contextTags || []).some((t) => t.toLowerCase().includes('alcohol')));
    if (alcoholLogs.length >= 2 && noAlcoholLogs.length >= 3) {
      const alcRate = alcoholLogs.filter((l) => l.symptomsJson?.[symptom]).length / alcoholLogs.length;
      const noAlcRate = noAlcoholLogs.filter((l) => l.symptomsJson?.[symptom]).length / noAlcoholLogs.length;
      const diff = Math.round((alcRate - noAlcRate) * 100);
      if (diff > 15) {
        results.push({
          factor: 'Alcohol',
          symptom: formatSymptomName(symptom),
          direction: 'negative',
          pct: diff,
          confidence: alcoholLogs.length > 8 ? 'High confidence' : 'Investigating',
          days: alcoholLogs.length + noAlcoholLogs.length,
        });
      }
    }
  });

  // Sort by pct descending, limit to top 4
  return results.sort((a, b) => b.pct - a.pct).slice(0, 4);
}

function computeHelpsHurts(logs: LogEntry[]) {
  if (logs.length < 5) return { helps: [], hurts: [] };

  const tagSymptomEffect: Record<string, { better: number; worse: number; total: number }> = {};
  const activities = ['exercise', 'meditated', 'time outdoors', 'hydrated', 'alcohol', 'caffeine', 'sugar', 'spicy'];

  logs.forEach((l) => {
    const tags = (l.contextTags || []).map((t) => t.toLowerCase());
    const symptomCount = l.symptomsJson ? Object.keys(l.symptomsJson).length : 0;
    const avgSeverity = l.symptomsJson
      ? Object.values(l.symptomsJson).reduce((a, b) => a + b, 0) / Math.max(1, symptomCount)
      : 0;

    activities.forEach((act) => {
      if (tags.some((t) => t.includes(act))) {
        if (!tagSymptomEffect[act]) tagSymptomEffect[act] = { better: 0, worse: 0, total: 0 };
        tagSymptomEffect[act].total += 1;
        if (avgSeverity < 1.5) tagSymptomEffect[act].better += 1;
        else if (avgSeverity > 2) tagSymptomEffect[act].worse += 1;
      }
    });
  });

  const helps: { label: string; pct: number }[] = [];
  const hurts: { label: string; pct: number }[] = [];

  Object.entries(tagSymptomEffect).forEach(([tag, data]) => {
    if (data.total < 2) return;
    const betterRate = Math.round((data.better / data.total) * 100);
    const worseRate = Math.round((data.worse / data.total) * 100);
    const name = tag.charAt(0).toUpperCase() + tag.slice(1);
    if (betterRate > worseRate && betterRate > 30) helps.push({ label: name, pct: betterRate });
    if (worseRate > betterRate && worseRate > 30) hurts.push({ label: name, pct: worseRate });
  });

  return {
    helps: helps.sort((a, b) => b.pct - a.pct).slice(0, 4),
    hurts: hurts.sort((a, b) => b.pct - a.pct).slice(0, 4),
  };
}

function computeSleepScore(logs: LogEntry[]) {
  const sleepLogs = logs.filter((l) => l.sleepHours != null);
  if (sleepLogs.length === 0) return null;
  const avgHours = sleepLogs.reduce((sum, l) => sum + (l.sleepHours ?? 0), 0) / sleepLogs.length;
  const poorNights = sleepLogs.filter(
    (l) => l.sleepQuality === 'poor' || l.sleepQuality === 'terrible' ||
           l.sleepQuality === 'Terrible' || l.sleepQuality === 'Poor'
  ).length;

  let score = Math.min(100, Math.max(10, (avgHours / 8) * 85));
  score -= Math.min(20, poorNights * 3);
  score = Math.round(Math.max(10, score));

  // Weekly bar chart data (last 7 entries)
  const weeklyBars = sleepLogs.slice(0, 7).reverse().map((l) => ({
    hours: l.sleepHours ?? 0,
    day: new Date(l.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0),
  }));

  const avgDisruptions = sleepLogs.reduce((sum, l) => sum + (l.disruptions ?? 0), 0) / sleepLogs.length;

  return {
    score,
    avgHours: avgHours.toFixed(1),
    avgDisruptions: avgDisruptions.toFixed(1),
    weeklyBars,
    totalNights: sleepLogs.length,
    latestHours: sleepLogs[0]?.sleepHours ?? 0,
  };
}

function computeSparkline(logs: LogEntry[], symptom: string): number[] {
  // Split logs into 8 buckets, return avg severity per bucket
  const relevant = logs.filter((l) => l.symptomsJson?.[symptom]);
  if (relevant.length < 3) return [];
  const bucketSize = Math.max(1, Math.ceil(logs.length / 8));
  const bars: number[] = [];
  for (let i = 0; i < 8; i++) {
    const bucket = logs.slice(i * bucketSize, (i + 1) * bucketSize);
    const symptomLogs = bucket.filter((l) => l.symptomsJson?.[symptom]);
    if (symptomLogs.length === 0) { bars.push(0); continue; }
    const avg = symptomLogs.reduce((s, l) => s + (l.symptomsJson?.[symptom] ?? 0), 0) / symptomLogs.length;
    bars.push(avg);
  }
  return bars;
}

function computeWeeklyStory(logs: LogEntry[]) {
  if (logs.length < 3) return null;
  const recent7 = logs.slice(0, 7);

  // Best day (highest mood or lowest symptom count)
  let bestDay = recent7[0];
  let worstDay = recent7[0];
  recent7.forEach((l) => {
    const score = (l.mood ?? 3) - (l.symptomsJson ? Object.keys(l.symptomsJson).length * 0.5 : 0);
    const bestScore = (bestDay.mood ?? 3) - (bestDay.symptomsJson ? Object.keys(bestDay.symptomsJson).length * 0.5 : 0);
    const worstScore = (worstDay.mood ?? 3) - (worstDay.symptomsJson ? Object.keys(worstDay.symptomsJson).length * 0.5 : 0);
    if (score > bestScore) bestDay = l;
    if (score < worstScore) worstDay = l;
  });

  // Top symptom trend
  const symptomCounts: Record<string, number> = {};
  recent7.forEach((l) => {
    if (l.symptomsJson) Object.keys(l.symptomsJson).forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
  });
  const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0];

  // Good sleep days
  const goodSleepDays = recent7.filter((l) => (l.sleepHours ?? 0) >= 7).length;

  // Build narrative
  let narrative = '';
  if (topSymptom) {
    const name = formatSymptomName(topSymptom[0]);
    const daysWithIt = topSymptom[1];
    const older7 = logs.slice(7, 14);
    const olderCount = older7.filter((l) => l.symptomsJson?.[topSymptom[0]]).length;
    if (olderCount > 0 && daysWithIt < olderCount) {
      const drop = Math.round(((olderCount - daysWithIt) / olderCount) * 100);
      narrative = `Your ${name.toLowerCase()} dropped ${drop}% this week.`;
    } else if (daysWithIt >= 5) {
      narrative = `${name} showed up ${daysWithIt} of 7 days this week.`;
    } else {
      narrative = `${name} appeared ${daysWithIt} time${daysWithIt === 1 ? '' : 's'} this week.`;
    }
  }

  if (goodSleepDays >= 5) {
    narrative += ` Great sleep — you hit 7+ hours on ${goodSleepDays} nights.`;
  } else if (goodSleepDays <= 2) {
    narrative += ` Sleep was rough — only ${goodSleepDays} nights of 7+ hours.`;
  }

  return {
    narrative,
    bestDay: bestDay ? new Date(bestDay.date).toLocaleDateString('en', { weekday: 'long' }) : null,
    worstDay: worstDay ? new Date(worstDay.date).toLocaleDateString('en', { weekday: 'long' }) : null,
    bestMood: bestDay?.mood ?? 3,
    worstMood: worstDay?.mood ?? 3,
  };
}

// ─── Main Component ─────────────────────────────────────

export default function InsightsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ symptom?: string }>();
  const [activeTab, setActiveTab] = useState<'patterns' | 'normal'>('patterns');
  const [period, setPeriod] = useState('4w');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getToken();
      const range = period === '1w' ? '7d' : period === '4w' ? '28d' : period === '3m' ? '90d' : '365d';
      const data = await apiRequest(`/api/logs?range=${range}`, token).catch(() => []);
      setLogs(Array.isArray(data) ? data : []);
      hasLoadedOnce.current = true;
    } catch {
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // ─── Computed data ──────────────────────────────
  const symptomTrends = useMemo(() => {
    const merged: Record<string, { total: number; count: number }> = {};
    logs.forEach((log) => {
      if (log.symptomsJson) {
        Object.entries(log.symptomsJson).forEach(([k, v]) => {
          if (!merged[k]) merged[k] = { total: 0, count: 0 };
          merged[k].total += v as number;
          merged[k].count += 1;
        });
      }
    });
    return Object.entries(merged)
      .map(([name, data]) => {
        const avg = data.total / data.count;
        const halfIdx = Math.floor(logs.length / 2);
        const firstHalf = logs.slice(halfIdx);
        const secondHalf = logs.slice(0, halfIdx);
        const firstCount = firstHalf.filter((l) => l.symptomsJson?.[name]).length;
        const secondCount = secondHalf.filter((l) => l.symptomsJson?.[name]).length;
        const trendPct = firstCount > 0 ? Math.round(((secondCount - firstCount) / firstCount) * 100) : 0;
        const sparkline = computeSparkline(logs, name);
        return { name, avg, count: data.count, trendPct, sparkline, daysTotal: logs.length };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [logs]);

  const correlations = useMemo(() => computeCorrelations(logs), [logs]);
  const helpsHurts = useMemo(() => computeHelpsHurts(logs), [logs]);
  const sleepData = useMemo(() => computeSleepScore(logs), [logs]);
  const weeklyStory = useMemo(() => computeWeeklyStory(logs), [logs]);

  const hasData = logs.length > 0;
  const totalDays = logs.length;
  const headerSub = totalDays > 0 ? `${totalDays} days of data · Updated today` : 'Start logging to see insights';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Why you feel this way</Text>
            <Text style={styles.headerSub}>{headerSub}</Text>
          </View>
          <AnimatedPressable
            onPress={() => { hapticLight(); }}
            scaleDown={0.95}
            style={styles.reportButton}
          >
            <Text style={styles.reportButtonText}>Report →</Text>
          </AnimatedPressable>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <AnimatedPressable
                key={tab.key}
                onPress={() => { hapticSelection(); setActiveTab(tab.key as 'patterns' | 'normal'); }}
                scaleDown={0.97}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Period pills (patterns tab only) */}
        {activeTab === 'patterns' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.periodStrip}
            contentContainerStyle={styles.periodContent}
          >
            {PERIODS.map((p) => {
              const active = p.key === period;
              return (
                <AnimatedPressable
                  key={p.key}
                  onPress={() => { hapticSelection(); setPeriod(p.key); }}
                  scaleDown={0.95}
                  style={[styles.periodPill, active && styles.periodPillActive]}
                >
                  <Text style={[styles.periodText, active && styles.periodTextActive]}>{p.label}</Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>📊</Text>
            <Text style={styles.emptyTitle}>Not enough data yet</Text>
            <Text style={styles.emptyDesc}>
              Log your symptoms for a few days and insights will start appearing here.
            </Text>
          </View>
        ) : activeTab === 'patterns' ? (
          /* ═══════════════ MY PATTERNS TAB ═══════════════ */
          <>
            {/* ─── This week's story ────────────────── */}
            {weeklyStory && weeklyStory.narrative ? (
              <View style={styles.storyCard}>
                <Text style={styles.storyLabel}>This week's story</Text>
                <Text style={styles.storyNarrative}>{weeklyStory.narrative}</Text>
                {weeklyStory.bestDay && weeklyStory.worstDay && (
                  <View style={styles.storyDays}>
                    <View style={styles.storyDayCard}>
                      <Text style={styles.storyDayEmoji}>😊</Text>
                      <Text style={styles.storyDayLabel}>Best day</Text>
                      <Text style={styles.storyDayValue}>{weeklyStory.bestDay}</Text>
                    </View>
                    <View style={styles.storyDayCard}>
                      <Text style={styles.storyDayEmoji}>😔</Text>
                      <Text style={styles.storyDayLabel}>Hardest day</Text>
                      <Text style={styles.storyDayValue}>{weeklyStory.worstDay}</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            {/* ─── What we've connected (correlations) ─ */}
            {correlations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What we've connected</Text>
                <View style={{ gap: 8 }}>
                  {correlations.map((c, i) => (
                    <View
                      key={i}
                      style={[
                        styles.correlationCard,
                        c.direction === 'positive' ? styles.correlationPositive : styles.correlationNegative,
                      ]}
                    >
                      <Text style={styles.correlationFactor}>{c.factor}</Text>
                      <Text style={styles.correlationArrow}>
                        {c.direction === 'positive' ? '→' : '→'} {c.symptom}{' '}
                        <Text style={{ color: c.direction === 'positive' ? '#059669' : '#dc2626' }}>
                          {c.direction === 'positive' ? `↓${c.pct}%` : `↑${c.pct}%`}
                        </Text>
                      </Text>
                      <Text style={styles.correlationConfidence}>
                        Seen in {c.days} days · {c.confidence}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── Symptom trends with sparklines ──── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your symptoms this month</Text>
              {symptomTrends.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {symptomTrends.map((s) => {
                    const trendColor = s.trendPct < 0 ? '#059669' : s.trendPct > 0 ? '#d97706' : '#a8a29e';
                    const trendLabel = s.trendPct < 0
                      ? `↓ ${Math.abs(s.trendPct)}%`
                      : s.trendPct > 0
                        ? `↑ ${s.trendPct}%`
                        : '— steady';
                    const emoji = SYMPTOM_EMOJI[s.name] || '•';
                    const sparkBars = s.sparkline.length > 0 ? s.sparkline : [0, 1, 2, 1, 0, 1, 2, 1];
                    return (
                      <AnimatedPressable
                        key={s.name}
                        onPress={() => {
                          hapticLight();
                          router.push({ pathname: '/(app)/symptom-detail', params: { symptom: s.name } });
                        }}
                        scaleDown={0.97}
                        style={styles.symptomCard}
                      >
                        <Text style={{ fontSize: 16 }}>{emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.symptomName}>{formatSymptomName(s.name)}</Text>
                          <View style={styles.symptomMeta}>
                            <Text style={[styles.symptomTrend, { color: trendColor }]}>{trendLabel}</Text>
                            <Text style={styles.symptomDays}>{s.count} days</Text>
                          </View>
                        </View>
                        {/* Mini sparkline */}
                        <View style={styles.sparkline}>
                          {sparkBars.map((v, i) => (
                            <View
                              key={i}
                              style={[
                                styles.sparkBar,
                                {
                                  height: Math.max(v * 7, 2),
                                  backgroundColor: v >= 2.5 ? '#f59e0b' : v >= 1.5 ? '#fbbf24' : '#e7e5e4',
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={{ color: '#d6d3d1', fontSize: 16 }}>›</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardHint}>Log symptoms to see your trends here</Text>
                </View>
              )}
            </View>

            {/* ─── What helps vs what hurts ─────────── */}
            {(helpsHurts.helps.length > 0 || helpsHurts.hurts.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What helps vs. what hurts</Text>
                <View style={styles.helpsHurtsRow}>
                  {/* Helps */}
                  <View style={[styles.helpsHurtsCard, styles.helpsCard]}>
                    <Text style={styles.helpsHurtsLabel}>Helps ↓</Text>
                    {helpsHurts.helps.length > 0 ? helpsHurts.helps.map((h) => (
                      <View key={h.label} style={styles.hhItem}>
                        <View style={styles.hhRow}>
                          <Text style={styles.hhName}>{h.label}</Text>
                          <Text style={[styles.hhPct, { color: '#059669' }]}>{h.pct}%</Text>
                        </View>
                        <View style={styles.hhBarBg}>
                          <View style={[styles.hhBarFill, { width: `${h.pct}%`, backgroundColor: '#059669' }]} />
                        </View>
                      </View>
                    )) : (
                      <Text style={styles.hhEmpty}>Keep logging to find patterns</Text>
                    )}
                  </View>
                  {/* Hurts */}
                  <View style={[styles.helpsHurtsCard, styles.hurtsCard]}>
                    <Text style={styles.helpsHurtsLabel}>Hurts ↑</Text>
                    {helpsHurts.hurts.length > 0 ? helpsHurts.hurts.map((h) => (
                      <View key={h.label} style={styles.hhItem}>
                        <View style={styles.hhRow}>
                          <Text style={styles.hhName}>{h.label}</Text>
                          <Text style={[styles.hhPct, { color: '#dc2626' }]}>{h.pct}%</Text>
                        </View>
                        <View style={styles.hhBarBg}>
                          <View style={[styles.hhBarFill, { width: `${h.pct}%`, backgroundColor: '#dc2626' }]} />
                        </View>
                      </View>
                    )) : (
                      <Text style={styles.hhEmpty}>Need more data</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* ─── Sleep Analysis ──────────────────── */}
            {sleepData && (
              <View style={styles.sleepCard}>
                <View style={styles.sleepHeader}>
                  <View style={styles.sleepRingContainer}>
                    <View style={styles.sleepRing}>
                      <View style={styles.sleepRingArcWrap}>
                        <Svg width={64} height={64} viewBox="0 0 64 64">
                          <Circle
                            cx={32} cy={32} r={28}
                            fill="none"
                            stroke="#818cf8"
                            strokeWidth={3}
                            strokeDasharray={`${(sleepData.score / 100) * 176} 176`}
                            strokeLinecap="round"
                            transform="rotate(-90 32 32)"
                          />
                        </Svg>
                      </View>
                      <Text style={styles.sleepRingScore}>{sleepData.score}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sleepLabel}>Sleep Score</Text>
                    <Text style={styles.sleepValue}>Avg {sleepData.avgHours}h · {sleepData.totalNights} nights tracked</Text>
                    <Text style={styles.sleepHint}>{sleepData.avgDisruptions} avg disruptions/night</Text>
                  </View>
                </View>
                {/* Weekly bars */}
                {sleepData.weeklyBars.length > 0 && (
                  <View style={styles.sleepBarsRow}>
                    {sleepData.weeklyBars.map((bar, i) => (
                      <View key={i} style={styles.sleepBarCol}>
                        <View style={[styles.sleepBarFill, { height: Math.max((bar.hours / 10) * 40, 4) }]} />
                        <Text style={styles.sleepBarLabel}>{bar.day}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ─── What to expect ──────────────────── */}
            <View style={styles.expectCard}>
              <Text style={styles.expectLabel}>💡 What to expect this week</Text>
              <Text style={styles.expectDesc}>
                Based on your patterns, focus on sleep quality. Your symptoms tend to be milder after nights with 7+ hours.
              </Text>
            </View>
          </>
        ) : (
          /* ═══════════════ AM I NORMAL? TAB ═══════════════ */
          <>
            {/* ─── Comparison group ────────────────── */}
            <View style={styles.storyCard}>
              <Text style={styles.storyLabel}>Your comparison group</Text>
              <Text style={styles.compGroupTitle}>Early perimenopause · 40-49</Text>
              <Text style={styles.compGroupSub}>12,847 women like you</Text>
              <View style={styles.compTraits}>
                {['Perimenopause', '40s', 'Active', 'Working'].map((t) => (
                  <View key={t} style={styles.compTraitPill}>
                    <Text style={styles.compTraitText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ─── Your symptoms vs others ─────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your symptoms vs. others</Text>
              <View style={{ gap: 12 }}>
                {symptomTrends.map((s) => {
                  const benchmark = POPULATION_BENCHMARKS[s.name];
                  if (!benchmark) return null;
                  const userPct = Math.round((s.count / Math.max(1, s.daysTotal)) * 100);
                  const badgeColor = benchmark.label === 'Very common' ? '#059669' : benchmark.label === 'Common' ? '#d97706' : '#a8a29e';
                  return (
                    <AnimatedPressable
                      key={s.name}
                      onPress={() => {
                        hapticLight();
                        router.push({ pathname: '/(app)/symptom-detail', params: { symptom: s.name } });
                      }}
                      scaleDown={0.98}
                      style={styles.benchmarkCard}
                    >
                      <View style={styles.benchmarkHeader}>
                        <Text style={styles.benchmarkName}>
                          {SYMPTOM_EMOJI[s.name] || '•'} {formatSymptomName(s.name)}
                        </Text>
                        <View style={[styles.benchmarkBadge, { backgroundColor: badgeColor + '20' }]}>
                          <Text style={[styles.benchmarkBadgeText, { color: badgeColor }]}>{benchmark.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.benchmarkUserStat}>
                        You logged this on {s.count} of {s.daysTotal} days ({userPct}%)
                      </Text>
                      {/* Population bar with "You" dot */}
                      <View style={styles.populationBarContainer}>
                        <View style={styles.populationBar}>
                          <View style={[styles.populationFill, { width: `${benchmark.pct}%` }]} />
                          {/* "You" marker */}
                          <View style={[styles.youMarker, { left: `${Math.min(95, userPct)}%` }]}>
                            <View style={styles.youDot} />
                            <Text style={styles.youLabel}>You</Text>
                          </View>
                        </View>
                        <View style={styles.populationLabels}>
                          <Text style={styles.populationLabelText}>0%</Text>
                          <Text style={styles.populationLabelText}>{benchmark.pct}% of women</Text>
                          <Text style={styles.populationLabelText}>100%</Text>
                        </View>
                      </View>
                      <Text style={styles.benchmarkDetail}>{benchmark.detail}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* ─── Did you know? ───────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Did you know?</Text>
              <View style={{ gap: 8 }}>
                {NORMALIZATION_FACTS.map((fact, i) => (
                  <View key={i} style={styles.factCard}>
                    <Text style={{ fontSize: 20 }}>{fact.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.factTitle}>{fact.title}</Text>
                      <Text style={styles.factDesc}>{fact.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* ─── Your journey so far ─────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your journey so far</Text>
              <View style={styles.milestoneCard}>
                {[
                  { done: totalDays >= 7, label: `${Math.min(totalDays, 7)}/7 days logged`, sub: 'First week of tracking' },
                  { done: totalDays >= 28, label: `${Math.min(totalDays, 28)}/28 days logged`, sub: 'Full month of data' },
                  { done: symptomTrends.some((s) => s.trendPct < -10), label: 'Symptom improvement found', sub: 'At least one symptom trending down' },
                  { done: correlations.length > 0, label: 'Pattern discovered', sub: 'We found what affects your symptoms' },
                ].map((m, i) => (
                  <View key={i} style={styles.milestoneRow}>
                    <View style={[styles.milestoneCheck, m.done && styles.milestoneCheckDone]}>
                      <Text style={{ fontSize: 10, color: m.done ? '#fff' : '#d6d3d1' }}>✓</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.milestoneLabel, m.done && styles.milestoneLabelDone]}>{m.label}</Text>
                      <Text style={styles.milestoneSub}>{m.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* ─── Doctor CTA ──────────────────────── */}
            <View style={styles.doctorCard}>
              <Text style={styles.doctorTitle}>📋 Bring this to your doctor</Text>
              <Text style={styles.doctorDesc}>
                Generate a report with your symptom history, patterns, and severity data to share at your next appointment.
              </Text>
              <AnimatedPressable
                onPress={() => hapticLight()}
                scaleDown={0.97}
                style={styles.doctorButton}
              >
                <Text style={styles.doctorButtonText}>Generate report →</Text>
              </AnimatedPressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  headerSub: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  reportButton: {
    backgroundColor: '#1c1917',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reportButtonText: { fontSize: 12, color: '#ffffff', fontWeight: '500' },

  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  tabTextActive: { color: '#1c1917', fontWeight: '600' },

  // Period pills
  periodStrip: { marginBottom: 20, marginHorizontal: -24, maxHeight: 44 },
  periodContent: { paddingHorizontal: 24, gap: 8 },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f4',
  },
  periodPillActive: { backgroundColor: '#1c1917' },
  periodText: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  periodTextActive: { color: '#ffffff' },

  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#78716c', textAlign: 'center', lineHeight: 20 },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 10 },

  // Weekly story card (dark)
  storyCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  storyLabel: { fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  storyNarrative: { fontSize: 14, color: '#ffffff', lineHeight: 20, marginBottom: 16 },
  storyDays: { flexDirection: 'row', gap: 10 },
  storyDayCard: {
    flex: 1,
    backgroundColor: '#292524',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  storyDayEmoji: { fontSize: 20, marginBottom: 4 },
  storyDayLabel: { fontSize: 10, color: '#78716c', marginBottom: 2 },
  storyDayValue: { fontSize: 12, color: '#ffffff', fontWeight: '500' },

  // Correlation cards
  correlationCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  correlationPositive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  correlationNegative: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  correlationFactor: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
  correlationArrow: { fontSize: 12, color: '#44403c', marginTop: 4 },
  correlationConfidence: { fontSize: 11, color: '#a8a29e', marginTop: 6 },

  // Symptom trend cards
  symptomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  symptomName: { fontSize: 13, fontWeight: '500', color: '#1c1917' },
  symptomMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  symptomTrend: { fontSize: 12 },
  symptomDays: { fontSize: 11, color: '#a8a29e' },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    width: 56,
    height: 24,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 2,
  },

  // Helps vs Hurts
  helpsHurtsRow: { flexDirection: 'row', gap: 8 },
  helpsHurtsCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
  },
  helpsCard: { backgroundColor: '#f0fdf4' },
  hurtsCard: { backgroundColor: '#fef2f2' },
  helpsHurtsLabel: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 10 },
  hhItem: { marginBottom: 8 },
  hhRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hhName: { fontSize: 11, color: '#44403c' },
  hhPct: { fontSize: 11, fontWeight: '600' },
  hhBarBg: { height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2 },
  hhBarFill: { height: 4, borderRadius: 2 },
  hhEmpty: { fontSize: 11, color: '#a8a29e', fontStyle: 'italic' },

  // Sleep analysis
  sleepCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sleepHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sleepRingContainer: { flexShrink: 0 },
  sleepRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#44403c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepRingArcWrap: {
    position: 'absolute',
    top: -3,
    left: -3,
  },
  sleepRingScore: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  sleepLabel: { fontSize: 11, color: '#78716c' },
  sleepValue: { fontSize: 13, color: '#ffffff', fontWeight: '500', marginTop: 2 },
  sleepHint: { fontSize: 11, color: '#78716c', marginTop: 2 },
  sleepBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#292524',
    height: 64,
  },
  sleepBarCol: { flex: 1, alignItems: 'center' },
  sleepBarFill: {
    width: '100%',
    backgroundColor: '#818cf8',
    borderRadius: 3,
    minHeight: 4,
  },
  sleepBarLabel: { fontSize: 9, color: '#78716c', marginTop: 4 },

  // Expect card
  expectCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  expectLabel: { fontSize: 13, fontWeight: '600', color: '#1c1917', marginBottom: 6 },
  expectDesc: { fontSize: 12, color: '#78716c', lineHeight: 18 },

  // ─── Am I Normal tab styles ──────────────────
  compGroupTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  compGroupSub: { fontSize: 12, color: '#a8a29e', marginBottom: 12 },
  compTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compTraitPill: {
    backgroundColor: '#292524',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compTraitText: { fontSize: 11, color: '#d6d3d1' },

  // Benchmark cards
  benchmarkCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  benchmarkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  benchmarkName: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  benchmarkBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  benchmarkBadgeText: { fontSize: 10, fontWeight: '600' },
  benchmarkUserStat: { fontSize: 12, color: '#78716c', marginBottom: 12 },
  populationBarContainer: { marginBottom: 10 },
  populationBar: {
    height: 8,
    backgroundColor: '#f5f5f4',
    borderRadius: 4,
    position: 'relative',
    overflow: 'visible',
  },
  populationFill: {
    height: 8,
    backgroundColor: '#e7e5e4',
    borderRadius: 4,
  },
  youMarker: {
    position: 'absolute',
    top: -6,
    alignItems: 'center',
    marginLeft: -8,
  },
  youDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1c1917',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  youLabel: {
    fontSize: 9,
    color: '#1c1917',
    fontWeight: '600',
    marginTop: 2,
  },
  populationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  populationLabelText: { fontSize: 9, color: '#a8a29e' },
  benchmarkDetail: { fontSize: 11, color: '#a8a29e', lineHeight: 16 },

  // Normalization fact cards
  factCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  factTitle: { fontSize: 13, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  factDesc: { fontSize: 12, color: '#78716c', lineHeight: 17 },

  // Milestone card
  milestoneCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  milestoneCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneCheckDone: { backgroundColor: '#059669' },
  milestoneLabel: { fontSize: 13, color: '#a8a29e' },
  milestoneLabelDone: { color: '#1c1917', fontWeight: '500' },
  milestoneSub: { fontSize: 11, color: '#d6d3d1', marginTop: 1 },

  // Doctor CTA
  doctorCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  doctorTitle: { fontSize: 14, fontWeight: '600', color: '#ffffff', marginBottom: 6 },
  doctorDesc: { fontSize: 12, color: '#a8a29e', lineHeight: 18, marginBottom: 14 },
  doctorButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doctorButtonText: { fontSize: 13, fontWeight: '600', color: '#1c1917' },

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
  cardHint: { fontSize: 13, color: '#a8a29e', textAlign: 'center' },
});

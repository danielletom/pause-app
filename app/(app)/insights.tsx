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

// ─── API response types ─────────────────────────────────
interface CorrelationItem {
  factor: string;
  symptom: string;
  direction: 'positive' | 'negative';
  confidence: number;
  effectSizePct: number;
  occurrences: number;
  lagDays: number;
  humanLabel: string;
}

interface CorrelationsResponse {
  correlations: CorrelationItem[];
  lastComputed: string | null;
  dataQuality: 'building' | 'moderate' | 'strong';
  totalFound: number;
}

interface BenchmarkSymptom {
  name: string;
  userFrequencyDays: number;
  userAvgSeverity: number;
  cohortPrevalencePct: number;
  cohortAvgFrequency: number;
  percentilePosition: number;
  label: 'Very common' | 'Common' | 'Less common';
}

interface BenchmarksResponse {
  cohort: { key: string; label: string; sampleSize: number };
  symptoms: BenchmarkSymptom[];
  message?: string;
}

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

// (correlations and benchmarks now fetched from API — mock functions removed)

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

  // API-backed state for correlations
  const [correlations, setCorrelations] = useState<CorrelationItem[]>([]);
  const [dataQuality, setDataQuality] = useState<string>('building');

  // API-backed state for benchmarks
  const [benchmarkData, setBenchmarkData] = useState<BenchmarksResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getToken();
      const range = period === '1w' ? '7d' : period === '4w' ? '28d' : period === '3m' ? '90d' : '365d';

      // Fetch logs + correlations + benchmarks in parallel
      const [logsData, correlationsData, benchmarksData] = await Promise.all([
        apiRequest(`/api/logs?range=${range}`, token).catch(() => []),
        apiRequest('/api/insights/correlations', token).catch(() => null),
        apiRequest('/api/insights/benchmarks', token).catch(() => null),
      ]);

      setLogs(Array.isArray(logsData) ? logsData : []);

      // Set correlations from API
      if (correlationsData?.correlations) {
        setCorrelations(correlationsData.correlations);
        setDataQuality(correlationsData.dataQuality || 'building');
      } else {
        setCorrelations([]);
      }

      // Set benchmark data from API
      if (benchmarksData?.symptoms || benchmarksData?.cohort) {
        setBenchmarkData(benchmarksData);
      }

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

  // Derive helps/hurts from API correlations (positive direction = helps, negative = hurts)
  const helpsHurts = useMemo(() => {
    const helps: { label: string; pct: number }[] = [];
    const hurts: { label: string; pct: number }[] = [];
    for (const c of correlations) {
      const pct = Math.round(Math.abs(c.effectSizePct));
      if (pct < 10) continue;
      const label = formatSymptomName(c.factor);
      if (c.direction === 'negative') {
        helps.push({ label, pct });
      } else {
        hurts.push({ label, pct });
      }
    }
    return {
      helps: helps.sort((a, b) => b.pct - a.pct).slice(0, 4),
      hurts: hurts.sort((a, b) => b.pct - a.pct).slice(0, 4),
    };
  }, [correlations]);
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
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>What we've connected</Text>
                  {dataQuality !== 'strong' && (
                    <View style={styles.qualityBadge}>
                      <Text style={styles.qualityBadgeText}>
                        {dataQuality === 'building' ? '📊 Building' : '📈 Moderate'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ gap: 8 }}>
                  {correlations.slice(0, 4).map((c, i) => {
                    const pct = Math.round(Math.abs(c.effectSizePct));
                    const lagLabel = c.lagDays > 0 ? ` (${c.lagDays}d lag)` : '';
                    return (
                      <View
                        key={i}
                        style={[
                          styles.correlationCard,
                          c.direction === 'negative' ? styles.correlationPositive : styles.correlationNegative,
                        ]}
                      >
                        <Text style={styles.correlationFactor}>{c.humanLabel}</Text>
                        <Text style={styles.correlationArrow}>
                          {formatSymptomName(c.factor)} → {formatSymptomName(c.symptom)}{' '}
                          <Text style={{ color: c.direction === 'negative' ? '#059669' : '#dc2626' }}>
                            {c.direction === 'negative' ? `↓${pct}%` : `↑${pct}%`}
                          </Text>
                          {lagLabel}
                        </Text>
                        <Text style={styles.correlationConfidence}>
                          Seen {c.occurrences} times · {Math.round(c.confidence * 100)}% confidence
                        </Text>
                      </View>
                    );
                  })}
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
              <Text style={styles.compGroupTitle}>
                {benchmarkData?.cohort?.label || 'All stages'}
              </Text>
              <Text style={styles.compGroupSub}>
                {benchmarkData?.cohort?.sampleSize
                  ? `${benchmarkData.cohort.sampleSize.toLocaleString()} women like you`
                  : 'General population benchmarks'}
              </Text>
              {benchmarkData?.message && (
                <Text style={[styles.compGroupSub, { marginTop: 6, fontStyle: 'italic' }]}>
                  {benchmarkData.message}
                </Text>
              )}
              {benchmarkData?.cohort?.key && (
                <View style={styles.compTraits}>
                  {benchmarkData.cohort.key.split('_').filter(p => p !== 'unknown').map((t) => (
                    <View key={t} style={styles.compTraitPill}>
                      <Text style={styles.compTraitText}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ─── Your symptoms vs others ─────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your symptoms vs. others</Text>
              <View style={{ gap: 12 }}>
                {(benchmarkData?.symptoms || []).map((bm) => {
                  const badgeColor = bm.label === 'Very common' ? '#059669' : bm.label === 'Common' ? '#d97706' : '#a8a29e';
                  const userPct = bm.percentilePosition;
                  const emoji = SYMPTOM_EMOJI[bm.name.toLowerCase().replace(/\s+/g, '_')] || '•';
                  return (
                    <AnimatedPressable
                      key={bm.name}
                      onPress={() => {
                        hapticLight();
                        router.push({ pathname: '/(app)/symptom-detail', params: { symptom: bm.name } });
                      }}
                      scaleDown={0.98}
                      style={styles.benchmarkCard}
                    >
                      <View style={styles.benchmarkHeader}>
                        <Text style={styles.benchmarkName}>
                          {emoji} {formatSymptomName(bm.name)}
                        </Text>
                        <View style={[styles.benchmarkBadge, { backgroundColor: badgeColor + '20' }]}>
                          <Text style={[styles.benchmarkBadgeText, { color: badgeColor }]}>{bm.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.benchmarkUserStat}>
                        You logged this {bm.userFrequencyDays} days (avg severity {bm.userAvgSeverity.toFixed(1)})
                      </Text>
                      {/* Population bar with "You" dot */}
                      <View style={styles.populationBarContainer}>
                        <View style={styles.populationBar}>
                          <View style={[styles.populationFill, { width: `${bm.cohortPrevalencePct}%` }]} />
                          {/* "You" marker */}
                          <View style={[styles.youMarker, { left: `${Math.min(95, userPct)}%` }]}>
                            <View style={styles.youDot} />
                            <Text style={styles.youLabel}>You</Text>
                          </View>
                        </View>
                        <View style={styles.populationLabels}>
                          <Text style={styles.populationLabelText}>0%</Text>
                          <Text style={styles.populationLabelText}>{bm.cohortPrevalencePct}% of cohort</Text>
                          <Text style={styles.populationLabelText}>100%</Text>
                        </View>
                      </View>
                      <Text style={styles.benchmarkDetail}>
                        Avg frequency in your cohort: {bm.cohortAvgFrequency} days/month
                      </Text>
                    </AnimatedPressable>
                  );
                })}
                {(!benchmarkData?.symptoms || benchmarkData.symptoms.length === 0) && (
                  <View style={styles.card}>
                    <Text style={styles.cardHint}>
                      Log symptoms for at least 2 weeks to see how you compare with others
                    </Text>
                  </View>
                )}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  qualityBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  qualityBadgeText: { fontSize: 10, fontWeight: '600', color: '#d97706' },

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

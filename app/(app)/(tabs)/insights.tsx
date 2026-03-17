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
import { getTrialDay, isTrialExpired } from '@/lib/trial';
import { useProfile } from '@/lib/useProfile';
import { useSubscription } from '@/lib/useSubscription';
import { useDelight, DELIGHT_KEYS } from '@/lib/delight-context';

// ─── Constants ──────────────────────────────────────────
const TABS = [
  { key: 'patterns', label: 'My patterns' },
  { key: 'normal', label: 'Am I normal?' },
];

const SYMPTOM_EMOJI: Record<string, string> = {
  hot_flash: '🔥', brain_fog: '😶‍🌫️', irritability: '😤', joint_pain: '💪',
  anxiety: '😰', fatigue: '😩', nausea: '🤢', heart_racing: '💓',
  night_sweats: '🌊', headache: '🤕', mood_swings: '🎭', insomnia: '😴',
};

// Map benchmark display names → log key (for navigation to symptom-detail)
const DISPLAY_TO_KEY: Record<string, string> = {
  'hot flashes': 'hot_flash',
  'night sweats': 'night_sweats',
  'joint pain': 'joint_pain',
  'brain fog': 'brain_fog',
  'mood changes': 'mood_swings',
  'sleep disruption': 'insomnia',
  'headaches': 'headache',
  'heart palpitations': 'heart_racing',
  'fatigue': 'fatigue',
  'anxiety': 'anxiety',
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
  // Pipeline enrichments (optional — present when AI pipeline has run)
  explanation?: string;
  recommendation?: string;
  mechanism?: string;
  caveat?: string;
}

interface PipelineHelpsHurtsEntry {
  factor: string;
  symptom: string;
  explanation: string;
  strength: number;
}

interface ContradictionEntry {
  factor: string;
  helpsSymptom: string;
  hurtsSymptom: string;
  explanation: string;
}

interface CorrelationsResponse {
  correlations: CorrelationItem[];
  lastComputed: string | null;
  dataQuality: 'building' | 'moderate' | 'strong';
  // Pipeline enrichments (optional)
  helpsHurts?: {
    helps: PipelineHelpsHurtsEntry[];
    hurts: PipelineHelpsHurtsEntry[];
  };
  contradictions?: ContradictionEntry[];
  weeklyStory?: string;
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
  { emoji: '🧠', title: 'Brain fog is hormonal', desc: "Estrogen changes affect memory and focus directly. It is not \"just stress\" — your brain is adapting to a new normal." },
  { emoji: '💓', title: 'Heart pounding is hormonal', desc: "That racing heart feeling? Estrogen shifts can do that. It is more common than most women realise." },
  { emoji: '📊', title: 'Often missed by doctors', desc: "73% of women experience perimenopause symptoms, but only 1 in 4 get the right diagnosis first time." },
  { emoji: '💪', title: 'Joint pain is real', desc: "Estrogen helps protect joints. As levels shift, inflammation can increase. This is hormonal, not just ageing." },
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
  // Strip "Med " or "med_" prefix from factor names (e.g. "Med Vitamin D" → "Vitamin D")
  let cleaned = name.replace(/^Med\s+/i, '').replace(/^med_/i, '');
  return cleaned.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function strengthLabel(pct: number): string {
  if (pct >= 35) return 'Strong link';
  if (pct >= 15) return 'Moderate';
  return 'Weak signal';
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
      narrative = `${name} dropped ${drop}% compared to last week.`;
    } else if (daysWithIt >= 5) {
      narrative = `${name} showed up ${daysWithIt} of 7 days this week. Worth watching.`;
    } else {
      narrative = `${name} appeared ${daysWithIt} time${daysWithIt === 1 ? '' : 's'} this week.`;
    }
  }

  if (goodSleepDays >= 5) {
    narrative += ` Sleep was solid — 7+ hours on ${goodSleepDays} nights.`;
  } else if (goodSleepDays <= 2) {
    narrative += ` Sleep was rough this week — only ${goodSleepDays} nights over 7 hours.`;
  }

  return {
    narrative,
    bestDay: bestDay ? new Date(bestDay.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }) : null,
    worstDay: worstDay ? new Date(worstDay.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }) : null,
    bestMood: bestDay?.mood ?? 3,
    worstMood: worstDay?.mood ?? 3,
  };
}

// ─── Main Component ─────────────────────────────────────

export default function InsightsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ symptom?: string }>();
  const { profile } = useProfile();
  const { isPaid } = useSubscription();
  const { hasSeen, markSeen } = useDelight();
  const trialDay = getTrialDay(profile?.createdAt);
  const trialExpired = isTrialExpired(profile?.createdAt, isPaid);
  const [activeTab, setActiveTab] = useState<'patterns' | 'normal'>('patterns');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const maxDaysEver = useRef(0);

  // API-backed state for correlations
  const [correlations, setCorrelations] = useState<CorrelationItem[]>([]);
  const [dataQuality, setDataQuality] = useState<string>('building');
  const [lastComputed, setLastComputed] = useState<string | null>(null);
  // Pipeline enrichments from naturopath agent
  const [pipelineHelpsHurts, setPipelineHelpsHurts] = useState<CorrelationsResponse['helpsHurts'] | null>(null);
  const [contradictions, setContradictions] = useState<ContradictionEntry[]>([]);
  const [pipelineWeeklyStory, setPipelineWeeklyStory] = useState<string | null>(null);

  // API-backed state for benchmarks
  const [benchmarkData, setBenchmarkData] = useState<BenchmarksResponse | null>(null);

  // Today's check-in status (for "While we're learning" section)
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getToken();
      const range = '90d';

      const todayDate = new Date().toISOString().split('T')[0];

      // Fetch logs + correlations + benchmarks + today's logs in parallel
      const [logsData, correlationsData, benchmarksData, todayLogs] = await Promise.all([
        apiRequest(`/api/logs?range=${range}`, token).catch(() => []),
        apiRequest('/api/insights/correlations', token).catch(() => null),
        apiRequest('/api/insights/benchmarks', token).catch(() => null),
        apiRequest(`/api/logs?date=${todayDate}`, token).catch(() => []),
      ]);

      const parsedLogs = Array.isArray(logsData) ? logsData : [];
      setLogs(parsedLogs);

      // Track max unique days ever seen (so learning state doesn't regress on short periods)
      const uniqueDateCount = new Set(parsedLogs.map((l: any) => l.date)).size;
      if (uniqueDateCount > maxDaysEver.current) maxDaysEver.current = uniqueDateCount;

      // Check today's morning/evening status
      const todayEntries = Array.isArray(todayLogs) ? todayLogs : [];
      setMorningDone(todayEntries.some((e: any) => e.logType === 'morning'));
      setEveningDone(todayEntries.some((e: any) => e.logType === 'evening'));

      // Set correlations from API
      if (correlationsData?.correlations) {
        setCorrelations(correlationsData.correlations);
        setDataQuality(correlationsData.dataQuality || 'building');
        setLastComputed(correlationsData.lastComputed ?? null);
        // Pipeline enrichments (optional)
        setPipelineHelpsHurts(correlationsData.helpsHurts ?? null);
        setContradictions(correlationsData.contradictions ?? []);
        setPipelineWeeklyStory(correlationsData.weeklyStory ?? null);
      } else {
        setCorrelations([]);
        setPipelineHelpsHurts(null);
        setContradictions([]);
        setPipelineWeeklyStory(null);
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
  }, [getToken]);

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

  // Derive helps/hurts with separated factor/symptom for new card design
  interface HHEntry {
    factorName: string;
    symptomName: string;
    pct: number;
    key: string;
    explanation?: string;
    recommendation?: string;
    lagDays?: number;
    strength: string;
  }

  const helpsHurts = useMemo(() => {
    // Prefer AI-enriched pipeline data when available
    if (pipelineHelpsHurts) {
      return {
        helps: pipelineHelpsHurts.helps.map((h) => ({
          factorName: formatSymptomName(h.factor),
          symptomName: formatSymptomName(h.symptom),
          pct: Math.round(h.strength),
          key: `${h.factor}_${h.symptom}`,
          explanation: h.explanation,
          strength: strengthLabel(Math.round(h.strength)),
        })).slice(0, 4) as HHEntry[],
        hurts: pipelineHelpsHurts.hurts.map((h) => ({
          factorName: formatSymptomName(h.factor),
          symptomName: formatSymptomName(h.symptom),
          pct: Math.round(h.strength),
          key: `${h.factor}_${h.symptom}`,
          explanation: h.explanation,
          strength: strengthLabel(Math.round(h.strength)),
        })).slice(0, 4) as HHEntry[],
      };
    }
    // Fallback: derive from raw correlations
    const bestHelps = new Map<string, HHEntry>();
    const bestHurts = new Map<string, HHEntry>();
    for (const c of correlations) {
      const pct = Math.round(Math.abs(c.effectSizePct));
      if (pct < 10) continue;
      const entry: HHEntry = {
        factorName: formatSymptomName(c.factor),
        symptomName: formatSymptomName(c.symptom),
        pct,
        key: `${c.factor}_${c.symptom}`,
        explanation: c.explanation,
        recommendation: c.recommendation,
        lagDays: c.lagDays,
        strength: strengthLabel(pct),
      };
      if (c.direction === 'negative') {
        const existing = bestHelps.get(c.factor);
        if (!existing || pct > existing.pct) bestHelps.set(c.factor, entry);
      } else {
        const existing = bestHurts.get(c.factor);
        if (!existing || pct > existing.pct) bestHurts.set(c.factor, entry);
      }
    }
    return {
      helps: [...bestHelps.values()].sort((a, b) => b.pct - a.pct).slice(0, 4),
      hurts: [...bestHurts.values()].sort((a, b) => b.pct - a.pct).slice(0, 4),
    };
  }, [correlations, pipelineHelpsHurts]);
  const sleepData = useMemo(() => computeSleepScore(logs), [logs]);
  const weeklyStory = useMemo(() => computeWeeklyStory(logs), [logs]);

  // Dynamic "Looking ahead" text derived from actual correlations
  const lookingAheadText = useMemo(() => {
    if (correlations.length === 0) {
      return 'Keep logging and we will start showing you personalised insights about what helps your symptoms.';
    }

    // Find the strongest "helps" correlation (direction === 'negative')
    const helps = correlations
      .filter((c) => c.direction === 'negative')
      .sort((a, b) => Math.abs(b.effectSizePct) - Math.abs(a.effectSizePct));

    if (helps.length > 0) {
      const best = helps[0];
      const factorLabel = formatSymptomName(best.factor).toLowerCase();
      const symptomLabel = formatSymptomName(best.symptom).toLowerCase();
      const pct = Math.round(Math.abs(best.effectSizePct));
      return `On days when you have ${factorLabel}, ${symptomLabel} drops by ${pct}%. Worth trying this week.`;
    }

    // Fallback: strongest "hurts" correlation
    const hurts = correlations
      .filter((c) => c.direction === 'positive')
      .sort((a, b) => Math.abs(b.effectSizePct) - Math.abs(a.effectSizePct));

    if (hurts.length > 0) {
      const worst = hurts[0];
      const factorLabel = formatSymptomName(worst.factor).toLowerCase();
      const symptomLabel = formatSymptomName(worst.symptom).toLowerCase();
      return `Your data shows ${factorLabel} tends to increase ${symptomLabel}. Something to watch.`;
    }

    return 'Keep logging and we will start showing personalised insights here.';
  }, [correlations]);

  const hasData = logs.length > 0;
  // Unique days with at least one log
  const uniqueDays = useMemo(() => {
    const dates = new Set(logs.map((l) => l.date));
    return dates.size;
  }, [logs]);
  const totalDays = uniqueDays;

  // Which days of the week have logs (for learning state dots)
  const loggedDayFlags = useMemo(() => {
    if (totalDays === 0) return [];
    const today = new Date();
    const flags: { dayLetter: string; logged: boolean }[] = [];
    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const dates = new Set(logs.map((l) => l.date));
    // Look at last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      flags.push({ dayLetter: dayLetters[d.getDay()], logged: dates.has(dateStr) });
    }
    return flags;
  }, [logs, totalDays]);

  // Early symptom summary for learning states
  const earlySymptomSummary = useMemo(() => {
    if (totalDays === 0) return [];
    const merged: Record<string, { count: number; severities: number[] }> = {};
    const dates = new Set<string>();
    logs.forEach((log) => {
      dates.add(log.date);
      if (log.symptomsJson) {
        Object.entries(log.symptomsJson).forEach(([k, v]) => {
          if (!merged[k]) merged[k] = { count: 0, severities: [] };
          merged[k].count += 1;
          merged[k].severities.push(v as number);
        });
      }
    });
    return Object.entries(merged)
      .map(([name, data]) => ({
        name,
        displayName: formatSymptomName(name),
        emoji: SYMPTOM_EMOJI[name] || '•',
        daysLogged: data.count,
        severities: data.severities.slice(0, 7), // last 7 entries max
      }))
      .sort((a, b) => b.daysLogged - a.daysLogged)
      .slice(0, 4);
  }, [logs, totalDays]);

  // Early signal text for learning state
  const earlySignalText = useMemo(() => {
    if (totalDays < 2) return null;
    const topSymptom = earlySymptomSummary[0];
    if (!topSymptom) return null;
    const shortSleepDays = logs.filter((l) => (l.sleepHours ?? 8) < 6).length;
    let text = `${topSymptom.displayName} showed up on ${topSymptom.daysLogged} of ${totalDays} days`;
    if (shortSleepDays > 0) {
      text += `, and you slept under 6 hours ${shortSleepDays} time${shortSleepDays > 1 ? 's' : ''}`;
    }
    text += '. We are looking for a connection. A few more days and we should know.';
    return text;
  }, [totalDays, earlySymptomSummary, logs]);

  // Total check-ins and unique symptoms (for journey stats)
  const totalCheckins = logs.length;
  const uniqueSymptomCount = useMemo(() => {
    const symptoms = new Set<string>();
    logs.forEach((l) => {
      if (l.symptomsJson) Object.keys(l.symptomsJson).forEach((s) => symptoms.add(s));
    });
    return symptoms.size;
  }, [logs]);

  // Learning state thresholds — use maxDaysEver so switching to 1W doesn't regress
  const patternsLearning = maxDaysEver.current < 7;
  const normalLearning = maxDaysEver.current < 7;

  const headerSub = activeTab === 'normal' && normalLearning
    ? `Day ${totalDays} of 7 to first insights`
    : totalDays > 0
      ? patternsLearning
        ? `${totalDays} days logged. Still learning your patterns.`
        : dataQuality === 'strong'
          ? `${totalDays} days of data. Strong insights.`
          : dataQuality === 'moderate'
            ? `${totalDays} days of data. Patterns emerging.`
            : `${totalDays} days of data. Insights updated daily.`
      : 'Log a few days and your patterns will start appearing here.';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Why you feel this way</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={styles.headerSub}>{headerSub}</Text>
              {!patternsLearning && activeTab === 'patterns' && (
                <View style={{
                  backgroundColor: dataQuality === 'strong' ? '#dcfce7' : dataQuality === 'moderate' ? '#fef9c3' : '#f1f5f9',
                  borderRadius: 99,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}>
                  <Text style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: dataQuality === 'strong' ? '#166534' : dataQuality === 'moderate' ? '#854d0e' : '#64748b',
                  }}>
                    {dataQuality === 'strong' ? '● Strong' : dataQuality === 'moderate' ? '● Moderate' : '● Building'}
                  </Text>
                </View>
              )}
            </View>
            {lastComputed && !patternsLearning && activeTab === 'patterns' && (
              <Text style={{ fontSize: 11, color: '#a8a29e', marginTop: 2 }}>
                Updated {(() => {
                  const diff = Date.now() - new Date(lastComputed).getTime();
                  const hrs = Math.floor(diff / 3600000);
                  if (hrs < 1) return 'just now';
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })()}
              </Text>
            )}
          </View>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            const isNormalTab = tab.key === 'normal';
            const normalLocked = false;
            const showNewBadge = isNormalTab && !normalLearning && !hasSeen(DELIGHT_KEYS.DAY14_NORMAL_UNLOCK);
            return (
              <AnimatedPressable
                key={tab.key}
                onPress={() => {
                  if (normalLocked) return;
                  hapticSelection();
                  setActiveTab(tab.key as 'patterns' | 'normal');
                  if (showNewBadge) markSeen(DELIGHT_KEYS.DAY14_NORMAL_UNLOCK);
                }}
                scaleDown={0.97}
                style={[styles.tab, active && styles.tabActive, normalLocked && { opacity: 0.5 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                  {showNewBadge && (
                    <View style={{ backgroundColor: '#818cf8', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 8, fontWeight: '700', color: '#ffffff' }}>New</Text>
                    </View>
                  )}
                  {normalLocked && <Text style={{ fontSize: 10, color: '#a8a29e' }}>🔒</Text>}
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Content — always show data, overlay paywall if expired */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : !hasData || (activeTab === 'patterns' && patternsLearning) ? (
          /* ═══════════════ MY PATTERNS — LEARNING STATE ═══════════════ */
          <>
            {/* ─── Learning mode hero ────────────── */}
            <View style={ls.heroCard}>
              {/* Circular progress ring */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={ls.progressRingWrap}>
                  <Svg width={96} height={96} viewBox="0 0 96 96">
                    <Circle cx={48} cy={48} r={44} fill="none" stroke="#292524" strokeWidth={3} />
                    <Circle
                      cx={48} cy={48} r={44}
                      fill="none"
                      stroke="#2dd4bf"
                      strokeWidth={3}
                      strokeDasharray={`${(totalDays / 7) * 276} ${276 - (totalDays / 7) * 276}`}
                      strokeLinecap="round"
                      transform="rotate(-90 48 48)"
                    />
                  </Svg>
                  <View style={ls.progressRingInner}>
                    <Text style={ls.progressRingNumber}>{totalDays}</Text>
                    <Text style={ls.progressRingOf}>of 7</Text>
                  </View>
                </View>
              </View>
              <Text style={ls.heroTitle}>{totalDays === 0 ? 'Your insights start here' : 'Your patterns are building'}</Text>
              <Text style={ls.heroDesc}>
                {totalDays === 0
                  ? 'Complete your first morning check-in and we\'ll start learning your patterns. After 7 days, your personalised insights unlock.'
                  : `${7 - totalDays} more day${7 - totalDays > 1 ? 's' : ''} and we can start showing you what affects your symptoms, sleep, and mood.`}
              </Text>

              {/* Day progress dots — Day 1 starts at first circle */}
              <View style={ls.dayDotsRow}>
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                  const isCompleted = dayNum <= totalDays;
                  return (
                    <View key={dayNum} style={ls.dayDotCol}>
                      <View style={[
                        ls.dayDot,
                        isCompleted ? ls.dayDotFilled : ls.dayDotEmpty,
                      ]}>
                        <Text style={[ls.dayDotText, isCompleted && ls.dayDotTextFilled]}>
                          {isCompleted ? '✓' : dayNum}
                        </Text>
                      </View>
                      <Text style={ls.dayDotLetter}>Day {dayNum}</Text>
                    </View>
                  );
                })}
              </View>

              {totalDays >= 4 && (
                <Text style={ls.heroEncouragement}>Over halfway. The picture is getting clearer.</Text>
              )}
            </View>

            {/* ─── What we'll show you (blurred previews) ─── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What we'll show you</Text>

              {/* This Week's Story — blurred preview */}
              <View style={ls.blurredCard}>
                <View style={ls.blurOverlay}>
                  <View style={ls.lockCircle}>
                    <Text style={{ fontSize: 14 }}>🔒</Text>
                  </View>
                  <Text style={ls.blurOverlayText}>Unlocks in {7 - totalDays} days</Text>
                </View>
                <Text style={ls.blurLabel}>THIS WEEK'S STORY</Text>
                <Text style={ls.blurContent}>Your hot flashes dropped 23% this week. The biggest factor? You slept 7+ hours on 5 of 7 nights...</Text>
              </View>

              {/* Cause & Effect — blurred preview */}
              <View style={[ls.blurredCard, { marginTop: 8 }]}>
                <View style={ls.blurOverlay}>
                  <Text style={ls.blurOverlayText}>Connections found after 7 days</Text>
                </View>
                <Text style={[ls.blurLabel, { fontWeight: '600' }]}>Sleep → Hot flashes</Text>
                <Text style={ls.blurContent}>After nights with 7+ hours of sleep, your next-day hot flash severity drops by 41%.</Text>
                <View style={ls.blurBar}>
                  <View style={[ls.blurBarFill, { width: '75%' }]} />
                </View>
              </View>

              {/* Helps vs Hurts — blurred preview */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={[ls.blurredCardSmall, { flex: 1 }]}>
                  <View style={ls.blurOverlay} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#047857', marginBottom: 8 }}>Helps ↓</Text>
                  <View style={ls.blurBar}><View style={[ls.blurBarFillGreen, { width: '75%' }]} /></View>
                  <View style={[ls.blurBar, { marginTop: 4 }]}><View style={[ls.blurBarFillGreen, { width: '50%' }]} /></View>
                  <View style={[ls.blurBar, { marginTop: 4 }]}><View style={[ls.blurBarFillGreen, { width: '33%' }]} /></View>
                </View>
                <View style={[ls.blurredCardSmall, { flex: 1 }]}>
                  <View style={ls.blurOverlay} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#be123c', marginBottom: 8 }}>Hurts ↑</Text>
                  <View style={ls.blurBar}><View style={[ls.blurBarFillRed, { width: '80%' }]} /></View>
                  <View style={[ls.blurBar, { marginTop: 4 }]}><View style={[ls.blurBarFillRed, { width: '60%' }]} /></View>
                  <View style={[ls.blurBar, { marginTop: 4 }]}><View style={[ls.blurBarFillRed, { width: '40%' }]} /></View>
                </View>
              </View>
            </View>

            {/* ─── While we're learning ─── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>While we're learning</Text>
              <Text style={ls.subtitleText}>
                Morning and evening check-ins give us the clearest picture. Even a quick one helps.
              </Text>

              <AnimatedPressable
                onPress={() => {
                  hapticLight();
                  if (!morningDone) {
                    router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } });
                  }
                }}
                scaleDown={0.97}
                style={[ls.ctaCard, morningDone && { opacity: 0.6 }]}
              >
                <View style={[ls.ctaIcon, { backgroundColor: '#fef3c7' }]}>
                  <Text style={{ fontSize: 18 }}>☀️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ls.ctaTitle}>
                    {morningDone ? 'Morning check-in ✓' : 'Log your morning check-in'}
                  </Text>
                  <Text style={ls.ctaDesc}>
                    {morningDone ? 'Completed today' : '2 min · Sleep, symptoms, mood'}
                  </Text>
                </View>
                {!morningDone && (
                  <View style={ls.ctaBadge}>
                    <Text style={ls.ctaBadgeText}>NOW</Text>
                  </View>
                )}
                {morningDone && (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>✓</Text>
                  </View>
                )}
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => {
                  hapticLight();
                  if (!eveningDone) {
                    router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
                  }
                }}
                scaleDown={0.97}
                style={[ls.ctaCard, { marginTop: 8 }, eveningDone && { opacity: 0.6 }]}
              >
                <View style={[ls.ctaIcon, { backgroundColor: '#e0e7ff' }]}>
                  <Text style={{ fontSize: 18 }}>🌙</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ls.ctaTitle}>
                    {eveningDone ? 'Evening reflection ✓' : 'Tonight\'s evening reflection'}
                  </Text>
                  <Text style={ls.ctaDesc}>
                    {eveningDone ? 'Completed today' : '2 min · Mood, energy, activities'}
                  </Text>
                </View>
                {!eveningDone && <Text style={{ fontSize: 14, color: '#78716c' }}>7 PM</Text>}
                {eveningDone && (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>✓</Text>
                  </View>
                )}
              </AnimatedPressable>
            </View>

            {/* ─── Early signal ─── */}
            {earlySignalText && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What we're seeing so far</Text>
                <View style={ls.earlySignalCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ color: '#b45309' }}>✦</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={ls.earlySignalTitle}>Early signal</Text>
                      <Text style={ls.earlySignalDesc}>{earlySignalText}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ─── Your symptoms so far ─── */}
            {earlySymptomSummary.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your symptoms so far</Text>
                <View style={{ gap: 8 }}>
                  {earlySymptomSummary.map((s) => {
                    const barColor = s.name.includes('hot_flash') || s.name.includes('irritability')
                      ? '#fbbf24'
                      : s.name.includes('sleep') || s.name.includes('fatigue') || s.name.includes('insomnia')
                        ? '#818cf8'
                        : '#34d399';
                    return (
                      <View key={s.name} style={ls.symptomRawCard}>
                        {/* Mini severity bars */}
                        <View style={ls.symptomMiniBarRow}>
                          {s.severities.map((v, i) => (
                            <View
                              key={i}
                              style={[
                                ls.symptomMiniBar,
                                {
                                  height: Math.max(v * 10, 4),
                                  backgroundColor: v === 0 ? '#e7e5e4' : barColor,
                                  opacity: v === 0 ? 0.3 : 0.4 + v * 0.2,
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={ls.symptomRawName}>{s.emoji} {s.displayName}</Text>
                          <Text style={ls.symptomRawDays}>{s.daysLogged} days logged</Text>
                        </View>
                        <Text style={{ fontSize: 14, color: '#78716c' }}>Gathering data</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─── Motivation footer ─── */}
            <View style={ls.motivationCard}>
              <Text style={ls.motivationLabel}>Remember</Text>
              <Text style={ls.motivationText}>
                Every check-in teaches us something about your body. The patterns are already forming — a few more days and they will be clear enough to share.
              </Text>
            </View>
          </>

        ) : activeTab === 'normal' && normalLearning ? (
          /* ═══════════════ AM I NORMAL? — EMPTY STATE (< 7 DAYS) ═══════════════ */
          <>
            {/* Hero */}
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>{'\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC67'}</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 6 }}>See how you compare</Text>
              <Text style={{ fontSize: 13, color: '#78716c', lineHeight: 19, textAlign: 'center', maxWidth: 300, marginBottom: 20 }}>
                After 7 days of check-ins, we'll show you how your symptoms compare to 12,847 other women in perimenopause.
              </Text>
            </View>

            {/* Progress card */}
            <View style={ne.progressCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1c1917' }}>Your progress</Text>
                <Text style={{ fontSize: 13, color: '#d97706', fontWeight: '700' }}>{totalDays} / 7 days</Text>
              </View>
              <View style={ne.progressBarBg}>
                <View style={[ne.progressBarFill, { width: `${Math.min((totalDays / 7) * 100, 100)}%` }]} />
              </View>
              <Text style={{ fontSize: 12, color: '#a8a29e', marginTop: 8 }}>
                {7 - totalDays > 0
                  ? `${7 - totalDays} more check-in${7 - totalDays > 1 ? 's' : ''} to unlock your comparisons`
                  : 'Comparisons unlocked!'}
              </Text>
            </View>

            {/* What you'll see */}
            <View style={{ marginTop: 20, marginBottom: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1c1917' }}>What you'll see</Text>
            </View>

            {/* Blurred preview symptom rows */}
            <View style={{ opacity: 0.45 }}>
              {[
                { emoji: '\uD83D\uDD25', name: 'Hot flashes', badge: 'Very common', badgeBg: '#dcfce7', badgeColor: '#166534', sub: '82% of women get these' },
                { emoji: '\uD83D\uDE34', name: 'Sleep disruption', badge: 'Very common', badgeBg: '#dcfce7', badgeColor: '#166534', sub: '78% of women experience this' },
                { emoji: '\uD83C\uDF2B\uFE0F', name: 'Brain fog', badge: 'Common', badgeBg: '#fef9c3', badgeColor: '#854d0e', sub: '62% of women get this' },
              ].map((item, i) => (
                <View key={i} style={ne.previewRow}>
                  <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1c1917' }}>{item.name}</Text>
                      <View style={{ backgroundColor: item.badgeBg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: item.badgeColor }}>{item.badge}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#a8a29e', marginTop: 1 }}>{item.sub}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: '#d6d3d1' }}>{'\u203A'}</Text>
                </View>
              ))}
            </View>

            {/* Encouragement card */}
            <View style={ne.encourageCard}>
              <View style={ne.encourageIcon}>
                <Text style={{ fontSize: 14 }}>{'\uD83D\uDC9A'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534', marginBottom: 2 }}>You're not alone in this</Text>
                <Text style={{ fontSize: 12, color: '#4b5563', lineHeight: 18 }}>
                  Thousands of women are tracking the same symptoms.{' '}
                  {7 - totalDays > 0
                    ? `In ${7 - totalDays} more day${7 - totalDays > 1 ? 's' : ''}, you'll see exactly how your experience compares.`
                    : 'Your comparisons are ready!'}
                </Text>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </>

        ) : activeTab === 'patterns' ? (
          /* ═══════════════ MY PATTERNS TAB ═══════════════ */
          <>
            {/* ─── Your story ───────────────────────── */}
            {(pipelineWeeklyStory || (weeklyStory && weeklyStory.narrative)) ? (
              <View style={styles.storyCard}>
                <Text style={styles.storyLabel}>YOUR STORY THIS WEEK</Text>
                <Text style={styles.storyNarrative}>{pipelineWeeklyStory || weeklyStory?.narrative}</Text>
                {weeklyStory?.bestDay && weeklyStory?.worstDay && (
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

            {/* ─── What's helping (green) ─────────── */}
            {helpsHurts.helps.length > 0 && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                  <Text style={styles.sectionTitle}>What's helping</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {helpsHurts.helps.map((h) => (
                    <View key={h.key} style={styles.helpsCardNew}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <View style={styles.helpsIconWrap}>
                          <Text style={{ fontSize: 14 }}>💊</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.corrFactorName}>{h.factorName}</Text>
                          <Text style={styles.corrDesc}>
                            {h.symptomName} improves by{' '}
                            <Text style={{ color: '#059669', fontWeight: '600' }}>{h.pct}%</Text>
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <View style={styles.corrBarBg}>
                          <View style={[styles.corrBarFill, { width: `${Math.min(h.pct, 100)}%`, backgroundColor: '#10b981' }]} />
                        </View>
                        <View style={[styles.corrTag, { backgroundColor: '#ecfdf5' }]}>
                          <Text style={[styles.corrTagText, { color: '#059669' }]}>{h.strength}</Text>
                        </View>
                      </View>
                      {h.explanation && (
                        <Text style={styles.corrExplanation}>
                          {h.lagDays && h.lagDays > 0 ? `Takes ~${h.lagDays} day${h.lagDays > 1 ? 's' : ''} to notice. ` : ''}{h.explanation}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── What's making things worse (red) ── */}
            {helpsHurts.hurts.length > 0 && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
                  <Text style={styles.sectionTitle}>What's making things worse</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {helpsHurts.hurts.map((h) => (
                    <View key={h.key} style={styles.hurtsCardNew}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <View style={styles.hurtsIconWrap}>
                          <Text style={{ fontSize: 14 }}>💊</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.corrFactorName}>{h.factorName}</Text>
                          <Text style={styles.corrDesc}>
                            {h.symptomName} increases by{' '}
                            <Text style={{ color: '#dc2626', fontWeight: '600' }}>{h.pct}%</Text>
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <View style={[styles.corrBarBg, { backgroundColor: '#fef2f2' }]}>
                          <View style={[styles.corrBarFill, { width: `${Math.min(h.pct, 100)}%`, backgroundColor: '#ef4444' }]} />
                        </View>
                        <View style={[styles.corrTag, { backgroundColor: '#fef2f2' }]}>
                          <Text style={[styles.corrTagText, { color: '#dc2626' }]}>{h.strength}</Text>
                        </View>
                      </View>
                      {h.recommendation && (
                        <View style={styles.corrTipCard}>
                          <Text style={{ fontSize: 14, marginTop: 1 }}>💡</Text>
                          <Text style={styles.corrTipText}>{h.recommendation}</Text>
                        </View>
                      )}
                      {!h.recommendation && h.explanation && (
                        <Text style={styles.corrExplanation}>{h.explanation}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── It's complicated (amber) ────────── */}
            {contradictions.length > 0 && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
                  <Text style={styles.sectionTitle}>It's complicated</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {contradictions.map((c, i) => (
                    <View key={i} style={styles.complicatedCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <View style={styles.complicatedIconWrap}>
                          <Text style={{ fontSize: 14 }}>💊</Text>
                        </View>
                        <View>
                          <Text style={styles.corrFactorName}>{formatSymptomName(c.factor)}</Text>
                          <Text style={{ fontSize: 12, color: '#78716c', marginTop: 2 }}>Helps some things, hurts others</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        <View style={styles.complicatedHelpsBox}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#059669', marginBottom: 4 }}>✓ Helps</Text>
                          <Text style={{ fontSize: 12, fontWeight: '500', color: '#1c1917' }}>{formatSymptomName(c.helpsSymptom)}</Text>
                        </View>
                        <View style={styles.complicatedHurtsBox}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#dc2626', marginBottom: 4 }}>✗ Hurts</Text>
                          <Text style={{ fontSize: 12, fontWeight: '500', color: '#1c1917' }}>{formatSymptomName(c.hurtsSymptom)}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: '#78716c', lineHeight: 17 }}>{c.explanation}</Text>
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
                    const trendColor = s.trendPct < 0 ? '#047857' : s.trendPct > 0 ? '#b45309' : '#78716c';
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
                        <Text style={{ color: '#78716c', fontSize: 16 }}>›</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardHint}>Your symptom trends will appear here once you have a few days logged</Text>
                </View>
              )}
            </View>

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

            {/* ─── Looking ahead (dynamic from correlations) ── */}
            <View style={styles.expectCard}>
              <Text style={styles.expectLabel}>💡 Looking ahead</Text>
              <Text style={styles.expectDesc}>{lookingAheadText}</Text>
            </View>
          </>
        ) : (
          /* ═══════════════ AM I NORMAL? TAB ═══════════════ */
          <>
            {/* ──── Unlock celebration (shows once on first visit) ──── */}
            {trialDay >= 14 && trialDay <= 16 && !hasSeen('normal_unlock_seen') && (
              <View style={styles.normalUnlockCard}>
                <Text style={{ fontSize: 20, textAlign: 'center', marginBottom: 6 }}>{'\u2728'}</Text>
                <Text style={styles.normalUnlockTitle}>Am I Normal? is ready</Text>
                <Text style={styles.normalUnlockSub}>
                  14 days of data unlocked your personalised comparison. See how your symptoms compare to thousands of other women.
                </Text>
                <AnimatedPressable onPress={() => markSeen('normal_unlock_seen')} scaleDown={0.97} style={styles.normalUnlockBtn}>
                  <Text style={styles.normalUnlockBtnText}>Let{'\u2019'}s see</Text>
                </AnimatedPressable>
              </View>
            )}

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
                  const badgeColor = bm.label === 'Very common' ? '#047857' : bm.label === 'Common' ? '#b45309' : '#78716c';
                  const userPct = bm.percentilePosition;
                  const emoji = SYMPTOM_EMOJI[bm.name.toLowerCase().replace(/\s+/g, '_')] || '•';
                  return (
                    <AnimatedPressable
                      key={bm.name}
                      onPress={() => {
                        hapticLight();
                        const key = DISPLAY_TO_KEY[bm.name.toLowerCase()] || bm.name.toLowerCase().replace(/\s+/g, '_');
                        router.push({ pathname: '/(app)/symptom-detail', params: { symptom: key } });
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
                      <Text style={{ fontSize: 10, color: m.done ? '#fff' : '#78716c' }}>✓</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.milestoneLabel, m.done && styles.milestoneLabelDone]}>{m.label}</Text>
                      <Text style={styles.milestoneSub}>{m.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

          </>
        )}
      </ScrollView>

      {/* Soft paywall overlay for expired trial — data is visible behind */}
      {trialExpired && (
        <View style={pw.overlay}>
          <View style={pw.fade} />
          <View style={pw.card}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>{'\u2728'}</Text>
            <Text style={pw.title}>Unlock your full insights</Text>
            <Text style={pw.sub}>
              Your patterns are ready. Subscribe to see all correlations, benchmarks, and personalised recommendations.
            </Text>
            <AnimatedPressable
              onPress={() => router.push('/(app)/paywall' as any)}
              scaleDown={0.97}
              style={pw.btn}
            >
              <Text style={pw.btnText}>See plans</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push('/(app)/calendar')}
              scaleDown={0.97}
              style={{ marginTop: 8 }}
            >
              <Text style={{ fontSize: 13, color: '#78716c' }}>View past data {'\u2192'}</Text>
            </AnimatedPressable>
          </View>
        </View>
      )}
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
  headerSub: { fontSize: 14, color: '#78716c', marginTop: 2 },
  reportButton: {
    backgroundColor: '#1c1917',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reportButtonText: { fontSize: 14, color: '#ffffff', fontWeight: '500' },

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
  tabText: { fontSize: 14, fontWeight: '500', color: '#78716c' },
  tabTextActive: { color: '#1c1917', fontWeight: '600' },

  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#78716c', textAlign: 'center', lineHeight: 20 },
  emptyCta: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  emptyCtaText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginBottom: 10 },
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
  qualityBadgeText: { fontSize: 12, fontWeight: '600', color: '#b45309' },

  // Weekly story card (dark)
  storyCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  storyLabel: { fontSize: 12, color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  storyNarrative: { fontSize: 16, color: '#ffffff', lineHeight: 22, marginBottom: 16 },
  storyDays: { flexDirection: 'row', gap: 10 },
  storyDayCard: {
    flex: 1,
    backgroundColor: '#292524',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  storyDayEmoji: { fontSize: 20, marginBottom: 4 },
  storyDayLabel: { fontSize: 14, color: '#78716c', marginBottom: 2 },
  storyDayValue: { fontSize: 14, color: '#ffffff', fontWeight: '500' },

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
  correlationFactor: { fontSize: 16, fontWeight: '600', color: '#1c1917' },
  correlationArrow: { fontSize: 14, color: '#44403c', marginTop: 4 },
  correlationConfidence: { fontSize: 14, color: '#78716c', marginTop: 6 },

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
  symptomName: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  symptomMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  symptomTrend: { fontSize: 14 },
  symptomDays: { fontSize: 14, color: '#78716c' },
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
  helpsHurtsLabel: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 10 },
  hhItem: { marginBottom: 8 },
  hhRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hhName: { fontSize: 14, color: '#44403c' },
  hhPct: { fontSize: 14, fontWeight: '600' },
  hhBarBg: { height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2 },
  hhBarFill: { height: 4, borderRadius: 2 },
  hhEmpty: { fontSize: 14, color: '#78716c', fontStyle: 'italic' },

  // ═══ New correlation cards (mockup design) ═══
  helpsCardNew: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  hurtsCardNew: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  helpsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hurtsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corrFactorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
  },
  corrDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  corrBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#ecfdf5',
    borderRadius: 99,
    overflow: 'hidden',
  },
  corrBarFill: {
    height: 4,
    borderRadius: 99,
  },
  corrTag: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  corrTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  corrExplanation: {
    fontSize: 12,
    color: '#78716c',
    marginTop: 8,
    lineHeight: 17,
  },
  corrTipCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  corrTipText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
    lineHeight: 17,
    flex: 1,
  },
  complicatedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  complicatedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  complicatedHelpsBox: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 12,
  },
  complicatedHurtsBox: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 12,
  },

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
  sleepLabel: { fontSize: 14, color: '#78716c' },
  sleepValue: { fontSize: 14, color: '#ffffff', fontWeight: '500', marginTop: 2 },
  sleepHint: { fontSize: 14, color: '#78716c', marginTop: 2 },
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
  sleepBarLabel: { fontSize: 14, color: '#78716c', marginTop: 4 },

  // Expect card
  expectCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  expectLabel: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginBottom: 6 },
  expectDesc: { fontSize: 14, color: '#78716c', lineHeight: 20 },

  // ─── Am I Normal tab styles ──────────────────
  compGroupTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  compGroupSub: { fontSize: 14, color: '#78716c', marginBottom: 12 },
  compTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compTraitPill: {
    backgroundColor: '#292524',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compTraitText: { fontSize: 14, color: '#a8a29e' },

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
  benchmarkName: { fontSize: 16, fontWeight: '600', color: '#1c1917' },
  benchmarkBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  benchmarkBadgeText: { fontSize: 12, fontWeight: '600' },
  benchmarkUserStat: { fontSize: 14, color: '#78716c', marginBottom: 12 },
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
    fontSize: 14,
    color: '#1c1917',
    fontWeight: '600',
    marginTop: 2,
  },
  populationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  populationLabelText: { fontSize: 14, color: '#78716c' },
  benchmarkDetail: { fontSize: 14, color: '#78716c', lineHeight: 20 },

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
  factTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  factDesc: { fontSize: 14, color: '#78716c', lineHeight: 20 },

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
  milestoneLabel: { fontSize: 14, color: '#78716c' },
  milestoneLabelDone: { color: '#1c1917', fontWeight: '500' },
  milestoneSub: { fontSize: 14, color: '#78716c', marginTop: 1 },

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
  cardHint: { fontSize: 14, color: '#78716c', textAlign: 'center' },

  // Normal unlock celebration
  normalUnlockCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
  },
  normalUnlockTitle: { fontSize: 16, fontWeight: '700', color: '#4338ca', marginBottom: 4 },
  normalUnlockSub: { fontSize: 13, color: '#6366f1', lineHeight: 19, textAlign: 'center', marginBottom: 10 },
  normalUnlockBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  normalUnlockBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },

  // Locked insights (trial expired)
  lockedInsights: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  lockedInsightsTitle: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 6, textAlign: 'center' },
  lockedInsightsSub: { fontSize: 14, color: '#78716c', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  lockedInsightsBtn: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  lockedInsightsBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});

// ─── Normal Empty State Styles ──────────────────────────
const ne = StyleSheet.create({
  progressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#f5f5f4',
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  previewRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    marginBottom: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  encourageCard: {
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row' as const,
    gap: 10,
    alignItems: 'flex-start' as const,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  encourageIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

// ─── Learning State Styles ──────────────────────────────
const ls = StyleSheet.create({
  // Hero card (dark)
  heroCard: {
    backgroundColor: '#1c1917',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heroTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 6, textAlign: 'center' },
  heroDesc: { fontSize: 12, color: '#78716c', lineHeight: 18, textAlign: 'center', marginBottom: 16 },
  heroEncouragement: { fontSize: 12, fontWeight: '500', color: '#2dd4bf', textAlign: 'center', marginTop: 8 },

  // Progress ring (large, patterns)
  progressRingWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingNumber: { fontSize: 24, fontWeight: '300', color: '#ffffff' },
  progressRingOf: { fontSize: 12, color: '#78716c' },

  // Progress ring (small, normal)
  progressRingWrapSmall: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressRingInnerSmall: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingNumberSmall: { fontSize: 20, fontWeight: '300', color: '#ffffff' },
  progressRingOfSmall: { fontSize: 12, color: '#78716c' },

  // Day dots (patterns learning)
  dayDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dayDotCol: { alignItems: 'center', gap: 4 },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotFilled: { backgroundColor: '#2dd4bf' },
  dayDotEmpty: { borderWidth: 1, borderColor: '#44403c' },
  dayDotText: { fontSize: 12, color: '#44403c' },
  dayDotTextFilled: { color: '#ffffff', fontWeight: '500' },
  dayDotLetter: { fontSize: 12, color: '#44403c' },

  // 14-day dot grid (normal learning)
  dotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  dotGridItem: {
    height: 8,
    borderRadius: 4,
    flex: 1,
    minWidth: 30,
  },
  dotGridLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotGridLabelText: { fontSize: 12, color: '#44403c' },

  // Blurred preview cards
  blurredCard: {
    backgroundColor: '#f5f5f4',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  blurredCardSmall: {
    backgroundColor: '#f5f5f4',
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.75)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  lockCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  blurOverlayText: { fontSize: 12, fontWeight: '500', color: '#78716c' },
  blurLabel: { fontSize: 12, color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  blurContent: { fontSize: 14, color: '#a8a29e', lineHeight: 18 },
  blurBar: { height: 4, backgroundColor: '#e7e5e4', borderRadius: 2, marginTop: 8 },
  blurBarFill: { height: 4, borderRadius: 2, backgroundColor: '#d6d3d1' },
  blurBarFillGreen: { height: 4, borderRadius: 2, backgroundColor: '#a7f3d0' },
  blurBarFillRed: { height: 4, borderRadius: 2, backgroundColor: '#fecaca' },

  // Subtitle text
  subtitleText: { fontSize: 12, color: '#78716c', marginBottom: 12, lineHeight: 18 },

  // CTA cards (morning/evening)
  ctaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  ctaDesc: { fontSize: 12, color: '#78716c', marginTop: 2 },
  ctaBadge: {
    backgroundColor: '#fbbf24',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ctaBadgeText: { fontSize: 12, fontWeight: '700', color: '#1c1917' },

  // Early signal
  earlySignalCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
  },
  earlySignalTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  earlySignalDesc: { fontSize: 12, color: '#78716c', lineHeight: 18, marginTop: 4 },

  // Raw symptom cards
  symptomRawCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  symptomMiniBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    width: 30,
    height: 30,
  },
  symptomMiniBar: {
    width: 5,
    borderRadius: 2,
  },
  symptomRawName: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  symptomRawDays: { fontSize: 12, color: '#78716c', marginTop: 2 },

  // Motivation card (dark footer)
  motivationCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  motivationLabel: { fontSize: 12, color: '#78716c', marginBottom: 6 },
  motivationText: { fontSize: 14, color: '#ffffff', lineHeight: 20, textAlign: 'center' },

  // ─── Am I Normal learning styles ───────────────

  // Why 14 days explainer
  explainerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    marginBottom: 20,
  },
  questionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  explainerTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  explainerDesc: { fontSize: 12, color: '#78716c', lineHeight: 18 },

  // Peer group preview
  peerGroupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  peerGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  peerGroupIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerGroupTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  peerGroupSub: { fontSize: 12, color: '#78716c', marginTop: 1 },
  peerGroupDivider: {
    height: 1,
    backgroundColor: '#f5f5f4',
    marginTop: 4,
    marginBottom: 12,
  },

  // Blurred benchmark cards
  blurBenchmarkCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    overflow: 'hidden',
    position: 'relative',
  },
  blurBenchmarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  blurBenchmarkOverlayText: { fontSize: 12, fontWeight: '500', color: '#78716c', marginBottom: 2 },
  blurBadge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  blurPopBar: {
    height: 10,
    backgroundColor: '#f5f5f4',
    borderRadius: 5,
    position: 'relative',
    overflow: 'visible',
  },
  blurPopBarFill: {
    height: 10,
    backgroundColor: '#e7e5e4',
    borderRadius: 5,
  },
  blurPopMarker: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#d6d3d1',
    borderWidth: 2,
    borderColor: '#ffffff',
    marginLeft: -6,
  },

  // Community fact cards
  communityFactGreen: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 14,
    padding: 14,
  },
  communityFactAmber: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 14,
  },
  communityFactText: { fontSize: 12, color: '#78716c', lineHeight: 18, flex: 1 },

  // Journey stats card (dark)
  journeyCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  journeyLabel: { fontSize: 12, color: '#78716c', letterSpacing: 1, marginBottom: 12 },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  journeyStat: { flex: 1, alignItems: 'center' },
  journeyStatNumber: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  journeyStatLabel: { fontSize: 12, color: '#78716c', marginTop: 2 },
  journeyDivider: { width: 1, height: 32, backgroundColor: '#292524' },
  journeyDesc: { fontSize: 12, color: '#78716c', lineHeight: 18, textAlign: 'center' },

  // Big CTA button
  bigCta: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  bigCtaText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});

const pw = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  fade: {
    height: 120,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: '#fafaf9',
    paddingTop: 24,
    paddingBottom: 100,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1917',
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    maxWidth: 280,
  },
  btn: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
});

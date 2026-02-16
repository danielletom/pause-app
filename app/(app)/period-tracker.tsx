import React, { useState, useCallback, useMemo, useRef } from 'react';
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

/* ─── Helpers ──────────────────────────────────────────── */

function timeAgo(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'about a week ago';
  if (weeks < 4) return `about ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'about a month ago';
  if (months < 3) return `about ${months} months ago`;
  return `${months} months ago`;
}

function flowColor(flow: string | null): { bg: string; text: string; label: string } {
  switch (flow) {
    case 'heavy':
    case 'very_heavy':
      return { bg: '#ffe4e6', text: '#e11d48', label: flow === 'very_heavy' ? 'Very heavy' : 'Heavy' };
    case 'medium':
      return { bg: '#fff7ed', text: '#ea580c', label: 'Medium' };
    case 'light':
      return { bg: '#ecfdf5', text: '#059669', label: 'Light' };
    case 'spotting':
      return { bg: '#fce7f3', text: '#db2777', label: 'Spotting' };
    default:
      return { bg: '#f5f5f4', text: '#78716c', label: '—' };
  }
}

interface Cycle {
  id: number;
  startDate: string;
  endDate: string | null;
  periodLength: number | null;
  cycleLength: number | null;
  peakFlow: string | null;
  dominantMood: string | null;
  status: string;
}

interface Analytics {
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  cycleVariance: number | null;
  cycleRangeMin: number | null;
  cycleRangeMax: number | null;
  cycleRangeLabel: string | null;
  stage: string | null;
  stageConfidence: number | null;
  predictedNextStart: string | null;
  predictionConfidence: string | null;
}

interface CurrentCycle {
  cycle: Cycle | null;
  events: any[];
  daysSinceStart: number | null;
}

export default function PeriodTrackerScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [currentCycle, setCurrentCycle] = useState<CurrentCycle | null>(null);
  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getTokenRef.current();
      const [cyclesData, analyticsData, currentData] = await Promise.all([
        apiRequest('/api/period/cycles', token).catch(() => []),
        apiRequest('/api/period/cycles/analytics', token).catch(() => null),
        apiRequest('/api/period/cycles/current', token).catch(() => null),
      ]);
      setCycles(Array.isArray(cyclesData) ? cyclesData : []);
      setAnalytics(analyticsData);
      setCurrentCycle(currentData);
      hasLoadedOnce.current = true;
    } catch {
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const lastCycle = cycles.length > 0 ? cycles[0] : null;
  const isActive = currentCycle?.cycle?.status === 'active' && currentCycle?.cycle?.periodLength == null;
  const daysSinceLast = currentCycle?.daysSinceStart ?? null;

  // Sparkline data — last 8 cycles
  const sparkCycles = useMemo(() => {
    return cycles.filter(c => c.cycleLength != null).slice(0, 8).reverse();
  }, [cycles]);

  const avgCycle = analytics?.avgCycleLength ? Math.round(analytics.avgCycleLength) : null;
  const avgPeriod = analytics?.avgPeriodLength ? `${analytics.avgPeriodLength.toFixed(1)}` : null;
  const variance = analytics?.cycleVariance ? `${Math.round(analytics.cycleVariance)}d` : null;
  const rangeLabel = analytics?.cycleRangeLabel || (analytics?.cycleRangeMin && analytics?.cycleRangeMax ? `${analytics.cycleRangeMin}–${analytics.cycleRangeMax} days` : null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.97}>
              <Text style={styles.backBtn}>← Home</Text>
            </AnimatedPressable>
            <Text style={styles.title}>Period Tracker</Text>
          </View>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.push('/(app)/period-settings'); }}
            scaleDown={0.95}
            style={styles.settingsBtn}
          >
            <Text style={{ fontSize: 16, color: '#78716c' }}>⚙</Text>
          </AnimatedPressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : (
          <>
            {/* Main status card */}
            <View style={styles.statusCard}>
              <View style={styles.statusCircle}>
                <Text style={styles.statusCircleLabel}>Last period</Text>
                <Text style={styles.statusCircleValue}>
                  {isActive ? `Day ${(daysSinceLast ?? 0) + 1}` : daysSinceLast != null ? timeAgo(daysSinceLast) : 'No data'}
                </Text>
                {lastCycle && (
                  <Text style={styles.statusCircleSub}>
                    {new Date(lastCycle.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {lastCycle.endDate ? ` – ${new Date(lastCycle.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </Text>
                )}
              </View>
              {rangeLabel && (
                <Text style={styles.statusContext}>
                  Your periods have been coming every <Text style={{ fontWeight: '700', color: '#44403c' }}>{rangeLabel}</Text> lately.
                </Text>
              )}
              {cycles.length > 0 && (
                <Text style={styles.statusContextSub}>Based on your last {Math.min(cycles.length, 8)} periods</Text>
              )}
            </View>

            {/* Quick log button */}
            {isActive ? (
              <AnimatedPressable
                onPress={() => { hapticMedium(); router.push('/(app)/period-daily'); }}
                scaleDown={0.97}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Log today's flow</Text>
              </AnimatedPressable>
            ) : (
              <AnimatedPressable
                onPress={() => { hapticMedium(); router.push('/(app)/period-log'); }}
                scaleDown={0.97}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>My period started</Text>
              </AnimatedPressable>
            )}

            {/* Last period summary */}
            {lastCycle && (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLabel}>Last period</Text>
                    <Text style={styles.cardValue}>
                      {new Date(lastCycle.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {lastCycle.endDate ? ` – ${new Date(lastCycle.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' (ongoing)'}
                    </Text>
                    <Text style={styles.cardSub}>
                      {lastCycle.periodLength ? `${lastCycle.periodLength} days` : '—'} · {flowColor(lastCycle.peakFlow).label} flow
                    </Text>
                  </View>
                  {lastCycle.peakFlow && (
                    <View style={[styles.flowBadge, { backgroundColor: flowColor(lastCycle.peakFlow).bg }]}>
                      <Text style={[styles.flowBadgeText, { color: flowColor(lastCycle.peakFlow).text }]}>{flowColor(lastCycle.peakFlow).label}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Cycle length sparkline */}
            {sparkCycles.length >= 2 && (
              <AnimatedPressable
                onPress={() => { hapticLight(); router.push('/(app)/period-insights'); }}
                scaleDown={0.98}
                style={styles.card}
              >
                <Text style={styles.cardLabel}>Cycle lengths · Last {sparkCycles.length} cycles</Text>
                <View style={styles.sparkRow}>
                  {sparkCycles.map((c, i) => {
                    const maxH = 56;
                    const minC = 25;
                    const maxC = 55;
                    const len = c.cycleLength ?? 30;
                    const h = Math.max(14, ((len - minC) / (maxC - minC)) * maxH);
                    const isLatest = i === sparkCycles.length - 1;
                    return (
                      <View key={c.id} style={styles.sparkCol}>
                        <View style={[styles.sparkBar, { height: h, backgroundColor: isLatest ? '#f43f5e' : '#e7e5e4' }]} />
                        <Text style={styles.sparkLabel}>{len}d</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={styles.cardSub}>Range: {analytics?.cycleRangeMin ?? '—'}–{analytics?.cycleRangeMax ?? '—'} days</Text>
                  <Text style={[styles.seeAll, { color: '#f43f5e' }]}>View insights →</Text>
                </View>
              </AnimatedPressable>
            )}

            {/* Quick stats */}
            {(avgCycle || avgPeriod || variance) && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{avgCycle ?? '—'}</Text>
                  <Text style={styles.statLabel}>Avg cycle{'\n'}length</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{avgPeriod ?? '—'}</Text>
                  <Text style={styles.statLabel}>Avg period{'\n'}days</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: '#f43f5e' }]}>{variance ?? '—'}</Text>
                  <Text style={styles.statLabel}>Cycle{'\n'}variance</Text>
                </View>
              </View>
            )}

            {/* Spotting log */}
            <AnimatedPressable
              onPress={() => { hapticLight(); router.push('/(app)/period-bleeding'); }}
              scaleDown={0.97}
              style={styles.card}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.spottingIcon}>
                  <Text style={{ fontSize: 12, color: '#f43f5e' }}>•</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Spotting?</Text>
                  <Text style={styles.cardSub}>Log spotting between periods</Text>
                </View>
                <View style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Log</Text>
                </View>
              </View>
            </AnimatedPressable>

            {/* Navigation cards */}
            <View style={styles.navGrid}>
              <AnimatedPressable
                onPress={() => { hapticLight(); router.push('/(app)/period-history'); }}
                scaleDown={0.97}
                style={styles.navCard}
              >
                <Text style={{ fontSize: 14, marginBottom: 4 }}>📅</Text>
                <Text style={styles.navCardTitle}>Cycle history</Text>
                <Text style={styles.navCardSub}>All logged cycles</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { hapticLight(); router.push('/(app)/period-insights'); }}
                scaleDown={0.97}
                style={styles.navCard}
              >
                <Text style={{ fontSize: 14, marginBottom: 4 }}>📊</Text>
                <Text style={styles.navCardTitle}>Cycle insights</Text>
                <Text style={styles.navCardSub}>Patterns & trends</Text>
              </AnimatedPressable>
            </View>

            {/* Empty state */}
            {cycles.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>◯</Text>
                <Text style={styles.emptyTitle}>No periods logged yet</Text>
                <Text style={styles.emptySub}>
                  Tap "My period started" when your next period arrives, or log spotting if you notice any.
                </Text>
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 },
  loadingContainer: { paddingTop: 80, alignItems: 'center' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  backBtn: { fontSize: 12, color: '#a8a29e', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f4', alignItems: 'center', justifyContent: 'center' },

  statusCard: {
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  statusCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,228,230,0.6)',
    borderWidth: 2, borderColor: '#fecdd3',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  statusCircleLabel: { fontSize: 11, color: '#f43f5e', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusCircleValue: { fontSize: 22, fontWeight: '700', color: '#1c1917', marginTop: 2 },
  statusCircleSub: { fontSize: 10, color: '#a8a29e', marginTop: 2 },
  statusContext: { fontSize: 12, color: '#78716c', textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },
  statusContextSub: { fontSize: 10, color: '#d6d3d1', marginTop: 6 },

  primaryBtn: {
    backgroundColor: '#f43f5e',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  cardLabel: { fontSize: 12, color: '#a8a29e', marginBottom: 6 },
  cardValue: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#a8a29e' },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917' },

  flowBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  flowBadgeText: { fontSize: 12, fontWeight: '500' },

  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 64, marginTop: 8 },
  sparkCol: { flex: 1, alignItems: 'center', gap: 4 },
  sparkBar: { width: '100%', borderRadius: 6 },
  sparkLabel: { fontSize: 9, color: '#d6d3d1' },

  seeAll: { fontSize: 12, fontWeight: '500', color: '#f43f5e' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#a8a29e', textAlign: 'center', lineHeight: 14 },

  spottingIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffe4e6', alignItems: 'center', justifyContent: 'center' },
  smallBtn: { backgroundColor: '#fff1f2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#fecdd3' },
  smallBtnText: { fontSize: 12, fontWeight: '500', color: '#f43f5e' },

  navGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  navCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  navCardTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginBottom: 2 },
  navCardSub: { fontSize: 10, color: '#a8a29e' },

  emptyCard: {
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#78716c', textAlign: 'center', lineHeight: 18 },
});

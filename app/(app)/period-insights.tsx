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
import { hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

interface Analytics {
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  cycleVariance: number | null;
  cycleRangeMin: number | null;
  cycleRangeMax: number | null;
  cycleRangeLabel: string | null;
  stage: string | null;
  stageConfidence: number | null;
  variabilityTrend: string | null;
  flowTrend: string | null;
  predictedNextStart: string | null;
  predictionWindowDays: number | null;
  predictionConfidence: string | null;
  spotsBeforePeriodPct: number | null;
  avgSpottingLeadDays: number | null;
}

interface Cycle {
  id: number;
  cycleLength: number | null;
  peakFlow: string | null;
}

const STAGE_MAP: Record<string, { label: string; index: number }> = {
  'early_peri': { label: 'Early perimenopause', index: 0 },
  'mid_peri': { label: 'Mid-perimenopause', index: 1 },
  'late_peri': { label: 'Late perimenopause', index: 2 },
  'approaching_menopause': { label: 'Approaching menopause', index: 3 },
};

export default function PeriodInsightsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const [analyticsData, cyclesData] = await Promise.all([
        apiRequest('/api/period/cycles/analytics', token).catch(() => null),
        apiRequest('/api/period/cycles', token).catch(() => []),
      ]);
      setAnalytics(analyticsData);
      setCycles(Array.isArray(cyclesData) ? cyclesData : []);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const stage = analytics?.stage ? STAGE_MAP[analytics.stage] : null;
  const completedCycles = cycles.filter(c => c.cycleLength != null);
  const firstHalf = completedCycles.slice(Math.floor(completedCycles.length / 2));
  const secondHalf = completedCycles.slice(0, Math.floor(completedCycles.length / 2));

  const firstRange = firstHalf.length > 0
    ? `${Math.min(...firstHalf.map(c => c.cycleLength ?? 0))}–${Math.max(...firstHalf.map(c => c.cycleLength ?? 0))}d`
    : '—';
  const secondRange = secondHalf.length > 0
    ? `${Math.min(...secondHalf.map(c => c.cycleLength ?? 0))}–${Math.max(...secondHalf.map(c => c.cycleLength ?? 0))}d`
    : '—';

  const heavyCount = completedCycles.filter(c => c.peakFlow === 'heavy' || c.peakFlow === 'very_heavy').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.97}>
            <Text style={styles.backBtn}>← Tracker</Text>
          </AnimatedPressable>
          <Text style={styles.title}>Cycle Insights</Text>
          <Text style={styles.subtitle}>Based on your {completedCycles.length} tracked cycles</Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#f43f5e" />
          </View>
        ) : !analytics || !analytics.avgCycleLength ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>📊</Text>
            <Text style={styles.emptyTitle}>Not enough data yet</Text>
            <Text style={styles.emptySub}>
              Log at least 2 periods to see cycle insights and patterns. We need this data to estimate your perimenopause stage and track trends.
            </Text>
          </View>
        ) : (
          <>
            {/* Perimenopause stage indicator */}
            {stage && (
              <View style={styles.stageCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={styles.stageIcon}>
                    <Text style={{ fontSize: 14, color: '#f43f5e' }}>◐</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1c1917' }}>{stage.label}</Text>
                    <Text style={{ fontSize: 12, color: '#a8a29e' }}>Estimated stage based on your patterns</Text>
                  </View>
                </View>
                <View style={styles.stageBarRow}>
                  {[0, 1, 2, 3].map(i => (
                    <View key={i} style={[styles.stageBar, { backgroundColor: i <= stage.index ? '#f43f5e' : '#e7e5e4' }]} />
                  ))}
                </View>
                <View style={styles.stageLabels}>
                  <Text style={[styles.stageLabelText, stage.index === 0 && { color: '#f43f5e', fontWeight: '500' }]}>Early peri</Text>
                  <Text style={[styles.stageLabelText, stage.index === 1 && { color: '#f43f5e', fontWeight: '500' }]}>Mid peri</Text>
                  <Text style={[styles.stageLabelText, stage.index === 2 && { color: '#f43f5e', fontWeight: '500' }]}>Late peri</Text>
                  <Text style={[styles.stageLabelText, stage.index === 3 && { color: '#f43f5e', fontWeight: '500' }]}>Menopause</Text>
                </View>
              </View>
            )}

            {/* Variability pattern */}
            {analytics.variabilityTrend && (
              <View style={styles.insightCard}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: '#f43f5e' }}>📈</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightTitle}>
                      {analytics.variabilityTrend === 'increasing'
                        ? 'Your cycles are getting more variable'
                        : analytics.variabilityTrend === 'stable'
                        ? 'Your cycle variability is stable'
                        : 'Your cycles are becoming more regular'}
                    </Text>
                    <Text style={styles.insightBody}>
                      {analytics.variabilityTrend === 'increasing'
                        ? `Your recent cycles ranged from ${secondRange}. Earlier cycles were ${firstRange}. Increasing variability is a hallmark sign of perimenopause.`
                        : `Your cycles are ranging from ${analytics.cycleRangeMin ?? '—'}–${analytics.cycleRangeMax ?? '—'} days.`}
                    </Text>
                  </View>
                </View>
                {firstHalf.length > 0 && secondHalf.length > 0 && (
                  <View style={styles.comparisonRow}>
                    <View style={styles.comparisonCol}>
                      <Text style={styles.comparisonLabel}>First {firstHalf.length} cycles</Text>
                      <Text style={styles.comparisonValue}>{firstRange}</Text>
                    </View>
                    <View style={styles.comparisonCol}>
                      <Text style={styles.comparisonLabel}>Last {secondHalf.length} cycles</Text>
                      <Text style={[styles.comparisonValue, { color: '#f43f5e' }]}>{secondRange}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Flow changes */}
            {completedCycles.length >= 3 && (
              <View style={styles.insightCard}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: '#f43f5e' }}>💧</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightTitle}>
                      {analytics.flowTrend === 'heavier'
                        ? 'Heavier periods becoming more frequent'
                        : analytics.flowTrend === 'lighter'
                        ? 'Your periods are getting lighter'
                        : 'Your flow patterns are stable'}
                    </Text>
                    <Text style={styles.insightBody}>
                      {heavyCount} of your last {completedCycles.length} periods were heavy flow.
                      {analytics.flowTrend === 'heavier' ? ' Heavier periods are common in perimenopause as oestrogen surges can cause thicker uterine lining.' : ''}
                    </Text>
                  </View>
                </View>
                {/* Flow bars */}
                <View style={styles.flowBarRow}>
                  {completedCycles.slice(0, 8).reverse().map(c => (
                    <View
                      key={c.id}
                      style={[styles.flowBarItem, {
                        backgroundColor: c.peakFlow === 'heavy' || c.peakFlow === 'very_heavy' ? '#f43f5e' : c.peakFlow === 'medium' ? '#fda4af' : '#fecdd3',
                      }]}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Spotting patterns */}
            {analytics.spotsBeforePeriodPct != null && analytics.spotsBeforePeriodPct > 0 && (
              <View style={[styles.insightCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: '#d97706' }}>✦</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightTitle}>Spotting predicts your period</Text>
                    <Text style={styles.insightBody}>
                      You spot before {Math.round(analytics.spotsBeforePeriodPct)}% of your periods, usually {analytics.avgSpottingLeadDays ? `${Math.round(analytics.avgSpottingLeadDays)}` : '2–4'} days before. This pattern could help you prepare.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Menopause tracking */}
            <View style={[styles.insightCard, { backgroundColor: '#fafaf9' }]}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>Tracking towards menopause</Text>
                  <Text style={styles.insightBody}>
                    Menopause is defined as 12 consecutive months without a period.
                    {analytics.cycleRangeMax ? ` Your longest gap so far has been ${analytics.cycleRangeMax} days.` : ''}
                  </Text>
                </View>
              </View>
            </View>

            {/* When to see GP */}
            <View style={[styles.insightCard, { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }]}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text>🩺</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>When to talk to your GP</Text>
                  <Text style={styles.insightBody}>
                    Bring your cycle data to your GP if you experience: periods less than 21 days apart, periods lasting more than 7 days, soaking through a pad/tampon in under an hour, or any bleeding after 12 months without a period.
                  </Text>
                </View>
              </View>
            </View>

            {/* How period data helps */}
            <View style={styles.insightCard}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#44403c', marginBottom: 10 }}>How period data improves Pause</Text>
              {[
                { icon: '🌡', text: 'Correlates hot flashes with cycle phase for better predictions' },
                { icon: '😴', text: 'Adjusts sleep recommendations around your period' },
                { icon: '🧘', text: 'Suggests calming content when PMS symptoms are likely' },
                { icon: '📊', text: 'Includes cycle data in your GP report' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12 }}>{item.icon}</Text>
                  <Text style={{ fontSize: 12, color: '#78716c', flex: 1, lineHeight: 18 }}>{item.text}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 },
  topBar: { marginBottom: 16 },
  backBtn: { fontSize: 12, color: '#a8a29e', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  subtitle: { fontSize: 12, color: '#a8a29e', marginTop: 2 },

  stageCard: {
    backgroundColor: '#fff1f2', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#fecdd3', marginBottom: 10,
  },
  stageIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffe4e6', alignItems: 'center', justifyContent: 'center' },
  stageBarRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  stageBar: { flex: 1, height: 8, borderRadius: 4 },
  stageLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  stageLabelText: { fontSize: 10, color: '#a8a29e' },

  insightCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f5f5f4', marginBottom: 10,
  },
  insightTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917', marginBottom: 4 },
  insightBody: { fontSize: 12, color: '#78716c', lineHeight: 18 },

  comparisonRow: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f5f5f4' },
  comparisonCol: { flex: 1, alignItems: 'center' },
  comparisonLabel: { fontSize: 12, color: '#a8a29e', marginBottom: 4 },
  comparisonValue: { fontSize: 18, fontWeight: '700', color: '#44403c' },

  flowBarRow: { flexDirection: 'row', gap: 3, marginTop: 10 },
  flowBarItem: { flex: 1, height: 12, borderRadius: 6 },

  emptyCard: {
    backgroundColor: '#fff1f2', borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#fecdd3',
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#78716c', textAlign: 'center', lineHeight: 18 },
});

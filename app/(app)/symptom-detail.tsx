import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ─── Benchmark data (hardcoded for V2) ─── */
const BENCHMARKS: Record<string, { pct: number; badge: string; note: string }> = {
  hot_flash: { pct: 73, badge: 'Very common', note: '73% of perimenopausal women experience hot flashes' },
  brain_fog: { pct: 60, badge: 'Very common', note: 'Brain fog affects ~60% of women during menopause transition' },
  irritability: { pct: 70, badge: 'Very common', note: 'Mood changes affect ~70% of women in perimenopause' },
  joint_pain: { pct: 50, badge: 'Common', note: 'Joint pain affects about half of menopausal women' },
  anxiety: { pct: 51, badge: 'Common', note: 'Anxiety is reported by ~51% of women during menopause' },
  fatigue: { pct: 85, badge: 'Very common', note: 'Fatigue is the #1 reported symptom at 85%' },
  nausea: { pct: 25, badge: 'Less common', note: 'Nausea affects about 1 in 4 menopausal women' },
  heart_racing: { pct: 40, badge: 'Common', note: 'Heart palpitations affect ~40% — it\'s hormonal, not cardiac' },
};

/* ─── Recommendations (hardcoded for V2) ─── */
const RECOMMENDATIONS: Record<string, string[]> = {
  hot_flash: ['Layer clothing for easy removal', 'Keep a fan nearby at night', 'Avoid spicy food and alcohol before bed'],
  brain_fog: ['Break tasks into smaller steps', 'Write things down — lists help', 'Prioritize sleep — it\'s #1 for cognition'],
  irritability: ['Take 3 deep breaths when triggered', 'Communicate your needs to loved ones', 'Regular exercise helps regulate mood'],
  joint_pain: ['Gentle stretching each morning', 'Anti-inflammatory foods (omega-3, turmeric)', 'Stay hydrated throughout the day'],
  anxiety: ['5 minutes of deep breathing daily', 'Limit caffeine after noon', 'Journal your worries — it reduces rumination'],
  fatigue: ['Consistent sleep/wake times', 'Short walks boost energy more than caffeine', 'Iron-rich foods may help'],
  nausea: ['Eat small, frequent meals', 'Ginger tea can help', 'Avoid lying down right after eating'],
  heart_racing: ['Deep breathing exercises', 'Reduce caffeine intake', 'Know that hormonal palpitations are typically benign'],
};

interface LogEntry {
  id: number;
  date: string;
  symptomsJson: Record<string, any> | null;
  contextTags: string[] | null;
  logType: string | null;
  loggedAt: string | null;
}

export default function SymptomDetailScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { symptom } = useLocalSearchParams<{ symptom?: string }>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const symptomKey = (symptom || '').toLowerCase().replace(/\s+/g, '_');
  const symptomLabel = (symptom || '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          if (!hasLoadedOnce.current) setLoading(true);
          const token = await getToken();
          const data = await apiRequest('/api/logs?range=28d', token).catch(() => []);
          setLogs(Array.isArray(data) ? data : []);
          hasLoadedOnce.current = true;
        } catch {
          hasLoadedOnce.current = true;
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  // Days affected
  const daysAffected = useMemo(() => {
    const dates = new Set<string>();
    logs.forEach((l) => {
      if (l.symptomsJson && symptomKey in l.symptomsJson) {
        dates.add(l.date);
      }
    });
    return dates.size;
  }, [logs, symptomKey]);

  // Average severity
  const avgSeverity = useMemo(() => {
    const vals: number[] = [];
    logs.forEach((l) => {
      if (l.symptomsJson && symptomKey in l.symptomsJson) {
        const v = l.symptomsJson[symptomKey];
        if (typeof v === 'number') vals.push(v);
        else if (v?.severity) vals.push(v.severity);
      }
    });
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [logs, symptomKey]);

  // Severity chart data (last 28 days)
  const chartData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    logs.forEach((l) => {
      if (l.symptomsJson && symptomKey in l.symptomsJson) {
        const v = l.symptomsJson[symptomKey];
        const sev = typeof v === 'number' ? v : v?.severity || 0;
        dayMap[l.date] = Math.max(dayMap[l.date] || 0, sev);
      }
    });
    // Build 28-day array
    const today = new Date();
    const bars: { date: string; sev: number }[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      bars.push({ date: dateStr, sev: dayMap[dateStr] || 0 });
    }
    return bars;
  }, [logs, symptomKey]);

  // Top triggers
  const triggers = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    let symptomDays = 0;
    logs.forEach((l) => {
      if (l.symptomsJson && symptomKey in l.symptomsJson) {
        symptomDays++;
        (l.contextTags || []).forEach((t) => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });
    const total = symptomDays || 1;
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [logs, symptomKey]);

  // Benchmark data
  const benchmark = BENCHMARKS[symptomKey];
  const recs = RECOMMENDATIONS[symptomKey] || [];

  // % change vs previous 28 days (mock: we only have 28 days total)
  const halfIdx = Math.floor(logs.length / 2);
  const firstHalfCount = logs.slice(0, halfIdx).filter((l) => l.symptomsJson && symptomKey in l.symptomsJson).length;
  const secondHalfCount = logs.slice(halfIdx).filter((l) => l.symptomsJson && symptomKey in l.symptomsJson).length;
  const changePct = firstHalfCount > 0
    ? Math.round(((secondHalfCount - firstHalfCount) / firstHalfCount) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.nav}>
        <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.9} style={styles.navSide}>
          <Text style={styles.navBackText}>← Back</Text>
        </AnimatedPressable>
        <Text style={styles.navTitle}>Symptom Detail</Text>
        <View style={styles.navSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : (
          <>
            {/* Title */}
            <Text style={styles.title}>{symptomLabel}</Text>
            <Text style={styles.subtitle}>28-day detail view</Text>

            {/* Severity chart */}
            <View style={styles.chartSection}>
              <Text style={styles.sectionLabel}>Severity over time</Text>
              <View style={styles.chartRow}>
                {chartData.map((bar, i) => (
                  <View key={i} style={styles.chartBarCol}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: bar.sev === 0 ? 2 : bar.sev * 14,
                          backgroundColor:
                            bar.sev === 0 ? '#e7e5e4'
                            : bar.sev === 1 ? '#fde68a'
                            : bar.sev === 2 ? '#fbbf24'
                            : '#f43f5e',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.chartLabels}>
                <Text style={styles.chartLabelText}>4 weeks ago</Text>
                <Text style={styles.chartLabelText}>Today</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{daysAffected}</Text>
                <Text style={styles.statLabel}>Days affected</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{avgSeverity > 0 ? avgSeverity.toFixed(1) : '—'}</Text>
                <Text style={styles.statLabel}>Avg severity</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: changePct < 0 ? '#059669' : changePct > 0 ? '#d97706' : '#a8a29e' }]}>
                  {changePct > 0 ? `+${changePct}%` : changePct < 0 ? `${changePct}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>vs last period</Text>
              </View>
            </View>

            {/* Triggers */}
            {triggers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your triggers</Text>
                <View style={{ gap: 12 }}>
                  {triggers.map((t) => (
                    <View key={t.tag}>
                      <View style={styles.triggerRow}>
                        <Text style={styles.triggerLabel}>{t.tag}</Text>
                        <Text style={styles.triggerPct}>{t.pct}%</Text>
                      </View>
                      <View style={styles.triggerBarBg}>
                        <View style={[styles.triggerBarFill, { width: `${t.pct}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Benchmark */}
            {benchmark && (
              <View style={styles.benchmarkCard}>
                <View style={styles.benchmarkBadge}>
                  <Text style={styles.benchmarkBadgeText}>{benchmark.badge}</Text>
                </View>
                <Text style={styles.benchmarkNote}>{benchmark.note}</Text>
                <View style={styles.benchmarkBar}>
                  <View style={[styles.benchmarkBarFill, { width: `${benchmark.pct}%` }]} />
                  <View style={[styles.benchmarkYouDot, { left: `${Math.min(daysAffected / 28 * 100, 95)}%` }]}>
                    <Text style={styles.benchmarkYouLabel}>You</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Recommendations */}
            {recs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Based on your data — try this</Text>
                <View style={{ gap: 8 }}>
                  {recs.map((rec, i) => (
                    <View key={i} style={styles.recCard}>
                      <Text style={styles.recIcon}>💡</Text>
                      <Text style={styles.recText}>{rec}</Text>
                    </View>
                  ))}
                </View>
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
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },
  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 60 },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  navSide: { width: 60 },
  navBackText: { fontSize: 13, color: '#a8a29e' },
  navTitle: { fontSize: 13, color: '#a8a29e', fontWeight: '500' },

  title: { fontSize: 24, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#a8a29e', marginBottom: 24 },

  /* Chart */
  chartSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#78716c', marginBottom: 10 },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 50,
    gap: 2,
  },
  chartBarCol: { flex: 1, justifyContent: 'flex-end' },
  chartBar: { borderRadius: 2 },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chartLabelText: { fontSize: 10, color: '#a8a29e' },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1c1917', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#a8a29e' },

  /* Triggers */
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginBottom: 12 },
  triggerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  triggerLabel: { fontSize: 12, color: '#44403c' },
  triggerPct: { fontSize: 12, color: '#a8a29e' },
  triggerBarBg: { height: 6, backgroundColor: '#f5f5f4', borderRadius: 3 },
  triggerBarFill: { height: 6, backgroundColor: '#44403c', borderRadius: 3 },

  /* Benchmark */
  benchmarkCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  benchmarkBadge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  benchmarkBadgeText: { fontSize: 11, fontWeight: '600', color: '#78716c' },
  benchmarkNote: { fontSize: 13, color: '#44403c', lineHeight: 18, marginBottom: 12 },
  benchmarkBar: {
    height: 8,
    backgroundColor: '#e7e5e4',
    borderRadius: 4,
    position: 'relative',
  },
  benchmarkBarFill: {
    height: 8,
    backgroundColor: '#a8a29e',
    borderRadius: 4,
  },
  benchmarkYouDot: {
    position: 'absolute',
    top: -8,
    alignItems: 'center',
  },
  benchmarkYouLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1c1917',
    backgroundColor: '#fbbf24',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  /* Recommendations */
  recCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  recIcon: { fontSize: 16, marginTop: 1 },
  recText: { fontSize: 13, color: '#44403c', flex: 1, lineHeight: 18 },
});

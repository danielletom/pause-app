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
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

interface Cycle {
  id: number;
  startDate: string;
  endDate: string | null;
  periodLength: number | null;
  cycleLength: number | null;
  peakFlow: string | null;
  dominantMood: string | null;
  status: string;
  spottingEvents: number | null;
}

function flowColor(flow: string | null): { bg: string; text: string; label: string } {
  switch (flow) {
    case 'heavy': case 'very_heavy':
      return { bg: '#ffe4e6', text: '#e11d48', label: flow === 'very_heavy' ? 'Very heavy' : 'Heavy' };
    case 'medium':
      return { bg: '#fff7ed', text: '#ea580c', label: 'Medium' };
    case 'light':
      return { bg: '#ecfdf5', text: '#059669', label: 'Light' };
    default:
      return { bg: '#f5f5f4', text: '#78716c', label: flow || '—' };
  }
}

function moodLabel(mood: string | null): string {
  switch (mood) {
    case 'good': return '😊 Good';
    case 'ok': return '😐 Okay';
    case 'low': return '😔 Low';
    case 'anxious': return '😰 Anxious';
    case 'tearful': return '😢 Tearful';
    default: return '—';
  }
}

export default function PeriodHistoryScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchCycles = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const data = await apiRequest('/api/period/cycles', token);
      setCycles(Array.isArray(data) ? data : []);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchCycles(); }, [fetchCycles]));

  const avgCycleLen = cycles.filter(c => c.cycleLength).length > 0
    ? Math.round(cycles.filter(c => c.cycleLength).reduce((a, c) => a + (c.cycleLength ?? 0), 0) / cycles.filter(c => c.cycleLength).length)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topBar}>
          <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.97}>
            <Text style={styles.backBtn}>← Tracker</Text>
          </AnimatedPressable>
          <Text style={styles.title}>Cycle History</Text>
          <Text style={styles.subtitle}>{cycles.length} cycle{cycles.length !== 1 ? 's' : ''} tracked</Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#f43f5e" />
          </View>
        ) : (
          <>
            {/* Timeline bar chart */}
            {cycles.filter(c => c.cycleLength).length >= 2 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartLabel}>Cycle length over time</Text>
                <View style={{ gap: 6 }}>
                  {cycles.filter(c => c.cycleLength).slice(0, 10).map(c => {
                    const len = c.cycleLength ?? 30;
                    const maxLen = 55;
                    const width = Math.max(20, (len / maxLen) * 100);
                    const isLong = len > 45;
                    const isShort = len < 25;
                    return (
                      <View key={c.id} style={styles.chartRow}>
                        <Text style={styles.chartDate}>
                          {new Date(c.startDate).toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                        <View style={styles.chartBarBg}>
                          <View style={[
                            styles.chartBar,
                            { width: `${width}%`, backgroundColor: isLong ? '#f43f5e' : isShort ? '#fbbf24' : '#fda4af' },
                          ]} />
                          <Text style={styles.chartBarLabel}>{len}d</Text>
                        </View>
                        <Text style={{ fontSize: 12 }}>
                          {c.peakFlow === 'heavy' || c.peakFlow === 'very_heavy' ? '🔴' : c.peakFlow === 'medium' ? '🟠' : '🟡'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#f43f5e' }]} />
                    <Text style={styles.legendText}>Long (&gt;45d)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#fda4af' }]} />
                    <Text style={styles.legendText}>Normal</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} />
                    <Text style={styles.legendText}>Short (&lt;25d)</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Individual cycle cards */}
            <Text style={styles.sectionTitle}>All cycles</Text>
            {cycles.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 12, color: '#a8a29e', textAlign: 'center' }}>No cycles logged yet. Log your first period to start tracking.</Text>
              </View>
            )}
            <View style={{ gap: 6 }}>
              {cycles.map(c => {
                const expanded = expandedId === c.id;
                const fc = flowColor(c.peakFlow);
                return (
                  <AnimatedPressable
                    key={c.id}
                    onPress={() => { hapticSelection(); setExpandedId(expanded ? null : c.id); }}
                    scaleDown={0.98}
                    style={[styles.cycleCard, expanded && { borderColor: '#fecdd3', backgroundColor: '#fff1f2' }]}
                  >
                    <View style={styles.cycleHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cycleDate}>
                          {new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {c.endDate ? ` – ${new Date(c.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' (active)'}
                        </Text>
                        <Text style={styles.cycleSub}>
                          {c.periodLength ? `${c.periodLength} day period` : '—'} · {c.cycleLength ? `${c.cycleLength} day cycle` : 'active'}
                        </Text>
                      </View>
                      <View style={[styles.flowBadge, { backgroundColor: fc.bg }]}>
                        <Text style={[styles.flowBadgeText, { color: fc.text }]}>{fc.label}</Text>
                      </View>
                      <Text style={[styles.chevron, expanded && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
                    </View>

                    {expanded && (
                      <View style={styles.cycleDetails}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Mood</Text>
                          <Text style={styles.detailValue}>{moodLabel(c.dominantMood)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Cycle length</Text>
                          <Text style={[styles.detailValue, c.cycleLength && c.cycleLength > 45 ? { color: '#f43f5e' } : c.cycleLength && c.cycleLength < 25 ? { color: '#fbbf24' } : {}]}>
                            {c.cycleLength ? `${c.cycleLength} days` : '—'}
                          </Text>
                        </View>
                        {c.spottingEvents != null && c.spottingEvents > 0 && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Spotting events</Text>
                            <Text style={styles.detailValue}>{c.spottingEvents}</Text>
                          </View>
                        )}
                        {avgCycleLen && c.cycleLength && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>vs average</Text>
                            <Text style={[styles.detailValue, { fontWeight: '600', color: c.cycleLength > avgCycleLen ? '#f43f5e' : '#14b8a6' }]}>
                              {c.cycleLength > avgCycleLen
                                ? `+${c.cycleLength - avgCycleLen} days longer`
                                : c.cycleLength < avgCycleLen
                                ? `${avgCycleLen - c.cycleLength} days shorter`
                                : 'On average'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </AnimatedPressable>
                );
              })}
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

  chartCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f5f5f4', marginBottom: 16,
  },
  chartLabel: { fontSize: 12, color: '#a8a29e', fontWeight: '500', marginBottom: 10 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartDate: { fontSize: 10, color: '#a8a29e', width: 30, textAlign: 'right' },
  chartBarBg: { flex: 1, height: 20, backgroundColor: '#f5f5f4', borderRadius: 6, overflow: 'hidden', position: 'relative', justifyContent: 'center' },
  chartBar: { height: '100%', borderRadius: 6 },
  chartBarLabel: { position: 'absolute', right: 8, fontSize: 10, color: '#78716c' },
  chartLegend: { flexDirection: 'row', gap: 12, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f4' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#a8a29e' },

  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#57534e', marginBottom: 8 },
  emptyCard: {
    backgroundColor: '#fff1f2', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#fecdd3',
  },

  cycleCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#f5f5f4',
  },
  cycleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cycleDate: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  cycleSub: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  flowBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  flowBadgeText: { fontSize: 11, fontWeight: '500' },
  chevron: { fontSize: 12, color: '#d6d3d1' },

  cycleDetails: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f5f5f4', gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: '#a8a29e' },
  detailValue: { fontSize: 12, color: '#44403c' },
});

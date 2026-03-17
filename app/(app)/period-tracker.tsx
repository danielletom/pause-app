import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { hapticMedium, hapticLight, hapticSelection, hapticSuccess } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ─── Types ───────────────────────────────────────────── */

interface BleedingEvent {
  id: number;
  eventDate: string;
  type: string;
  flowIntensity: string | null;
  sourceCategory: string;
}

interface Analytics {
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  predictedNextStart: string | null;
  predictionConfidence: string | null;
  stage: string | null;
}

/* ─── Date helpers ────────────────────────────────────── */

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getMonthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getWeeksForMonth(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = [];

  // Pad start
  for (let i = 0; i < startDow; i++) {
    week.push(null);
  }

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    week.push(toDateStr(d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  // Pad end
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return weeks;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

const FLOW_OPTIONS: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'none', label: 'None', color: '#78716c', bg: '#f5f5f4' },
  { key: 'spotting', label: 'Spotting', color: '#db2777', bg: '#fce7f3' },
  { key: 'light', label: 'Light', color: '#f472b6', bg: '#fce7f3' },
  { key: 'medium', label: 'Medium', color: '#e11d48', bg: '#ffe4e6' },
  { key: 'heavy', label: 'Heavy', color: '#be123c', bg: '#ffe4e6' },
];

/* ─── Component ───────────────────────────────────────── */

export default function PeriodTrackerScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Data
  const [events, setEvents] = useState<Record<string, BleedingEvent>>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Calendar grid
  const weeks = useMemo(
    () => getWeeksForMonth(currentMonth.year, currentMonth.month),
    [currentMonth.year, currentMonth.month]
  );
  const monthLabel = useMemo(
    () => getMonthLabel(new Date(currentMonth.year, currentMonth.month)),
    [currentMonth.year, currentMonth.month]
  );

  // Swipe to change month
  const swipeX = useRef(new RNAnimated.Value(0)).current;
  const monthSwipePan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => { swipeX.setValue(g.dx * 0.3); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) {
        goToMonth(1);
      } else if (g.dx > 50) {
        goToMonth(-1);
      }
      RNAnimated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
    },
  }), []);

  const goToMonth = useCallback((delta: number) => {
    hapticSelection();
    setCurrentMonth(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  }, []);

  // Fetch events for current month
  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getToken();

      // Get events for the visible month (plus 6 days padding for grid edges)
      const from = toDateStr(new Date(currentMonth.year, currentMonth.month, 1));
      const to = toDateStr(new Date(currentMonth.year, currentMonth.month + 1, 6));

      const [eventsData, analyticsData] = await Promise.all([
        apiRequest(`/api/period/events?from=${from}&to=${to}`, token).catch(() => []),
        !hasLoadedOnce.current
          ? apiRequest('/api/period/cycles/analytics', token).catch(() => null)
          : Promise.resolve(analytics),
      ]);

      // Index events by date
      const eventMap: Record<string, BleedingEvent> = {};
      if (Array.isArray(eventsData)) {
        eventsData.forEach((e: BleedingEvent) => {
          // Keep the most significant event per date
          if (!eventMap[e.eventDate] || getFlowRank(e.flowIntensity) > getFlowRank(eventMap[e.eventDate].flowIntensity)) {
            eventMap[e.eventDate] = e;
          }
        });
      }
      setEvents(eventMap);
      if (analyticsData) setAnalytics(analyticsData);
      hasLoadedOnce.current = true;
    } catch {
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [getToken, currentMonth.year, currentMonth.month]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // Save/update/delete flow for a date
  const handleFlowSelect = useCallback(async (flowKey: string) => {
    if (!selectedDate || saving) return;
    setSaving(true);
    hapticMedium();

    try {
      const token = await getToken();
      const existingEvent = events[selectedDate];

      if (flowKey === 'none') {
        // Delete existing event
        if (existingEvent) {
          await apiRequest(`/api/period/events/${existingEvent.id}`, token, { method: 'DELETE' });
        }
      } else if (existingEvent) {
        // Update existing event
        await apiRequest(`/api/period/events/${existingEvent.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({ flowIntensity: flowKey }),
        });
      } else {
        // Create new event
        // Determine type: if there's a period event the day before, it's period_daily; otherwise period_start
        const yesterday = new Date(selectedDate + 'T12:00:00');
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toDateStr(yesterday);
        const prevEvent = events[yesterdayStr];
        const isPeriodContinuation = prevEvent && ['period_start', 'period_daily'].includes(prevEvent.type);

        const type = flowKey === 'spotting' ? 'spotting' : (isPeriodContinuation ? 'period_daily' : 'period_start');
        const sourceCategory = flowKey === 'spotting' ? 'spotting' : 'period';

        await apiRequest('/api/period/events', token, {
          method: 'POST',
          body: JSON.stringify({
            type,
            eventDate: selectedDate,
            flowIntensity: flowKey,
            sourceCategory,
          }),
        });
      }

      // Refresh data
      await fetchData();
      hapticSuccess();
    } catch {
      // Silently fail — data will refresh on next load
    } finally {
      setSaving(false);
    }
  }, [selectedDate, events, getToken, fetchData, saving]);

  const currentFlow = selectedDate ? (events[selectedDate]?.flowIntensity || 'none') : 'none';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <BackButton />
          <AnimatedPressable
            onPress={() => { hapticLight(); router.push('/(app)/period-settings'); }}
            scaleDown={0.9}
            style={s.settingsBtn}
          >
            <Text style={s.settingsIcon}>⚙</Text>
          </AnimatedPressable>
        </View>
        <Text style={s.title}>Period Tracker</Text>
        <Text style={s.subtitle}>Tap any date to log your flow</Text>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : (
          <>
            {/* Month navigation */}
            <View style={s.monthNav}>
              <AnimatedPressable onPress={() => goToMonth(-1)} scaleDown={0.9} style={s.monthArrow}>
                <Text style={s.monthArrowText}>‹</Text>
              </AnimatedPressable>
              <Text style={s.monthLabel}>{monthLabel}</Text>
              <AnimatedPressable onPress={() => goToMonth(1)} scaleDown={0.9} style={s.monthArrow}>
                <Text style={s.monthArrowText}>›</Text>
              </AnimatedPressable>
            </View>

            {/* Day-of-week headers */}
            <View style={s.dowRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <View key={i} style={s.dowCell}>
                  <Text style={s.dowText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View {...monthSwipePan.panHandlers}>
              <RNAnimated.View style={{ transform: [{ translateX: swipeX }] }}>
                {weeks.map((week, wi) => (
                  <View key={wi} style={s.weekRow}>
                    {week.map((dateStr, di) => {
                      if (!dateStr) {
                        return <View key={`empty-${di}`} style={s.dayCell} />;
                      }

                      const event = events[dateStr];
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDate;
                      const isFuture = dateStr > todayStr;
                      const dayNum = parseInt(dateStr.split('-')[2], 10);
                      const flow = event?.flowIntensity;

                      return (
                        <AnimatedPressable
                          key={dateStr}
                          onPress={() => {
                            if (isFuture) return;
                            hapticSelection();
                            setSelectedDate(prev => prev === dateStr ? null : dateStr);
                          }}
                          scaleDown={0.85}
                          style={s.dayCell}
                        >
                          <View style={[
                            s.dayCircle,
                            flow && getDayStyle(flow),
                            isToday && !flow && s.dayCircleToday,
                            isSelected && s.dayCircleSelected,
                            isFuture && s.dayFuture,
                          ]}>
                            <Text style={[
                              s.dayNum,
                              flow && s.dayNumPeriod,
                              (flow === 'medium' || flow === 'heavy' || flow === 'very_heavy') && s.dayNumDark,
                              isFuture && s.dayNumFuture,
                              isToday && !flow && s.dayNumToday,
                            ]}>
                              {dayNum}
                            </Text>
                          </View>
                          {flow === 'spotting' && (
                            <View style={s.spottingDot} />
                          )}
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                ))}
              </RNAnimated.View>
            </View>

            {/* Day detail panel */}
            {selectedDate && (
              <View style={s.detailPanel}>
                <Text style={s.detailDate}>{formatDayHeader(selectedDate)}</Text>
                <View style={s.flowRow}>
                  {FLOW_OPTIONS.map((opt) => {
                    const isActive = currentFlow === opt.key;
                    return (
                      <AnimatedPressable
                        key={opt.key}
                        onPress={() => handleFlowSelect(opt.key)}
                        scaleDown={0.9}
                        style={[
                          s.flowChip,
                          isActive && { backgroundColor: opt.bg, borderColor: opt.color },
                        ]}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color={opt.color} />
                        ) : (
                          <Text style={[
                            s.flowChipText,
                            isActive && { color: opt.color, fontWeight: '700' },
                          ]}>
                            {opt.label}
                          </Text>
                        )}
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Stats row */}
            {analytics && (analytics.avgCycleLength || analytics.avgPeriodLength || analytics.predictedNextStart) && (
              <View style={s.statsRow}>
                {analytics.avgCycleLength && (
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Cycle</Text>
                    <Text style={s.statValue}>{Math.round(analytics.avgCycleLength)}d</Text>
                    <Text style={s.statSub}>average</Text>
                  </View>
                )}
                {analytics.avgPeriodLength && (
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Period</Text>
                    <Text style={s.statValue}>{Math.round(analytics.avgPeriodLength)}d</Text>
                    <Text style={s.statSub}>average</Text>
                  </View>
                )}
                {analytics.predictedNextStart && (
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Next</Text>
                    <Text style={s.statValue}>
                      {new Date(analytics.predictedNextStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={s.statSub}>predicted</Text>
                  </View>
                )}
              </View>
            )}

            {/* Empty state */}
            {!analytics?.avgCycleLength && !analytics?.avgPeriodLength && Object.keys(events).length === 0 && (
              <View style={s.emptyCard}>
                <Text style={s.emptyIcon}>🩸</Text>
                <Text style={s.emptyTitle}>Start tracking your cycle</Text>
                <Text style={s.emptyBody}>
                  Tap any date above to log when your period started. We'll track patterns and predict future cycles.
                </Text>
              </View>
            )}

            {/* Stage indicator */}
            {analytics?.stage && (
              <View style={s.stageCard}>
                <Text style={s.stageLabel}>Stage</Text>
                <Text style={s.stageValue}>
                  {analytics.stage === 'early_peri' ? 'Early perimenopause' :
                   analytics.stage === 'mid_peri' ? 'Mid perimenopause' :
                   analytics.stage === 'late_peri' ? 'Late perimenopause' :
                   analytics.stage === 'approaching_menopause' ? 'Approaching menopause' :
                   analytics.stage}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */

function getFlowRank(flow: string | null): number {
  switch (flow) {
    case 'very_heavy': return 5;
    case 'heavy': return 4;
    case 'medium': return 3;
    case 'light': return 2;
    case 'spotting': return 1;
    default: return 0;
  }
}

function getDayStyle(flow: string | null): any {
  switch (flow) {
    case 'heavy':
    case 'very_heavy':
      return { backgroundColor: '#e11d48' };
    case 'medium':
      return { backgroundColor: '#fb7185' };
    case 'light':
      return { backgroundColor: '#fda4af' };
    case 'spotting':
      return { backgroundColor: '#fce7f3' };
    default:
      return null;
  }
}

/* ─── Styles ──────────────────────────────────────────── */

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafaf9' },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f4', alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { fontSize: 18 },
  title: { fontSize: 26, fontWeight: '700', color: '#1c1917', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#a8a29e', marginBottom: 20 },

  // Month nav
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f4', alignItems: 'center', justifyContent: 'center' },
  monthArrowText: { fontSize: 24, fontWeight: '500', color: '#78716c', marginTop: -2 },
  monthLabel: { fontSize: 18, fontWeight: '600', color: '#1c1917' },

  // Day of week headers
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dowCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dowText: { fontSize: 13, fontWeight: '500', color: '#a8a29e' },

  // Calendar grid
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 48 },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: '#1c1917',
  },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  dayFuture: { opacity: 0.3 },
  dayNum: { fontSize: 15, fontWeight: '500', color: '#44403c' },
  dayNumPeriod: { color: '#fff' },
  dayNumDark: { color: '#fff', fontWeight: '700' },
  dayNumFuture: { color: '#d6d3d1' },
  dayNumToday: { color: '#1c1917', fontWeight: '700' },
  spottingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#db2777',
    marginTop: 1,
  },

  // Detail panel
  detailPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  detailDate: { fontSize: 15, fontWeight: '600', color: '#1c1917', marginBottom: 14 },
  flowRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  flowChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
    backgroundColor: '#ffffff',
    minWidth: 60,
    alignItems: 'center',
  },
  flowChipText: { fontSize: 13, fontWeight: '500', color: '#78716c' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  statLabel: { fontSize: 12, fontWeight: '500', color: '#a8a29e', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1c1917' },
  statSub: { fontSize: 11, color: '#d6d3d1', marginTop: 2 },

  // Empty state
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1c1917', marginBottom: 6 },
  emptyBody: { fontSize: 14, color: '#78716c', textAlign: 'center', lineHeight: 20 },

  // Stage
  stageCard: {
    backgroundColor: '#fdf2f8',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#fce7f3',
  },
  stageLabel: { fontSize: 12, fontWeight: '600', color: '#be185d' },
  stageValue: { fontSize: 14, fontWeight: '500', color: '#9d174d', flex: 1 },

  // Loading
  loadingBox: { paddingTop: 80, alignItems: 'center' },
});

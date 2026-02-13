import React, { useState, useCallback, useMemo } from 'react';
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

/* ─── Helpers ─────────────────────────────────────────────── */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateStr(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-start: 0=Mon 6=Sun */
function startDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1;
}

type LogEntry = {
  id: number;
  date: string;
  logType: string | null;
  mood: number | null;
  energy: number | null;
  sleepHours: number | null;
  sleepQuality: string | null;
  symptomsJson: any;
  cycleDataJson: any;
  notes: string | null;
};

/* ─── Component ───────────────────────────────────────────── */

export default function CalendarScreen() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [curYear, setCurYear] = useState(new Date().getFullYear());
  const [curMonth, setCurMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Fetch logs for the visible month ── */
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      // Fetch ~45 days to cover the month even if we're mid-month
      const data = await apiRequest('/api/logs?range=45d', token).catch(() => []);
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      fetchLogs();
    }, [fetchLogs])
  );

  /* ── Index logs by date ── */
  const logsByDate = useMemo(() => {
    const map: Record<string, LogEntry[]> = {};
    for (const log of logs) {
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    }
    return map;
  }, [logs]);

  /* ── Month navigation ── */
  const goBack = () => {
    hapticLight();
    setSelectedDay(null);
    if (curMonth === 0) { setCurYear(curYear - 1); setCurMonth(11); }
    else setCurMonth(curMonth - 1);
  };
  const goForward = () => {
    hapticLight();
    setSelectedDay(null);
    if (curMonth === 11) { setCurYear(curYear + 1); setCurMonth(0); }
    else setCurMonth(curMonth + 1);
  };

  /* ── Build grid cells ── */
  const totalDays = daysInMonth(curYear, curMonth);
  const offset = startDayOffset(curYear, curMonth);
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  /* ── Adherence calculation ── */
  const now = new Date();
  const isCurrentMonth = curYear === now.getFullYear() && curMonth === now.getMonth();
  const daysElapsed = isCurrentMonth ? now.getDate() : totalDays;

  let amCount = 0;
  let pmCount = 0;
  for (let d = 1; d <= daysElapsed; d++) {
    const dateStr = toDateStr(curYear, curMonth, d);
    const dayLogs = logsByDate[dateStr] || [];
    if (dayLogs.some(l => l.logType === 'morning')) amCount++;
    if (dayLogs.some(l => l.logType === 'evening')) pmCount++;
  }
  const adherencePct = daysElapsed > 0 ? Math.round((amCount / daysElapsed) * 100) : 0;

  /* ── Selected day detail ── */
  const selectedDateStr = selectedDay ? toDateStr(curYear, curMonth, selectedDay) : null;
  const selectedLogs = selectedDateStr ? (logsByDate[selectedDateStr] || []) : [];
  const morningLog = selectedLogs.find(l => l.logType === 'morning');
  const eveningLog = selectedLogs.find(l => l.logType === 'evening');
  const periodLog = selectedLogs.find(l => l.cycleDataJson && (l.cycleDataJson as any).status && (l.cycleDataJson as any).status !== 'none');

  const isToday = isCurrentMonth && selectedDay === now.getDate();
  const isPast = selectedDateStr ? selectedDateStr < now.toISOString().split('T')[0] : false;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.92} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Month nav */}
        <View style={styles.monthNav}>
          <AnimatedPressable onPress={goBack} scaleDown={0.9} style={styles.navArrow}>
            <Text style={styles.navArrowText}>←</Text>
          </AnimatedPressable>
          <Text style={styles.monthLabel}>{MONTHS[curMonth]} {curYear}</Text>
          <AnimatedPressable onPress={goForward} scaleDown={0.9} style={styles.navArrow}>
            <Text style={styles.navArrowText}>→</Text>
          </AnimatedPressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : (
          <>
            {/* Weekday headers */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={styles.weekDay}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (day === null) return <View key={idx} style={styles.dayCell} />;
                const dateStr = toDateStr(curYear, curMonth, day);
                const dayLogs = logsByDate[dateStr] || [];
                const hasMorning = dayLogs.some(l => l.logType === 'morning');
                const hasEvening = dayLogs.some(l => l.logType === 'evening');
                const hasPeriod = dayLogs.some(l => l.cycleDataJson && (l.cycleDataJson as any).status && (l.cycleDataJson as any).status !== 'none');
                const isSelected = day === selectedDay;
                const isTodayCell = isCurrentMonth && day === now.getDate();

                return (
                  <AnimatedPressable
                    key={idx}
                    onPress={() => { hapticSelection(); setSelectedDay(day); }}
                    scaleDown={0.92}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                  >
                    <Text style={[
                      styles.dayNumber,
                      isSelected && styles.dayNumberSelected,
                      isTodayCell && !isSelected && styles.dayNumberToday,
                    ]}>
                      {day}
                    </Text>
                    <View style={styles.dotRow}>
                      <View style={[styles.dot, hasMorning ? styles.dotAM : styles.dotEmpty]} />
                      <View style={[styles.dot, hasEvening ? styles.dotPM : styles.dotEmpty]} />
                      {hasPeriod && <View style={[styles.dot, styles.dotPeriod]} />}
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* Adherence card */}
            <View style={styles.adherenceCard}>
              <View style={styles.adherenceTop}>
                <Text style={styles.adherencePct}>{adherencePct}%</Text>
                <Text style={styles.adherenceLabel}>Check-in rate this month</Text>
              </View>
              <View style={styles.adherenceRows}>
                <View style={styles.adherenceRow}>
                  <View style={[styles.adherenceDotBig, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.adherenceRowLabel}>AM check-ins</Text>
                  <Text style={styles.adherenceRowValue}>{amCount}/{daysElapsed}</Text>
                </View>
                <View style={styles.adherenceRow}>
                  <View style={[styles.adherenceDotBig, { backgroundColor: '#818cf8' }]} />
                  <Text style={styles.adherenceRowLabel}>PM check-ins</Text>
                  <Text style={styles.adherenceRowValue}>{pmCount}/{daysElapsed}</Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.min(adherencePct, 100)}%` }]} />
              </View>
            </View>

            {/* Day detail */}
            {selectedDay !== null && (
              <View style={styles.dayDetailSection}>
                <Text style={styles.dayDetailTitle}>
                  {MONTHS[curMonth]} {selectedDay}{isToday ? ' · Today' : ''}
                </Text>

                {morningLog ? (
                  <View style={[styles.detailCard, styles.detailCardAM]}>
                    <Text style={styles.detailCardIcon}>☀️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailCardTitle}>Morning check-in</Text>
                      <Text style={styles.detailCardMeta}>
                        {morningLog.sleepHours ? `${morningLog.sleepHours}h sleep` : ''}
                        {morningLog.sleepHours && morningLog.mood ? ' · ' : ''}
                        {morningLog.mood ? `Mood ${morningLog.mood}/5` : ''}
                        {(morningLog.sleepHours || morningLog.mood) && morningLog.symptomsJson ? ' · ' : ''}
                        {morningLog.symptomsJson ? `${Array.isArray(morningLog.symptomsJson) ? morningLog.symptomsJson.length : 0} symptoms` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {eveningLog ? (
                  <View style={[styles.detailCard, styles.detailCardPM]}>
                    <Text style={styles.detailCardIcon}>🌙</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailCardTitle}>Evening reflection</Text>
                      <Text style={styles.detailCardMeta}>
                        {eveningLog.mood ? `Day rating ${eveningLog.mood}/5` : ''}
                        {eveningLog.notes ? ' · Has notes' : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {periodLog ? (
                  <View style={[styles.detailCard, styles.detailCardPeriod]}>
                    <Text style={styles.detailCardIcon}>🩸</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailCardTitle}>Period day</Text>
                      <Text style={styles.detailCardMeta}>
                        {(periodLog.cycleDataJson as any)?.status === 'period' ? 'Period' : 'Spotting'}
                        {(periodLog.cycleDataJson as any)?.flow ? ` · ${(periodLog.cycleDataJson as any).flow} flow` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {!morningLog && !eveningLog && !periodLog && (
                  <View style={styles.emptyDayCard}>
                    <Text style={styles.emptyDayText}>No check-ins logged</Text>
                    {(isPast || isToday) && (
                      <AnimatedPressable
                        onPress={() => { hapticLight(); router.push('/(app)/log'); }}
                        scaleDown={0.97}
                        style={styles.logNowBtn}
                      >
                        <Text style={styles.logNowText}>Log this day now →</Text>
                      </AnimatedPressable>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  loadingContainer: { flex: 1, paddingTop: 80, alignItems: 'center' },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f5f4',
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 22, color: '#1c1917', marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1c1917' },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f5f5f4',
    alignItems: 'center', justifyContent: 'center',
  },
  navArrowText: { fontSize: 16, color: '#1c1917' },
  monthLabel: { fontSize: 16, fontWeight: '600', color: '#1c1917' },

  // Week headers
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekDay: {
    flex: 1, textAlign: 'center',
    fontSize: 11, fontWeight: '600', color: '#a8a29e',
    textTransform: 'uppercase',
  },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: `${100 / 7}%` as any,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: '#1c1917',
    borderRadius: 10,
  },
  dayNumber: {
    fontSize: 13, fontWeight: '500', color: '#1c1917',
    marginBottom: 3,
  },
  dayNumberSelected: { color: '#ffffff' },
  dayNumberToday: { color: '#f59e0b', fontWeight: '700' },
  dotRow: {
    flexDirection: 'row', gap: 3,
    alignItems: 'center',
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotAM: { backgroundColor: '#f59e0b' },
  dotPM: { backgroundColor: '#818cf8' },
  dotPeriod: { backgroundColor: '#fb7185' },
  dotEmpty: { backgroundColor: '#e7e5e4' },

  // Adherence card
  adherenceCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  adherenceTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 14,
  },
  adherencePct: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  adherenceLabel: { fontSize: 13, color: '#a8a29e' },
  adherenceRows: { gap: 8, marginBottom: 14 },
  adherenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adherenceDotBig: { width: 8, height: 8, borderRadius: 4 },
  adherenceRowLabel: { fontSize: 13, color: '#a8a29e', flex: 1 },
  adherenceRowValue: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  progressBg: {
    height: 6, backgroundColor: '#292524',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: 6, backgroundColor: '#f59e0b',
    borderRadius: 3,
  },

  // Day detail
  dayDetailSection: { gap: 8 },
  dayDetailTitle: {
    fontSize: 15, fontWeight: '600', color: '#1c1917',
    marginBottom: 4,
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  detailCardAM: { borderColor: '#fef3c7' },
  detailCardPM: { borderColor: '#e0e7ff' },
  detailCardPeriod: { borderColor: '#fecdd3' },
  detailCardIcon: { fontSize: 18 },
  detailCardTitle: { fontSize: 14, fontWeight: '600', color: '#1c1917' },
  detailCardMeta: { fontSize: 12, color: '#78716c', marginTop: 2 },

  // Empty day
  emptyDayCard: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyDayText: { fontSize: 13, color: '#a8a29e', marginBottom: 8 },
  logNowBtn: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logNowText: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
});

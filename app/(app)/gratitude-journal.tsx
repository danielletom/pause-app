import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, SafeAreaView, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ── Theme meta ──────────────────────────────────────────────────── */
const THEME_META: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  people:  { label: 'People',        emoji: '💛', color: '#f59e0b', bg: '#fffbeb', border: '#fef3c7' },
  health:  { label: 'My body',       emoji: '✨', color: '#10b981', bg: '#ecfdf5', border: '#d1fae5' },
  moments: { label: 'Small moments', emoji: '🌿', color: '#14b8a6', bg: '#f0fdfa', border: '#ccfbf1' },
  comfort: { label: 'Comfort',       emoji: '☕', color: '#f97316', bg: '#fff7ed', border: '#ffedd5' },
  growth:  { label: 'Growth',        emoji: '🌱', color: '#84cc16', bg: '#f7fee7', border: '#ecfccb' },
};

/* ── Helpers ──────────────────────────────────────────────────────── */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  if (diff < 7) return dayNames[d.getDay()];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${monthNames[d.getMonth()]} ${d.getDate()}`;
}

function groupByDate(entries: any[]): [string, any[]][] {
  const groups: Record<string, any[]> = {};
  entries.forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

interface GratitudeEntry {
  id: number;
  date: string;
  text: string;
  theme: string | null;
  mood: number | null;
  time: string | null;
}

interface Stats {
  totalCount: number;
  uniqueDays: number;
  streak: number;
  themeCounts: Record<string, number>;
  topTheme: { theme: string; count: number } | null;
  firstEntryDate: string | null;
}

export default function GratitudeJournalScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const router = useRouter();
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getTokenRef.current();
      const [entriesData, statsData] = await Promise.all([
        apiRequest('/api/gratitude?range=90d', token).catch(() => []),
        apiRequest('/api/gratitude?stats=true', token).catch(() => null),
      ]);
      if (Array.isArray(entriesData)) setEntries(entriesData);
      if (statsData) setStats(statsData);
      hasLoadedOnce.current = true;
    } catch {
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const filtered = filter === 'all' ? entries : entries.filter(e => e.theme === filter);
  const grouped = groupByDate(filtered);
  const topThemeMeta = stats?.topTheme ? THEME_META[stats.topTheme.theme] : null;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.topBar}>
          <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.95}>
            <Text style={s.backBtn}>← Back</Text>
          </AnimatedPressable>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✦</Text>
          <Text style={s.emptyTitle}>Your gratitude garden awaits</Text>
          <Text style={s.emptyDesc}>
            Gratitudes from your morning journal will appear here automatically, or add one now.
          </Text>
          <AnimatedPressable
            onPress={() => { hapticMedium(); router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } }); }}
            scaleDown={0.96}
            style={s.emptyBtn}
          >
            <Text style={s.emptyBtnText}>Start morning journal</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.topBar}>
          <AnimatedPressable onPress={() => { hapticLight(); router.back(); }} scaleDown={0.95}>
            <Text style={s.backBtn}>← Back to journal</Text>
          </AnimatedPressable>
        </View>
        <View style={s.hero}>
          <Text style={s.heroLabel}>YOUR GRATITUDE</Text>
          <Text style={s.heroCount}>{stats?.totalCount || entries.length} moments</Text>
          <Text style={s.heroSub}>
            {stats?.uniqueDays || 0} days · {stats?.streak || 0} day streak 🔥
          </Text>
        </View>

        {/* Dark stat bar */}
        {topThemeMeta && stats?.topTheme && (
          <View style={s.statBar}>
            <View style={{ flex: 1 }}>
              <Text style={s.statBarLabel}>Most grateful for</Text>
              <Text style={s.statBarValue}>{topThemeMeta.label}</Text>
              <Text style={s.statBarSub}>
                {stats.topTheme.count} entries · auto-detected by AI ✦
              </Text>
            </View>
            <View style={s.statBarEmoji}>
              <Text style={{ fontSize: 24 }}>{topThemeMeta.emoji}</Text>
            </View>
          </View>
        )}

        {/* Navigation pills */}
        <View style={s.navRow}>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.push('/(app)/gratitude-garden'); }}
            scaleDown={0.97}
            style={[s.navPill, { borderColor: '#fef3c7', backgroundColor: '#fffbeb' }]}
          >
            <Text style={{ fontSize: 18 }}>🌸</Text>
            <Text style={s.navPillTitle}>Garden</Text>
            <Text style={s.navPillSub}>Visual bloom</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.push('/(app)/gratitude-themes'); }}
            scaleDown={0.97}
            style={[s.navPill, { borderColor: '#ccfbf1', backgroundColor: '#f0fdfa' }]}
          >
            <Text style={{ fontSize: 18 }}>◐</Text>
            <Text style={s.navPillTitle}>Themes</Text>
            <Text style={s.navPillSub}>AI-detected</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { hapticLight(); router.push('/(app)/gratitude-reflect'); }}
            scaleDown={0.97}
            style={[s.navPill, { borderColor: '#ffedd5', backgroundColor: '#fff7ed' }]}
          >
            <Text style={{ fontSize: 18 }}>✦</Text>
            <Text style={s.navPillTitle}>Reflect</Text>
            <Text style={s.navPillSub}>Random memory</Text>
          </AnimatedPressable>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
          {[{ key: 'all', label: 'All' }, ...Object.entries(THEME_META).map(([k, v]) => ({ key: k, label: `${v.emoji} ${v.label}` }))].map(f => (
            <AnimatedPressable
              key={f.key}
              onPress={() => { hapticSelection(); setFilter(f.key); }}
              scaleDown={0.95}
              style={[s.filterChip, filter === f.key && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, filter === f.key && s.filterChipTextActive]}>
                {f.label}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        {/* Feed */}
        {grouped.map(([date, dayEntries]) => (
          <View key={date} style={s.dayGroup}>
            <View style={s.dayHeader}>
              <Text style={s.dayLabel}>{formatDate(date)}</Text>
              <View style={s.dayLine} />
              <Text style={s.dayCount}>{dayEntries.length}</Text>
            </View>
            {dayEntries.map((entry: GratitudeEntry) => {
              const theme = THEME_META[entry.theme || 'moments'] || THEME_META.moments;
              return (
                <View key={entry.id} style={[s.entryCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <View style={s.entryTop}>
                    <View style={[s.entryDot, { backgroundColor: theme.color }]} />
                    <Text style={[s.entryTheme, { color: theme.color }]}>✦ {theme.label}</Text>
                    <Text style={s.entryTime}>{entry.time === 'morning' ? '☀' : '☽'}</Text>
                  </View>
                  <Text style={s.entryText}>"{entry.text}"</Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* End flourish */}
        {stats?.firstEntryDate && (
          <View style={s.flourish}>
            <Text style={s.flourishText}>
              You started logging gratitude on {formatDate(stats.firstEntryDate)}
            </Text>
            <Text style={s.flourishSub}>The beginning of something good ✦</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },
  topBar: { paddingTop: 8, marginBottom: 4 },
  backBtn: { fontSize: 12, color: '#a8a29e' },

  hero: { marginBottom: 16 },
  heroLabel: { fontSize: 10, color: '#f59e0b', fontWeight: '500', letterSpacing: 1 },
  heroCount: { fontSize: 28, fontWeight: '700', color: '#1c1917', marginTop: 2 },
  heroSub: { fontSize: 11, color: '#a8a29e', marginTop: 2 },

  statBar: {
    backgroundColor: '#1c1917', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  statBarLabel: { fontSize: 10, color: '#78716c' },
  statBarValue: { fontSize: 15, fontWeight: '600', color: '#ffffff', marginTop: 2 },
  statBarSub: { fontSize: 10, color: '#f59e0b', marginTop: 4 },
  statBarEmoji: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  navRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  navPill: {
    flex: 1, borderRadius: 16, borderWidth: 1, padding: 12,
  },
  navPillTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917', marginTop: 4 },
  navPillSub: { fontSize: 10, color: '#a8a29e' },

  filterScroll: { marginBottom: 16, marginHorizontal: -24 },
  filterRow: { paddingHorizontal: 24, gap: 6 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#f5f5f4',
  },
  filterChipActive: { backgroundColor: '#1c1917' },
  filterChipText: { fontSize: 12, fontWeight: '500', color: '#a8a29e' },
  filterChipTextActive: { color: '#ffffff' },

  dayGroup: { marginBottom: 20 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dayLabel: { fontSize: 11, fontWeight: '600', color: '#78716c' },
  dayLine: { flex: 1, height: 1, backgroundColor: '#f5f5f4' },
  dayCount: { fontSize: 11, color: '#d6d3d1' },

  entryCard: {
    borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 8,
  },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  entryDot: { width: 7, height: 7, borderRadius: 4 },
  entryTheme: { fontSize: 11, fontWeight: '500', flex: 1 },
  entryTime: { fontSize: 11, color: '#d6d3d1' },
  entryText: { fontSize: 13, color: '#44403c', lineHeight: 20, fontStyle: 'italic', fontWeight: '500' },

  flourish: { alignItems: 'center', paddingVertical: 32 },
  flourishText: { fontSize: 11, color: '#d6d3d1' },
  flourishSub: { fontSize: 11, color: '#e7e5e4', marginTop: 4 },

  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1c1917', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: '#78716c', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#1c1917', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32 },
  emptyBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});

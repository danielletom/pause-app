import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, SafeAreaView, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ── Theme meta ──────────────────────────────────────────────────── */
const THEME_META: Record<string, { label: string; emoji: string; desc: string; color: string; bg: string; border: string; barColor: string }> = {
  people:  { label: 'People',        emoji: '💛', desc: 'The humans who light you up',       color: '#d97706', bg: '#fffbeb', border: '#fef3c7', barColor: '#fbbf24' },
  health:  { label: 'My body',       emoji: '✨', desc: 'Moments your body felt right',      color: '#059669', bg: '#ecfdf5', border: '#d1fae5', barColor: '#34d399' },
  moments: { label: 'Small moments', emoji: '🌿', desc: 'The little things that stopped you', color: '#0d9488', bg: '#f0fdfa', border: '#ccfbf1', barColor: '#2dd4bf' },
  comfort: { label: 'Comfort',       emoji: '☕', desc: 'Warmth, softness, safety',           color: '#ea580c', bg: '#fff7ed', border: '#ffedd5', barColor: '#fb923c' },
  growth:  { label: 'Growth',        emoji: '🌱', desc: 'Signs of you evolving',              color: '#65a30d', bg: '#f7fee7', border: '#ecfccb', barColor: '#a3e635' },
};

interface GratitudeEntry {
  id: number; date: string; text: string; theme: string | null; mood: number | null; time: string | null;
}

export default function GratitudeThemesScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const router = useRouter();
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getTokenRef.current();
      const [entriesData, statsData] = await Promise.all([
        apiRequest('/api/gratitude?range=365d', token).catch(() => []),
        apiRequest('/api/gratitude?stats=true', token).catch(() => null),
      ]);
      if (Array.isArray(entriesData)) setEntries(entriesData);
      if (statsData) setStats(statsData);
      hasLoadedOnce.current = true;
    } catch { hasLoadedOnce.current = true; } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const themeCounts = stats?.themeCounts || {};
  const sorted = Object.entries(themeCounts).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const maxCount = sorted[0]?.[1] || 1;
  const totalEntries = entries.length || 1;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#14b8a6" />
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
            <Text style={s.backBtn}>← Back</Text>
          </AnimatedPressable>
        </View>
        <Text style={s.label}>AI-DETECTED THEMES</Text>
        <Text style={s.title}>What lights you up</Text>
        <Text style={s.subtitle}>
          Our AI reads your words and finds the patterns. You never tag anything — we figure it out.
        </Text>

        {/* Bubble visualisation */}
        <View style={s.bubbleContainer}>
          <View style={s.bubbleRow}>
            {sorted.map(([theme, count]) => {
              const meta = THEME_META[theme];
              if (!meta) return null;
              const ratio = (count as number) / maxCount;
              const size = 52 + ratio * 36;
              return (
                <AnimatedPressable
                  key={theme}
                  onPress={() => { hapticSelection(); setExpandedTheme(expandedTheme === theme ? null : theme); }}
                  scaleDown={0.95}
                  style={[s.bubble, { width: size, height: size, borderColor: meta.color + '80', backgroundColor: meta.color + '20' }]}
                >
                  <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                  <Text style={{ fontSize: 11, color: '#ffffff', fontWeight: '600', marginTop: 2 }}>{count}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Theme breakdown */}
        {sorted.map(([theme, count]) => {
          const meta = THEME_META[theme];
          if (!meta) return null;
          const pct = Math.round(((count as number) / totalEntries) * 100);
          const isExpanded = expandedTheme === theme;
          const themeEntries = entries.filter(e => e.theme === theme);

          return (
            <View key={theme} style={{ marginBottom: 12 }}>
              <AnimatedPressable
                onPress={() => { hapticSelection(); setExpandedTheme(isExpanded ? null : theme); }}
                scaleDown={0.98}
                style={[s.themeCard, isExpanded && { backgroundColor: meta.bg, borderColor: meta.border }]}
              >
                <View style={s.themeRow}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>{meta.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={s.themeHeader}>
                      <Text style={s.themeName}>{meta.label}</Text>
                      <Text style={[s.themePct, { color: meta.color }]}>{pct}%</Text>
                    </View>
                    <Text style={s.themeDesc}>{meta.desc}</Text>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: meta.barColor }]} />
                    </View>
                  </View>
                  <Text style={[s.chevron, isExpanded && s.chevronExpanded]}>›</Text>
                </View>
              </AnimatedPressable>

              {isExpanded && (
                <View style={s.expandedList}>
                  {themeEntries.slice(0, 4).map(entry => (
                    <View key={entry.id} style={[s.compactCard, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                      <Text style={{ fontSize: 12, marginRight: 6 }}>{meta.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.compactText}>{entry.text}</Text>
                        <Text style={[s.compactTheme, { color: meta.color }]}>✦ {meta.label}</Text>
                      </View>
                    </View>
                  ))}
                  {themeEntries.length > 4 && (
                    <Text style={s.moreText}>+ {themeEntries.length - 4} more</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* AI Insight */}
        {stats?.topTheme && (
          <View style={s.insightCard}>
            <Text style={s.insightIcon}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.insightTitle}>AI insight · Your gratitude DNA</Text>
              <Text style={s.insightBody}>
                You lean toward {THEME_META[stats.topTheme.theme]?.label?.toLowerCase() || 'connection'} — {Math.round((stats.topTheme.count / totalEntries) * 100)}% of what you notice is about {THEME_META[stats.topTheme.theme]?.desc?.toLowerCase() || 'the people around you'}.
                Themes evolve as you journal more.
              </Text>
            </View>
          </View>
        )}

        <AnimatedPressable
          onPress={() => { hapticLight(); router.back(); }}
          scaleDown={0.97}
          style={s.backButton}
        >
          <Text style={s.backButtonText}>Back to gratitude feed</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },
  topBar: { paddingTop: 8, marginBottom: 4 },
  backBtn: { fontSize: 12, color: '#a8a29e' },
  label: { fontSize: 10, color: '#0d9488', fontWeight: '500', letterSpacing: 1, marginTop: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#1c1917', marginTop: 2 },
  subtitle: { fontSize: 11, color: '#a8a29e', marginTop: 4, marginBottom: 16, lineHeight: 16 },

  bubbleContainer: {
    borderRadius: 24, backgroundColor: '#1c1917', padding: 20, marginBottom: 20,
    overflow: 'hidden',
  },
  bubbleRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  bubble: {
    borderRadius: 100, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },

  themeCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#f5f5f4',
  },
  themeRow: { flexDirection: 'row', alignItems: 'center' },
  themeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeName: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
  themePct: { fontSize: 12, fontWeight: '700' },
  themeDesc: { fontSize: 10, color: '#a8a29e', marginTop: 2 },
  progressBg: { height: 5, backgroundColor: '#f5f5f4', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  chevron: { fontSize: 20, color: '#d6d3d1', marginLeft: 8 },
  chevronExpanded: { transform: [{ rotate: '90deg' }] },

  expandedList: { marginLeft: 16, marginTop: 8, gap: 6 },
  compactCard: {
    borderRadius: 14, padding: 10, borderWidth: 1,
    flexDirection: 'row', alignItems: 'flex-start',
  },
  compactText: { fontSize: 11, color: '#44403c', lineHeight: 16 },
  compactTheme: { fontSize: 10, marginTop: 4 },
  moreText: { fontSize: 11, color: '#a8a29e', textAlign: 'center', marginTop: 4 },

  insightCard: {
    borderRadius: 16, borderWidth: 1, borderColor: '#fef3c7', backgroundColor: '#fffbeb',
    padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20, marginTop: 4,
  },
  insightIcon: { fontSize: 16, color: '#f59e0b' },
  insightTitle: { fontSize: 12, fontWeight: '600', color: '#1c1917' },
  insightBody: { fontSize: 11, color: '#78716c', marginTop: 4, lineHeight: 16 },

  backButton: {
    borderWidth: 1, borderColor: '#e7e5e4', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  backButtonText: { fontSize: 14, fontWeight: '600', color: '#44403c' },
});

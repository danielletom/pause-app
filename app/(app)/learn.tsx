import React, { useState, useCallback } from 'react';
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
import { hapticLight, hapticMedium } from '@/lib/haptics';
import BackButton from '@/components/BackButton';
import { apiRequest } from '@/lib/api';

/* ─── Week metadata ── */
const WEEK_TITLES: Record<number, string> = {
  1: 'Understanding Menopause',
  2: 'Sleep & Night Sweats',
  3: 'Hot Flashes & Temperature',
  4: 'Mood & Emotional Health',
  5: 'Nutrition & Weight',
  6: 'Brain Fog & Memory',
  7: 'Bones, Joints & Heart',
  8: 'Thriving in Menopause',
};

const WEEK_COLORS: Record<number, { bg: string; accent: string; text: string }> = {
  1: { bg: '#fffbeb', accent: '#fbbf24', text: '#b45309' },
  2: { bg: '#eef2ff', accent: '#818cf8', text: '#4338ca' },
  3: { bg: '#fff1f2', accent: '#fb7185', text: '#be123c' },
  4: { bg: '#ecfdf5', accent: '#34d399', text: '#047857' },
  5: { bg: '#fefce8', accent: '#facc15', text: '#a16207' },
  6: { bg: '#f0f9ff', accent: '#38bdf8', text: '#0369a1' },
  7: { bg: '#fdf4ff', accent: '#c084fc', text: '#7e22ce' },
  8: { bg: '#f0fdf4', accent: '#4ade80', text: '#15803d' },
};

/* ─── Content type icons ── */
function typeIcon(contentType: string): string {
  switch (contentType) {
    case 'podcast': return '🎙️';
    case 'lesson':
    case 'audio_lesson': return '🎧';
    case 'meditation': return '🧘';
    case 'affirmation': return '✨';
    case 'reflection': return '📖';
    default: return '▶';
  }
}

function typeLabel(contentType: string): string {
  switch (contentType) {
    case 'podcast': return 'Podcast';
    case 'lesson':
    case 'audio_lesson': return 'Lesson';
    case 'meditation': return 'Meditation';
    case 'affirmation': return 'Affirmation';
    case 'reflection': return 'Reflection';
    default: return 'Episode';
  }
}

/* ─── Types ── */
interface Episode {
  id: number;
  title: string;
  description: string | null;
  contentType: string;
  format: string;
  audioUrl: string | null;
  durationMinutes: number | null;
  category: string | null;
  programWeek: number | null;
  programDay: number | null;
  programAction: string | null;
}

interface ProgramData {
  week: number;
  day: number;
  totalDay: number;
  totalDone: number;
  totalEpisodes: number;
  weekTitle: string;
  completedIds: string[];
  currentLesson: { id: number; title: string; programWeek: number; programDay: number } | null;
  episodes: Episode[];
}

export default function LearnScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProgramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const token = await getToken();
          const result = await apiRequest('/api/program/progress', token);
          setData(result);
          // Auto-expand current week
          if (result?.week) setExpandedWeek(result.week);
        } catch {
          // Non-critical
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const completedSet = new Set(data?.completedIds ?? []);
  const currentWeek = data?.week ?? 1;
  const totalDone = data?.totalDone ?? 0;
  const totalEpisodes = data?.totalEpisodes ?? 40;
  const pct = totalEpisodes > 0 ? Math.round((totalDone / totalEpisodes) * 100) : 0;

  // Group episodes by week
  const weekMap = new Map<number, Episode[]>();
  for (const ep of data?.episodes ?? []) {
    const w = ep.programWeek ?? 0;
    if (!weekMap.has(w)) weekMap.set(w, []);
    weekMap.get(w)!.push(ep);
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton style={{ paddingHorizontal: 24 }} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your 8-Week Program</Text>
          <Text style={styles.subtitle}>The Pause Pod — your guide through menopause</Text>
        </View>

        {/* Overall progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressPct}>{pct}%</Text>
            <Text style={styles.progressLabel}>{totalDone} of {totalEpisodes} episodes completed</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${pct}%` as any }]} />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1c1917" style={{ marginTop: 40 }} />
        ) : (
          /* Week sections */
          <View style={styles.weeksList}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((weekNum) => {
              const episodes = weekMap.get(weekNum) ?? [];
              const doneCount = episodes.filter((e) => completedSet.has(String(e.id))).length;
              const isExpanded = expandedWeek === weekNum;
              const isCurrent = weekNum === currentWeek;
              const isComplete = doneCount === episodes.length && episodes.length > 0;
              const colors = WEEK_COLORS[weekNum] ?? WEEK_COLORS[1];

              return (
                <View key={weekNum}>
                  {/* Week header */}
                  <AnimatedPressable
                    onPress={() => {
                      hapticLight();
                      setExpandedWeek(isExpanded ? null : weekNum);
                    }}
                    scaleDown={0.98}
                    style={[
                      styles.weekHeader,
                      isCurrent && { backgroundColor: colors.bg, borderColor: colors.accent },
                    ]}
                  >
                    <View style={[
                      styles.weekBadge,
                      isComplete
                        ? { backgroundColor: '#059669' }
                        : { backgroundColor: isCurrent ? colors.accent : '#e7e5e4' },
                    ]}>
                      {isComplete ? (
                        <Text style={styles.weekBadgeCheck}>✓</Text>
                      ) : (
                        <Text style={[styles.weekBadgeNum, isComplete || isCurrent ? { color: '#fff' } : { color: '#78716c' }]}>
                          {weekNum}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weekTitle}>Week {weekNum}</Text>
                      <Text style={[styles.weekSubtitle, isCurrent && { color: colors.text }]}>
                        {WEEK_TITLES[weekNum]}
                      </Text>
                    </View>
                    <View style={styles.weekMeta}>
                      <Text style={styles.weekProgress}>{doneCount}/{episodes.length}</Text>
                      <Text style={[styles.weekChevron, isExpanded && styles.weekChevronOpen]}>›</Text>
                    </View>
                  </AnimatedPressable>

                  {/* Expanded episode list */}
                  {isExpanded && (
                    <View style={styles.episodeList}>
                      {episodes
                        .sort((a, b) => (a.programDay ?? 0) - (b.programDay ?? 0))
                        .map((ep) => {
                          const isDone = completedSet.has(String(ep.id));
                          const isCurrentEp = data?.currentLesson?.id === ep.id;
                          return (
                            <AnimatedPressable
                              key={ep.id}
                              onPress={() => {
                                hapticMedium();
                                if (ep.audioUrl) {
                                  router.push({
                                    pathname: '/(app)/player' as any,
                                    params: { id: ep.id, source: 'program' },
                                  });
                                }
                              }}
                              scaleDown={0.97}
                              style={[
                                styles.episodeCard,
                                isCurrentEp && { borderColor: colors.accent, borderWidth: 2 },
                              ]}
                            >
                              <View style={styles.episodeLeft}>
                                {/* Day number + completion */}
                                <View style={[
                                  styles.dayBadge,
                                  isDone ? { backgroundColor: '#059669' } : { backgroundColor: '#f5f5f4' },
                                ]}>
                                  {isDone ? (
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                                  ) : (
                                    <Text style={{ color: '#78716c', fontSize: 12, fontWeight: '600' }}>
                                      D{ep.programDay}
                                    </Text>
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={styles.episodeTypeRow}>
                                    <Text style={{ fontSize: 14 }}>{typeIcon(ep.contentType)}</Text>
                                    <Text style={styles.episodeType}>{typeLabel(ep.contentType)}</Text>
                                    {ep.durationMinutes ? (
                                      <Text style={styles.episodeDur}>{ep.durationMinutes} min</Text>
                                    ) : null}
                                  </View>
                                  <Text style={[styles.episodeTitle, isDone && styles.episodeTitleDone]} numberOfLines={2}>
                                    {ep.title}
                                  </Text>
                                  {ep.programAction ? (
                                    <Text style={styles.episodeAction} numberOfLines={1}>
                                      Tonight: {ep.programAction}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                              {!ep.audioUrl && (
                                <View style={styles.comingSoonBadge}>
                                  <Text style={styles.comingSoonText}>Soon</Text>
                                </View>
                              )}
                              {isCurrentEp && (
                                <View style={[styles.currentBadge, { backgroundColor: colors.accent }]}>
                                  <Text style={styles.currentBadgeText}>Up next</Text>
                                </View>
                              )}
                            </AnimatedPressable>
                          );
                        })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scroll: { paddingBottom: 120 },

  header: { paddingHorizontal: 24, paddingTop: 8, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  subtitle: { fontSize: 13, color: '#a8a29e', marginTop: 4 },

  /* Overall progress */
  progressCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  progressPct: { fontSize: 28, fontWeight: '700', color: '#1c1917' },
  progressLabel: { fontSize: 14, color: '#78716c' },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f5f5f4',
    borderRadius: 3,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#fbbf24',
    borderRadius: 3,
  },

  /* Weeks list */
  weeksList: { paddingHorizontal: 24, gap: 8 },

  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  weekBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBadgeNum: { fontSize: 14, fontWeight: '700' },
  weekBadgeCheck: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  weekTitle: { fontSize: 12, fontWeight: '500', color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekSubtitle: { fontSize: 16, fontWeight: '600', color: '#1c1917', marginTop: 1 },
  weekMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekProgress: { fontSize: 13, fontWeight: '500', color: '#78716c' },
  weekChevron: { fontSize: 18, color: '#78716c', transform: [{ rotate: '0deg' }] },
  weekChevronOpen: { transform: [{ rotate: '90deg' }] },

  /* Episode list */
  episodeList: { paddingLeft: 16, paddingRight: 0, gap: 6, marginTop: 4, marginBottom: 8 },

  episodeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  episodeLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  episodeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  episodeType: { fontSize: 12, color: '#78716c', fontWeight: '500' },
  episodeDur: { fontSize: 12, color: '#a8a29e', marginLeft: 4 },
  episodeTitle: { fontSize: 15, fontWeight: '500', color: '#1c1917', lineHeight: 20 },
  episodeTitleDone: { color: '#78716c' },
  episodeAction: { fontSize: 12, color: '#b45309', marginTop: 4, fontStyle: 'italic' },

  comingSoonBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 40,
  },
  comingSoonText: { fontSize: 11, fontWeight: '600', color: '#b45309' },

  currentBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 40,
  },
  currentBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
});

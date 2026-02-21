import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ─── Content Library tabs per CLAUDE.md content model ──── */
const CONTENT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'medication', label: 'Medication' },
  { key: 'guides', label: 'Guides' },
  { key: 'recipes', label: 'Recipes' },
];

/* ─── Focused Programs (static — these are curated program entries) ── */
const FOCUSED_PROGRAMS = [
  { title: 'Better Sleep', icon: '☽', bgColor: '#e0e7ff', iconColor: '#6366f1' },
  { title: 'Hot Flash Relief', icon: '❄', bgColor: '#ccfbf1', iconColor: '#0f766e' },
  { title: 'Mood & Calm', icon: '◉', bgColor: '#d1fae5', iconColor: '#047857' },
  { title: 'Movement', icon: '♡', bgColor: '#ffe4e6', iconColor: '#be123c' },
];

/* ─── Visual mapping for content cards (category → colors/icons) ── */
const CATEGORY_STYLES: Record<string, { icon: string; bgColor: string; iconColor: string }> = {
  sleep: { icon: '☽', bgColor: '#e0e7ff', iconColor: '#6366f1' },
  'hot flashes': { icon: '🔥', bgColor: '#ffe4e6', iconColor: '#be123c' },
  mood: { icon: '◉', bgColor: '#d1fae5', iconColor: '#047857' },
  nutrition: { icon: '🥗', bgColor: '#fef3c7', iconColor: '#b45309' },
  basics: { icon: '🔬', bgColor: '#fef3c7', iconColor: '#b45309' },
  mind: { icon: '💭', bgColor: '#d1fae5', iconColor: '#047857' },
  symptoms: { icon: '🔥', bgColor: '#ffe4e6', iconColor: '#be123c' },
  hrt: { icon: '💊', bgColor: '#ffe4e6', iconColor: '#be123c' },
  supplements: { icon: '🌿', bgColor: '#d1fae5', iconColor: '#047857' },
  doctor: { icon: '📋', bgColor: '#fef3c7', iconColor: '#b45309' },
  medication: { icon: '💊', bgColor: '#ffe4e6', iconColor: '#be123c' },
  recipes: { icon: '🥗', bgColor: '#fef3c7', iconColor: '#b45309' },
  default: { icon: '✦', bgColor: '#f5f5f4', iconColor: '#78716c' },
};

function getCategoryStyle(category: string | null | undefined) {
  if (!category) return CATEGORY_STYLES.default;
  return CATEGORY_STYLES[category.toLowerCase()] || CATEGORY_STYLES.default;
}

/* ─── Format guide type labels from API format field ── */
function formatLabel(format: string | null | undefined): string {
  switch (format) {
    case 'audio': return 'Audio';
    case 'pdf': return 'PDF';
    case 'text': return 'Article';
    default: return 'Guide';
  }
}

/* ─── Duration display ── */
function durationText(minutes: number | null | undefined, format?: string): string {
  if (!minutes) return '';
  if (format === 'text' || format === 'pdf') return `${minutes} min read`;
  return `${minutes} min`;
}

/* ─── Route helper: audio content → player, text → article ── */
function isAudioContent(item: { contentType: string; format: string; audioUrl: string | null }): boolean {
  const audioTypes = ['podcast', 'meditation', 'lesson', 'audio_lesson', 'affirmation', 'reflection'];
  if (audioTypes.includes(item.contentType)) return true;
  if (item.format === 'audio') return true;
  if (item.audioUrl) return true;
  return false;
}

/* ─── Types for API content items ── */
type ContentItem = {
  id: number;
  title: string;
  slug: string | null;
  contentType: string;
  format: string;
  description: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  category: string | null;
  tags: string[] | null;
  sortOrder: number;
  programId: string | null;
  programWeek: number | null;
  programDay: number | null;
};

type ArticleItem = {
  id: number;
  title: string;
  category: string | null;
  readTime: number | null;
  thumbnailUrl: string | null;
};

export default function WellnessScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [programProgress, setProgramProgress] = useState<{
    week: number;
    day: number;
    totalDone: number;
    weekTitle: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Content from API
  const [lessons, setLessons] = useState<ContentItem[]>([]);
  const [meditations, setMeditations] = useState<ContentItem[]>([]);
  const [medicationArticles, setMedicationArticles] = useState<ContentItem[]>([]);
  const [guides, setGuides] = useState<ContentItem[]>([]);
  const [recipes, setRecipes] = useState<ContentItem[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  // Fetch program progress + all content library sections
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          setContentLoading(true);
          const token = await getToken();

          // Fetch progress + all published content + articles in parallel
          const [progressData, allContent, articlesData] = await Promise.all([
            apiRequest('/api/program/progress', token).catch(() => null),
            apiRequest('/api/content', token).catch(() => []),
            apiRequest('/api/articles', token).catch(() => []),
          ]);

          if (progressData) setProgramProgress(progressData);

          // Categorize content from the unified response
          const items: ContentItem[] = Array.isArray(allContent) ? allContent : [];

          // Lessons & podcasts (standalone only — exclude program episodes)
          const standaloneLessons = items.filter(
            (l) => !l.programWeek && ['lesson', 'audio_lesson', 'podcast'].includes(l.contentType)
          );
          setLessons(standaloneLessons);

          // Meditations & affirmations (standalone only)
          setMeditations(items.filter(
            (l) => !l.programWeek && ['meditation', 'affirmation'].includes(l.contentType)
          ));

          // Medication articles (any content about medication/HRT/supplements)
          const medCategories = ['medication', 'hrt', 'supplements'];
          setMedicationArticles(items.filter(
            (l) => medCategories.includes((l.category || '').toLowerCase())
          ));

          // Guides
          setGuides(items.filter(
            (l) => l.contentType === 'guide' || l.format === 'pdf'
          ));

          // Recipes
          setRecipes(items.filter(
            (l) => (l.category || '').toLowerCase() === 'recipes' || (l.category || '').toLowerCase() === 'nutrition'
          ));

          // Articles (from separate articles table — educational content)
          setArticles(Array.isArray(articlesData) ? articlesData : []);
        } catch {
          // Default states are fine — UI handles empty arrays gracefully
        } finally {
          setLoading(false);
          setContentLoading(false);
        }
      })();
    }, [])
  );

  // Convert articles to ContentItem shape for unified display
  const articleContentItems: ContentItem[] = articles.map((a) => ({
    id: a.id + 10000, // Offset to avoid ID collision with content table
    title: a.title,
    slug: null,
    contentType: 'article',
    format: 'text',
    description: null,
    audioUrl: null,
    thumbnailUrl: a.thumbnailUrl || null,
    durationMinutes: a.readTime || null,
    category: a.category,
    tags: null,
    sortOrder: 0,
    programId: null,
    programWeek: null,
    programDay: null,
    _articleId: a.id, // Track real article ID for navigation
  }));

  // Merge lessons + meditations + articles for the Lessons tab
  const allLessons = [...lessons, ...meditations, ...articleContentItems];
  const featuredLessons = allLessons.slice(0, 6);
  const gridLessons = allLessons.slice(6, 10);

  const showLessons = activeTab === 'all' || activeTab === 'lessons';
  const showMedication = activeTab === 'all' || activeTab === 'medication';
  const showGuides = activeTab === 'all' || activeTab === 'guides';
  const showRecipes = activeTab === 'all' || activeTab === 'recipes';

  const pct = programProgress ? Math.round((programProgress.totalDone / 40) * 100) : 0;
  const weekTitle = programProgress?.weekTitle || 'Week 2: Sleep & Night Sweats';
  const progressLabel = programProgress
    ? `Day ${programProgress.day} of 56 · ${programProgress.totalDone} of 40 lessons done`
    : 'Ready to begin · 40 lessons';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Wellness Centre</Text>
          <Text style={styles.subtitle}>Your program, lessons, guides, and recipes</Text>
        </View>

        {/* ── YOUR 8-WEEK PROGRAM (Pause Pod) ── */}
        <AnimatedPressable
          onPress={() => { hapticMedium(); router.push('/(app)/learn' as any); }}
          scaleDown={0.97}
          style={styles.programCard}
        >
          <View style={styles.programRow}>
            <View style={styles.programIcon}>
              <Text style={styles.programIconText}>✦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.programTitle}>Your 8-Week Program</Text>
              <Text style={styles.programWeek}>{weekTitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={styles.programProgress}>{progressLabel}</Text>
        </AnimatedPressable>

        {/* ── SOS Card ── */}
        <AnimatedPressable
          onPress={() => { hapticMedium(); router.push('/(app)/sos'); }}
          scaleDown={0.97}
          style={styles.sosCard}
        >
          <View style={styles.sosIcon}>
            <Text style={{ fontSize: 18 }}>❄</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>Hot Flash SOS</Text>
            <Text style={styles.sosSubtitle}>Guided breathing to help right now</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </AnimatedPressable>

        {/* ── CONTENT LIBRARY ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Content Library</Text>
          <Text style={styles.sectionSubtitle}>Lessons, medication info, guides, and recipes</Text>
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContainer}
        >
          {CONTENT_TABS.map((tab) => (
            <AnimatedPressable
              key={tab.key}
              onPress={() => { hapticLight(); setActiveTab(tab.key); }}
              scaleDown={0.95}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        {/* ── Lessons — horizontal cards + 2x2 grid (standalone, NOT Pause Pod) ── */}
        {showLessons && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Lessons</Text>
              <Text style={styles.sectionCount}>
                {allLessons.length > 0 ? `${allLessons.length} lessons` : 'Loading...'}
              </Text>
            </View>
            {contentLoading ? (
              <ActivityIndicator size="small" color="#78716c" style={{ marginVertical: 20 }} />
            ) : allLessons.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Lessons coming soon</Text>
              </View>
            ) : (
              <>
                {/* Horizontal scroll of featured lessons */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -24, marginBottom: 10 }}
                  contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
                >
                  {featuredLessons.map((l) => {
                    const style = getCategoryStyle(l.category);
                    const isArticle = l.contentType === 'article' && (l as any)._articleId;
                    return (
                      <AnimatedPressable
                        key={`${l.contentType}-${l.id}`}
                        onPress={() => {
                          hapticLight();
                          if (isArticle) {
                            router.push({ pathname: '/(app)/article' as any, params: { id: (l as any)._articleId } });
                          } else {
                            const dest = isAudioContent(l) ? '/(app)/player' : '/(app)/article';
                            router.push({ pathname: dest as any, params: { id: l.id, source: 'content' } });
                          }
                        }}
                        scaleDown={0.97}
                        style={styles.lessonHorizCard}
                      >
                        <View style={[styles.lessonHorizImage, { backgroundColor: style.bgColor }]}>
                          <Text style={{ fontSize: 24 }}>{style.icon}</Text>
                        </View>
                        <Text style={styles.lessonHorizTitle} numberOfLines={2}>{l.title}</Text>
                        <Text style={styles.lessonHorizDur}>{durationText(l.durationMinutes, l.format)}</Text>
                        {l.category && (
                          <View style={styles.catBadge}>
                            <Text style={styles.catBadgeText}>{l.category}</Text>
                          </View>
                        )}
                      </AnimatedPressable>
                    );
                  })}
                </ScrollView>
                {/* 2x2 grid of more lessons */}
                {gridLessons.length > 0 && (
                  <View style={styles.grid}>
                    {gridLessons.map((l) => {
                      const isArticle = l.contentType === 'article' && (l as any)._articleId;
                      return (
                        <AnimatedPressable
                          key={`${l.contentType}-${l.id}`}
                          onPress={() => {
                            hapticLight();
                            if (isArticle) {
                              router.push({ pathname: '/(app)/article' as any, params: { id: (l as any)._articleId } });
                            } else {
                              const dest = isAudioContent(l) ? '/(app)/player' : '/(app)/article';
                              router.push({ pathname: dest as any, params: { id: l.id, source: 'content' } });
                            }
                          }}
                          scaleDown={0.97}
                          style={styles.lessonCard}
                        >
                          <Text style={styles.lessonTitle}>{l.title}</Text>
                          <Text style={styles.lessonDur}>
                            {isArticle ? `${durationText(l.durationMinutes, l.format)} read` : `${l.contentType === 'meditation' ? 'Meditation' : 'Audio'} · ${durationText(l.durationMinutes, l.format)}`}
                          </Text>
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ── Medication & Supplements ── */}
        {showMedication && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Medication & Supplements</Text>
              <Text style={styles.sectionCount}>
                {medicationArticles.length > 0 ? `${medicationArticles.length} articles` : 'Loading...'}
              </Text>
            </View>
            {contentLoading ? (
              <ActivityIndicator size="small" color="#78716c" style={{ marginVertical: 20 }} />
            ) : medicationArticles.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Medication articles coming soon</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {medicationArticles.map((a) => {
                  const style = getCategoryStyle(a.category);
                  const tagLabel = (a.tags as string[] | null)?.[0] || a.category || '';
                  return (
                    <AnimatedPressable
                      key={a.id}
                      onPress={() => {
                        hapticLight();
                        const dest = isAudioContent(a) ? '/(app)/player' : '/(app)/article';
                        router.push({ pathname: dest as any, params: { id: a.id, source: 'content' } });
                      }}
                      scaleDown={0.97}
                      style={styles.medCard}
                    >
                      <View style={[styles.medIcon, { backgroundColor: style.bgColor }]}>
                        <Text style={{ fontSize: 14, color: style.iconColor }}>{style.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medTitle} numberOfLines={2}>{a.title}</Text>
                        <Text style={styles.medDur}>{durationText(a.durationMinutes, a.format)}</Text>
                      </View>
                      {tagLabel ? (
                        <View style={styles.medTagBadge}>
                          <Text style={styles.medTagText}>{tagLabel}</Text>
                        </View>
                      ) : null}
                    </AnimatedPressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Practical Guides ── */}
        {showGuides && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Practical Guides</Text>
              <Text style={styles.sectionCount}>
                {guides.length > 0 ? `${guides.length} guides` : 'Loading...'}
              </Text>
            </View>
            {contentLoading ? (
              <ActivityIndicator size="small" color="#78716c" style={{ marginVertical: 20 }} />
            ) : guides.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Guides coming soon</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {guides.map((g) => {
                  const style = getCategoryStyle(g.category);
                  return (
                    <AnimatedPressable
                      key={g.id}
                      onPress={() => {
                        hapticLight();
                        const dest = isAudioContent(g) ? '/(app)/player' : '/(app)/article';
                        router.push({ pathname: dest as any, params: { id: g.id, source: 'content' } });
                      }}
                      scaleDown={0.97}
                      style={styles.guideCard}
                    >
                      <Text style={{ fontSize: 18 }}>{style.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.guideTitle}>{g.title}</Text>
                        <Text style={styles.guideType}>{formatLabel(g.format)}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Recipes ── */}
        {showRecipes && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Recipes</Text>
              <Text style={styles.sectionCount}>
                {recipes.length > 0 ? `${recipes.length} recipes` : 'Loading...'}
              </Text>
            </View>
            {contentLoading ? (
              <ActivityIndicator size="small" color="#78716c" style={{ marginVertical: 20 }} />
            ) : recipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Recipes coming soon</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -24 }}
                contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
              >
                {recipes.map((r) => {
                  const style = getCategoryStyle(r.category);
                  const benefitTag = (r.tags as string[] | null)?.[0] || r.description || '';
                  return (
                    <AnimatedPressable
                      key={r.id}
                      onPress={() => {
                        hapticLight();
                        const dest = isAudioContent(r) ? '/(app)/player' : '/(app)/article';
                        router.push({ pathname: dest as any, params: { id: r.id, source: 'content' } });
                      }}
                      scaleDown={0.97}
                      style={styles.recipeCard}
                    >
                      <View style={[styles.recipeImage, { backgroundColor: style.bgColor }]}>
                        <Text style={{ fontSize: 24 }}>{style.icon}</Text>
                      </View>
                      <Text style={styles.recipeTitle} numberOfLines={2}>{r.title}</Text>
                      <Text style={styles.recipeDur}>
                        {r.durationMinutes ? `${r.durationMinutes} min prep` : ''}
                      </Text>
                      {benefitTag ? (
                        <View style={styles.recipeBenefit}>
                          <Text style={styles.recipeBenefitText} numberOfLines={1}>{benefitTag}</Text>
                        </View>
                      ) : null}
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Focused Programs — 2x2 grid ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Focused programs</Text>
          <View style={[styles.grid, { marginTop: 8 }]}>
            {FOCUSED_PROGRAMS.map((p) => (
              <AnimatedPressable
                key={p.title}
                onPress={() => { hapticLight(); router.push('/(app)/learn' as any); }}
                scaleDown={0.97}
                style={styles.focusedCard}
              >
                <View style={[styles.focusedIcon, { backgroundColor: p.bgColor }]}>
                  <Text style={{ fontSize: 14, color: p.iconColor }}>{p.icon}</Text>
                </View>
                <Text style={styles.focusedTitle}>{p.title}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scroll: { paddingBottom: 120 },

  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },
  subtitle: { fontSize: 14, color: '#78716c', marginTop: 2 },

  chevron: { fontSize: 20, color: '#78716c' },

  /* 8-Week Program Card */
  programCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  programIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programIconText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  programTitle: { fontSize: 16, fontWeight: '600', color: '#1c1917' },
  programWeek: { fontSize: 16, color: '#b45309', fontWeight: '500', marginTop: 2 },
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
  programProgress: { fontSize: 14, color: '#78716c', marginTop: 6 },

  /* SOS Card */
  sosCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: '#fff1f2',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fecdd3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sosIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917' },
  sosSubtitle: { fontSize: 14, color: '#78716c', marginTop: 1 },

  /* Section header */
  sectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1c1917' },
  sectionSubtitle: { fontSize: 14, color: '#78716c', marginTop: 2 },

  /* Tabs */
  tabScroll: { marginBottom: 16 },
  tabContainer: { paddingHorizontal: 24, gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f4',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#1c1917',
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#78716c' },
  tabTextActive: { color: '#ffffff' },

  /* Section blocks */
  sectionBlock: { paddingHorizontal: 24, marginBottom: 20 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#1c1917' },
  sectionCount: { fontSize: 14, color: '#78716c' },

  /* Empty state */
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#78716c', fontWeight: '500' },

  /* Lesson horizontal cards */
  lessonHorizCard: { width: 120 },
  lessonHorizImage: {
    width: '100%',
    height: 80,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  lessonHorizTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917', lineHeight: 18 },
  lessonHorizDur: { fontSize: 14, color: '#78716c', marginTop: 2 },
  catBadge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  catBadgeText: { fontSize: 12, color: '#78716c' },

  /* Lesson grid cards */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lessonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  lessonTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917' },
  lessonDur: { fontSize: 14, color: '#78716c', marginTop: 2 },

  /* Medication cards */
  medCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  medIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  medTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917', lineHeight: 20 },
  medDur: { fontSize: 14, color: '#78716c', marginTop: 2 },
  medTagBadge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  medTagText: { fontSize: 12, color: '#78716c' },

  /* Guide cards */
  guideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  guideTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917' },
  guideType: { fontSize: 14, color: '#78716c', marginTop: 1 },

  /* Recipe cards — horizontal scroll */
  recipeCard: { width: 132 },
  recipeImage: {
    width: '100%',
    height: 80,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  recipeTitle: { fontSize: 14, fontWeight: '500', color: '#1c1917', lineHeight: 18 },
  recipeDur: { fontSize: 14, color: '#78716c', marginTop: 2 },
  recipeBenefit: {
    backgroundColor: '#ecfdf5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  recipeBenefitText: { fontSize: 12, color: '#047857' },

  /* Focused program cards */
  focusedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '47%',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  focusedIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusedTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917' },
});

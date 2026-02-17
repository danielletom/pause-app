import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight } from '@/lib/haptics';

/* ─── Mock content data ──────────────────────────────────── */

const CONTENT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'meditations', label: 'Meditations' },
  { key: 'podcasts', label: 'Podcasts' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'guides', label: 'Guides' },
];

const MEDITATIONS = [
  { title: 'Body Scan for Sleep', dur: '15 min', icon: '☽', bgColor: '#e0e7ff', iconColor: '#6366f1', tags: ['evening', 'sleep'] },
  { title: 'Hot Flash Cooling', dur: '12 min', icon: '❄', bgColor: '#ccfbf1', iconColor: '#0d9488', tags: ['anytime', 'sos'] },
  { title: 'Morning Energy', dur: '10 min', icon: '☀', bgColor: '#fef3c7', iconColor: '#b45309', tags: ['morning', 'energy'] },
  { title: 'Anxiety Grounding', dur: '10 min', icon: '🌿', bgColor: '#d1fae5', iconColor: '#047857', tags: ['anytime', 'calm'] },
];

const PODCASTS = [
  { title: 'The 34 Symptoms Nobody Warned You About', dur: '18 min', isNew: true, tags: ['anytime', 'basics'] },
  { title: 'Why Sleep Changes in Perimenopause', dur: '20 min', isNew: true, tags: ['evening', 'sleep'] },
  { title: 'Hot Flashes: What Actually Triggers Them', dur: '18 min', isNew: false, tags: ['anytime', 'hot flashes'] },
];

const LESSONS = [
  { title: 'Hormones 101', dur: '10 min', tags: ['anytime', 'basics'] },
  { title: 'Night Sweat Toolkit', dur: '12 min', tags: ['evening', 'sleep'] },
  { title: 'Brain Fog Strategies', dur: '10 min', tags: ['morning', 'mind'] },
  { title: 'The Supplement Guide', dur: '12 min', tags: ['anytime', 'nutrition'] },
];

const GUIDES = [
  { title: 'Menopause Shopping List', type: 'PDF', icon: '🛒' },
  { title: 'What to Ask Your Doctor', type: 'Script', icon: '📋' },
  { title: 'Bedroom Cooling Checklist', type: 'Checklist', icon: '❄' },
];

const FOCUSED_PROGRAMS = [
  { title: 'Better Sleep', icon: '☽', bgColor: '#e0e7ff', iconColor: '#6366f1' },
  { title: 'Hot Flash Relief', icon: '❄', bgColor: '#ccfbf1', iconColor: '#0f766e' },
  { title: 'Mood & Calm', icon: '◉', bgColor: '#d1fae5', iconColor: '#047857' },
  { title: 'Movement', icon: '♡', bgColor: '#ffe4e6', iconColor: '#be123c' },
];

export default function WellnessScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');

  const showMeditations = activeTab === 'all' || activeTab === 'meditations';
  const showPodcasts = activeTab === 'all' || activeTab === 'podcasts';
  const showLessons = activeTab === 'all' || activeTab === 'lessons';
  const showGuides = activeTab === 'all' || activeTab === 'guides';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Wellness Centre</Text>
          <Text style={styles.subtitle}>Your program, content library & tools</Text>
        </View>

        {/* 8-Week Program Card */}
        <AnimatedPressable
          onPress={() => { hapticMedium(); /* Future: navigate to program detail */ }}
          scaleDown={0.97}
          style={styles.programCard}
        >
          <View style={styles.programRow}>
            <View style={styles.programIcon}>
              <Text style={styles.programIconText}>✦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.programTitle}>Your 8-Week Program</Text>
              <Text style={styles.programWeek}>Week 2: Sleep & Night Sweats</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '18%' }]} />
          </View>
          <Text style={styles.programProgress}>Day 10 of 56 · 10 of 40 lessons done</Text>
        </AnimatedPressable>

        {/* SOS Card */}
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
            <Text style={styles.sosSubtitle}>Guided breathing for instant relief</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </AnimatedPressable>

        {/* ── CONTENT LIBRARY ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Content Library</Text>
          <Text style={styles.sectionSubtitle}>Audio, meditations, podcasts & guides</Text>
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

        {/* ── Meditations — horizontal scroll ── */}
        {showMeditations && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Meditations</Text>
              <Text style={styles.sectionCount}>20+ sessions</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -24 }}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
            >
              {MEDITATIONS.map((m) => (
                <AnimatedPressable
                  key={m.title}
                  onPress={() => { hapticLight(); /* Future: navigate to audio player */ }}
                  scaleDown={0.97}
                  style={styles.meditationCard}
                >
                  <View style={[styles.meditationImage, { backgroundColor: m.bgColor }]}>
                    <Text style={{ fontSize: 24 }}>{m.icon}</Text>
                  </View>
                  <Text style={styles.meditationTitle} numberOfLines={2}>{m.title}</Text>
                  <Text style={styles.meditationDur}>{m.dur}</Text>
                  <View style={styles.tagRow}>
                    {m.tags.map((t) => (
                      <View key={t} style={styles.tag}>
                        <Text style={styles.tagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Podcasts — list ── */}
        {showPodcasts && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Podcasts & Discussions</Text>
              <Text style={styles.sectionCount}>16+ episodes</Text>
            </View>
            <View style={{ gap: 8 }}>
              {PODCASTS.map((ep) => (
                <AnimatedPressable
                  key={ep.title}
                  onPress={() => { hapticLight(); /* Future: navigate to audio player */ }}
                  scaleDown={0.97}
                  style={styles.podcastCard}
                >
                  <View style={styles.playButton}>
                    <Text style={styles.playIcon}>▶</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.podcastTitleRow}>
                      <Text style={styles.podcastTitle} numberOfLines={2}>{ep.title}</Text>
                      {ep.isNew && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>New</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.podcastDur}>{ep.dur}</Text>
                    <View style={styles.tagRow}>
                      {ep.tags.map((t) => (
                        <View key={t} style={styles.tag}>
                          <Text style={styles.tagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Audio Lessons — 2x2 grid ── */}
        {showLessons && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Audio Lessons</Text>
              <Text style={styles.sectionCount}>24+ lessons</Text>
            </View>
            <View style={styles.grid}>
              {LESSONS.map((l) => (
                <AnimatedPressable
                  key={l.title}
                  onPress={() => { hapticLight(); /* Future: navigate to audio player */ }}
                  scaleDown={0.97}
                  style={styles.lessonCard}
                >
                  <Text style={styles.lessonTitle}>{l.title}</Text>
                  <Text style={styles.lessonDur}>{l.dur}</Text>
                  <View style={styles.tagRow}>
                    {l.tags.map((t) => (
                      <View key={t} style={styles.tag}>
                        <Text style={styles.tagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Practical Guides — list ── */}
        {showGuides && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Practical Guides</Text>
              <Text style={styles.sectionCount}>10+ guides</Text>
            </View>
            <View style={{ gap: 8 }}>
              {GUIDES.map((g) => (
                <AnimatedPressable
                  key={g.title}
                  onPress={() => { hapticLight(); router.push('/(app)/learn'); }}
                  scaleDown={0.97}
                  style={styles.guideCard}
                >
                  <Text style={{ fontSize: 18 }}>{g.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guideTitle}>{g.title}</Text>
                    <Text style={styles.guideType}>{g.type}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Focused Programs — 2x2 grid ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Focused programs</Text>
          <View style={[styles.grid, { marginTop: 8 }]}>
            {FOCUSED_PROGRAMS.map((p) => (
              <AnimatedPressable
                key={p.title}
                onPress={() => { hapticLight(); /* Future: navigate to program */ }}
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
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#d1fae5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sosIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#14b8a6',
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

  /* Tags */
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: {
    backgroundColor: '#f5f5f4',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 12, color: '#78716c' },

  /* Meditation cards — horizontal scroll */
  meditationCard: {
    width: 120,
  },
  meditationImage: {
    width: '100%',
    height: 80,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  meditationTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917', lineHeight: 20 },
  meditationDur: { fontSize: 14, color: '#78716c', marginTop: 2 },

  /* Podcast cards */
  podcastCard: {
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
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playIcon: { fontSize: 14, color: '#ffffff' },
  podcastTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  podcastTitle: { fontSize: 16, fontWeight: '500', color: '#1c1917', lineHeight: 20, flex: 1 },
  podcastDur: { fontSize: 14, color: '#78716c', marginTop: 2 },
  newBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: { fontSize: 12, fontWeight: '600', color: '#b45309' },

  /* Lesson cards — 2x2 grid */
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

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, SafeAreaView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { hapticMedium, hapticLight, hapticSuccess } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ── Theme meta ──────────────────────────────────────────────────── */
const THEME_META: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  people:  { label: 'People',        emoji: '💛', color: '#d97706', bg: '#fffbeb', border: '#fef3c7' },
  health:  { label: 'My body',       emoji: '✨', color: '#059669', bg: '#ecfdf5', border: '#d1fae5' },
  moments: { label: 'Small moments', emoji: '🌿', color: '#0d9488', bg: '#f0fdfa', border: '#ccfbf1' },
  comfort: { label: 'Comfort',       emoji: '☕', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' },
  growth:  { label: 'Growth',        emoji: '🌱', color: '#65a30d', bg: '#f7fee7', border: '#ecfccb' },
};

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

interface GratitudeEntry {
  id: number; date: string; text: string; theme: string | null; mood: number | null; time: string | null;
}

export default function GratitudeReflectScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const router = useRouter();
  const [entry, setEntry] = useState<GratitudeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const hasLoadedOnce = useRef(false);

  const fetchRandom = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getTokenRef.current();
      const data = await apiRequest('/api/gratitude/random', token).catch(() => null);
      if (data && data.id) {
        setEntry(data);
      }
      hasLoadedOnce.current = true;
    } catch { hasLoadedOnce.current = true; } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchRandom(); }, [fetchRandom]));

  const nextRandom = async () => {
    setRevealed(false);
    const token = await getTokenRef.current();
    const data = await apiRequest('/api/gratitude/random', token).catch(() => null);
    if (data && data.id) {
      setEntry(data);
      setTimeout(() => setRevealed(true), 300);
      hapticSuccess();
    }
  };

  const theme = entry?.theme ? THEME_META[entry.theme] : THEME_META.moments;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  // No entries yet
  if (!entry) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.topBar}>
          <BackButton light />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✦</Text>
          <Text style={s.emptyTitle}>No memories yet</Text>
          <Text style={s.emptyDesc}>
            Once you log some gratitudes, you can come back here to randomly revisit them.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.topBar}>
        <BackButton light />
      </View>

      <View style={s.center}>
        {!revealed ? (
          /* ── Pre-reveal ── */
          <View style={s.preReveal}>
            <View style={s.glowOuter}>
              <View style={s.glowInner}>
                <Text style={{ fontSize: 36 }}>✦</Text>
              </View>
            </View>
            <Text style={s.preLabel}>A MOMENT FROM YOUR PAST</Text>
            <Text style={s.preSub}>Tap to remember something{'\n'}you were grateful for</Text>
            <AnimatedPressable
              onPress={() => { hapticSuccess(); setRevealed(true); }}
              scaleDown={0.95}
              style={s.revealBtn}
            >
              <Text style={s.revealBtnText}>Reveal ✦</Text>
            </AnimatedPressable>
          </View>
        ) : (
          /* ── Revealed ── */
          <View style={s.revealed}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>{theme.emoji}</Text>

            <View style={[s.entryCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={s.entryText}>"{entry.text}"</Text>
            </View>

            <Text style={s.entryMeta}>
              {formatDate(entry.date)} · {entry.time === 'morning' ? 'Morning' : 'Evening'}
            </Text>

            <View style={s.themeRow}>
              <View style={[s.themeDot, { backgroundColor: theme.color }]} />
              <Text style={[s.themeLabel, { color: theme.color }]}>{theme.label}</Text>
            </View>

            <AnimatedPressable
              onPress={nextRandom}
              scaleDown={0.95}
              style={s.anotherBtn}
            >
              <Text style={s.anotherBtnText}>Show me another ✦</Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={() => { setRevealed(false); }}
              scaleDown={0.95}
            >
              <Text style={s.hideText}>Hide again</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>

      <View style={s.bottom}>
        <Text style={s.bottomText}>
          Sometimes looking back at the little things{'\n'}reminds you how far you've come.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1917' },
  topBar: { paddingHorizontal: 24, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  // Pre-reveal
  preReveal: { alignItems: 'center' },
  glowOuter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(245,158,11,0.1)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  glowInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(245,158,11,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  preLabel: { fontSize: 10, color: 'rgba(245,158,11,0.5)', fontWeight: '500', letterSpacing: 2, marginBottom: 8 },
  preSub: { fontSize: 14, color: '#78716c', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  revealBtn: {
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  revealBtnText: { fontSize: 14, fontWeight: '600', color: '#fbbf24' },

  // Revealed
  revealed: { alignItems: 'center', width: '100%' },
  entryCard: {
    borderRadius: 20, borderWidth: 1, padding: 20, width: '100%', marginBottom: 12,
  },
  entryText: {
    fontSize: 16, color: '#44403c', lineHeight: 24, fontWeight: '500', fontStyle: 'italic', textAlign: 'center',
  },
  entryMeta: { fontSize: 11, color: '#78716c', marginBottom: 8 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 },
  themeDot: { width: 7, height: 7, borderRadius: 4 },
  themeLabel: { fontSize: 11, fontWeight: '500' },
  anotherBtn: {
    backgroundColor: '#44403c', borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center',
    marginBottom: 12,
  },
  anotherBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  hideText: { fontSize: 12, color: '#78716c', textDecorationLine: 'underline' },

  // Bottom
  bottom: { paddingHorizontal: 32, paddingBottom: 40 },
  bottomText: { fontSize: 11, color: '#44403c', textAlign: 'center', lineHeight: 18 },

  // Empty state
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: '#78716c', textAlign: 'center', lineHeight: 20 },
});

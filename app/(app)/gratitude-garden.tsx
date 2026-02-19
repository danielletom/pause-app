import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, SafeAreaView, ScrollView, StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Svg, { Circle, G } from 'react-native-svg';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

/* ── Theme meta ──────────────────────────────────────────────────── */
const THEME_META: Record<string, { label: string; emoji: string; color: string }> = {
  people:  { label: 'People',        emoji: '💛', color: '#f59e0b' },
  health:  { label: 'My body',       emoji: '✨', color: '#10b981' },
  moments: { label: 'Small moments', emoji: '🌿', color: '#14b8a6' },
  comfort: { label: 'Comfort',       emoji: '☕', color: '#f97316' },
  growth:  { label: 'Growth',        emoji: '🌱', color: '#84cc16' },
};

const LEGEND_BG: Record<string, string> = {
  people: '#fbbf24', health: '#34d399', moments: '#2dd4bf', comfort: '#fb923c', growth: '#a3e635',
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

const screenWidth = Dimensions.get('window').width;

export default function GratitudeGardenScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const router = useRouter();
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getTokenRef.current();
      const data = await apiRequest('/api/gratitude?range=90d', token).catch(() => []);
      if (Array.isArray(data)) setEntries(data);
      hasLoadedOnce.current = true;
    } catch { hasLoadedOnce.current = true; } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // Generate bloom positions in a spiral
  const blooms = entries.map((entry, i) => {
    const angle = i * 0.65;
    const radius = 28 + i * 4.5;
    const x = 50 + Math.cos(angle) * radius * 0.48;
    const y = 48 + Math.sin(angle) * radius * 0.48;
    const moodSize = (entry.mood || 3) >= 5 ? 18 : (entry.mood || 3) >= 4 ? 14 : 10;
    const color = THEME_META[entry.theme || 'moments']?.color || '#f59e0b';
    return { ...entry, x, y, size: moodSize, color };
  });

  // Theme counts for legend
  const themeCounts: Record<string, number> = {};
  entries.forEach(e => {
    const t = e.theme || 'moments';
    themeCounts[t] = (themeCounts[t] || 0) + 1;
  });

  const selectedBloom = selectedIndex !== null ? blooms[selectedIndex] : null;
  const svgSize = screenWidth - 48;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.topBar}>
          <BackButton light />
        </View>
        <Text style={s.label}>YOUR GRATITUDE</Text>
        <Text style={s.title}>Garden</Text>
        <Text style={s.subtitle}>
          Each bloom is something you were grateful for. Bigger = stronger feeling.
        </Text>

        {/* SVG Garden */}
        <View style={s.gardenWrap}>
          <View style={s.gardenContainer}>
            {entries.length === 0 ? (
              <View style={s.gardenEmpty}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🌸</Text>
                <Text style={s.gardenEmptyText}>Log your first gratitude to plant a bloom</Text>
              </View>
            ) : (
              <Svg width={svgSize} height={svgSize * 0.85} viewBox="0 0 100 100">
                {/* Concentric rings */}
                <Circle cx="50" cy="48" r="15" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.3} />
                <Circle cx="50" cy="48" r="28" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.3} />
                <Circle cx="50" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.3} />
                {/* Center glow */}
                <Circle cx="50" cy="48" r="3" fill="rgba(251,191,36,0.15)" />
                <Circle cx="50" cy="48" r="1.5" fill="rgba(251,191,36,0.3)" />
                {/* Blooms */}
                {blooms.map((b, i) => (
                  <G key={b.id} onPress={() => { hapticSelection(); setSelectedIndex(selectedIndex === i ? null : i); }}>
                    <Circle cx={b.x} cy={b.y} r={b.size * 0.08 + 1.5} fill={b.color} opacity={selectedIndex === i ? 0.4 : 0.12} />
                    <Circle cx={b.x} cy={b.y} r={b.size * 0.06} fill={b.color} opacity={selectedIndex === i ? 1 : 0.7} />
                    <Circle cx={b.x + 0.3} cy={b.y - 0.3} r={b.size * 0.02} fill="white" opacity={0.6} />
                  </G>
                ))}
              </Svg>
            )}

            {/* Selected bloom overlay */}
            {selectedBloom && (
              <View style={s.bloomOverlay}>
                <View style={s.bloomOverlayInner}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>
                    {THEME_META[selectedBloom.theme || 'moments']?.emoji}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bloomText}>"{selectedBloom.text}"</Text>
                    <Text style={s.bloomMeta}>
                      {formatDate(selectedBloom.date)} · {selectedBloom.time === 'morning' ? 'Morning' : 'Evening'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Legend */}
        <View style={s.legend}>
          {Object.entries(THEME_META).map(([key, meta]) => {
            const count = themeCounts[key] || 0;
            if (count === 0) return null;
            return (
              <View key={key} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: LEGEND_BG[key] || meta.color }]} />
                <Text style={s.legendLabel}>{meta.label}</Text>
                <Text style={s.legendCount}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Growth note */}
        <View style={s.growthNote}>
          <Text style={s.growthIcon}>✦</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.growthTitle}>Your garden is growing</Text>
            <Text style={s.growthBody}>
              You've noticed {entries.length} moment{entries.length !== 1 ? 's' : ''} of gratitude.
              People who practise gratitude regularly report 25% better sleep quality.
            </Text>
          </View>
        </View>

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
  container: { flex: 1, backgroundColor: '#1c1917' },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },
  topBar: { paddingTop: 8, marginBottom: 4 },
  label: { fontSize: 10, color: 'rgba(245,158,11,0.6)', fontWeight: '500', letterSpacing: 1, marginTop: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  subtitle: { fontSize: 11, color: '#78716c', marginTop: 4, marginBottom: 16, lineHeight: 16 },

  gardenWrap: { marginHorizontal: -8, marginBottom: 20 },
  gardenContainer: {
    borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', alignItems: 'center', paddingVertical: 8,
  },
  gardenEmpty: { padding: 48, alignItems: 'center' },
  gardenEmptyText: { fontSize: 12, color: '#78716c', textAlign: 'center' },

  bloomOverlay: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
  },
  bloomOverlayInner: {
    backgroundColor: 'rgba(28,25,23,0.9)', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'flex-start',
  },
  bloomText: { fontSize: 13, color: '#ffffff', fontWeight: '500', fontStyle: 'italic', lineHeight: 18 },
  bloomMeta: { fontSize: 10, color: '#78716c', marginTop: 4 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: '#78716c' },
  legendCount: { fontSize: 11, color: '#a8a29e', fontWeight: '600' },

  growthNote: {
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
    backgroundColor: 'rgba(245,158,11,0.05)', padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20,
  },
  growthIcon: { fontSize: 16, color: '#f59e0b' },
  growthTitle: { fontSize: 12, color: 'rgba(245,158,11,0.7)', fontWeight: '500' },
  growthBody: { fontSize: 11, color: '#78716c', marginTop: 4, lineHeight: 16 },

  backButton: {
    backgroundColor: '#1c1917', borderRadius: 16, borderWidth: 1,
    borderColor: '#44403c', paddingVertical: 14, alignItems: 'center',
  },
  backButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});

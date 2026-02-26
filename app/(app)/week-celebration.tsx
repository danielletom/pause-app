import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticSuccess, hapticMedium } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';
import { getCheckInDays } from '@/lib/trial';
import { useDelight, DELIGHT_KEYS } from '@/lib/delight-context';

export default function WeekCelebrationScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { markSeen } = useDelight();
  const [stats, setStats] = useState({ checkIns: 0, avgSleep: '—', symptoms: 0 });

  useFocusEffect(
    useCallback(() => {
      hapticSuccess();
      (async () => {
        try {
          const token = await getToken();
          const logs = await apiRequest('/api/logs?range=28d', token).catch(() => []);
          const entries = Array.isArray(logs) ? logs : [];
          const checkIns = getCheckInDays(entries);

          // Average sleep
          const sleepEntries = entries.filter((l: any) => l.sleepHours != null);
          const avgSleep = sleepEntries.length > 0
            ? (sleepEntries.reduce((sum: number, l: any) => sum + l.sleepHours, 0) / sleepEntries.length).toFixed(1)
            : '—';

          // Unique symptoms
          const symptomSet = new Set<string>();
          entries.forEach((l: any) => {
            if (l.symptomsJson && typeof l.symptomsJson === 'object') {
              Object.keys(l.symptomsJson).forEach((k) => symptomSet.add(k));
            }
          });

          setStats({ checkIns, avgSleep: `${avgSleep}h`, symptoms: symptomSet.size });
        } catch {}
      })();
      markSeen(DELIGHT_KEYS.WEEK_CELEBRATION);
    }, []),
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Text style={s.emoji}>🎯</Text>
        <Text style={s.heading}>
          One week of listening{'\n'}to your body
        </Text>
        <Text style={s.subheading}>
          Your body is starting to talk. Ready to hear what it's saying?
        </Text>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statNum}>{stats.checkIns}</Text>
            <Text style={s.statLabel}>check-ins</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{stats.avgSleep}</Text>
            <Text style={s.statLabel}>avg sleep</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{stats.symptoms}</Text>
            <Text style={s.statLabel}>symptoms</Text>
          </View>
        </View>
      </View>

      <View style={s.footer}>
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            router.replace('/(app)/insights' as any);
          }}
          scaleDown={0.96}
          style={s.primaryBtn}
        >
          <Text style={s.primaryBtnText}>See your first insights →</Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => router.replace('/(app)' as any)}
          scaleDown={0.97}
          style={s.ghostBtn}
        >
          <Text style={s.ghostBtnText}>Maybe later</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffbeb' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 48, marginBottom: 20 },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1c1917',
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  subheading: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  stat: {
    flex: 1,
    backgroundColor: '#fafaf9',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '800', color: '#1c1917' },
  statLabel: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  primaryBtn: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  ghostBtnText: {
    fontSize: 14,
    color: '#78716c',
    textDecorationLine: 'underline',
  },
});

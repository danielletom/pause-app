import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

export default function LogScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check what's already logged today
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const token = await getToken();
          const today = new Date().toISOString().split('T')[0];
          const logs = await apiRequest(`/api/logs?date=${today}`, token).catch(() => []);
          const entries = Array.isArray(logs) ? logs : [];
          setMorningDone(entries.some((e: any) => e.logType === 'morning'));
          setEveningDone(entries.some((e: any) => e.logType === 'evening'));
        } catch {
          // Non-critical
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const hour = new Date().getHours();
  const suggestEvening = hour >= 14 || morningDone;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Check in</Text>
        <Text style={styles.subtitle}>How's your day going?</Text>

        {/* Morning card */}
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            router.push({ pathname: '/(app)/quick-log', params: { mode: 'morning' } });
          }}
          scaleDown={0.97}
          style={[
            styles.card,
            morningDone && styles.cardDone,
            !suggestEvening && !morningDone && styles.cardHighlighted,
          ]}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardEmoji}>☀️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, morningDone && styles.cardTitleDone]}>
                Morning check-in
              </Text>
              <Text style={styles.cardDesc}>
                {morningDone ? 'Completed ✓' : 'Sleep, mood & what\'s ahead'}
              </Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </AnimatedPressable>

        {/* Evening card */}
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            router.push({ pathname: '/(app)/quick-log', params: { mode: 'evening' } });
          }}
          scaleDown={0.97}
          style={[
            styles.card,
            eveningDone && styles.cardDone,
            suggestEvening && !eveningDone && styles.cardHighlighted,
          ]}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardEmoji}>🌙</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, eveningDone && styles.cardTitleDone]}>
                Evening check-in
              </Text>
              <Text style={styles.cardDesc}>
                {eveningDone ? 'Completed ✓' : 'Symptoms, mood & triggers'}
              </Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </AnimatedPressable>

        {/* Helper text */}
        <Text style={styles.helperText}>
          {morningDone && eveningDone
            ? 'Both check-ins done today — great job! 🎉'
            : '3 steps · about 30 seconds each'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#a8a29e',
    marginBottom: 32,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHighlighted: {
    borderColor: '#1c1917',
  },
  cardDone: {
    opacity: 0.55,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 2,
  },
  cardTitleDone: {
    color: '#78716c',
  },
  cardDesc: {
    fontSize: 13,
    color: '#a8a29e',
  },
  cardArrow: {
    fontSize: 20,
    color: '#d6d3d1',
  },

  helperText: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
    marginTop: 16,
  },
});

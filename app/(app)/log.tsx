import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium } from '@/lib/haptics';

export default function LogScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>What do you want to log?</Text>
        <Text style={styles.subtitle}>Track symptoms or medications</Text>

        {/* Symptoms & mood — routes to quick-log based on time of day */}
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            const hour = new Date().getHours();
            const mode = hour < 14 ? 'morning' : 'evening';
            router.push({ pathname: '/(app)/quick-log', params: { mode } });
          }}
          scaleDown={0.97}
          style={[styles.card, styles.cardPrimary]}
        >
          <View style={styles.cardRow}>
            <View style={[styles.cardIcon, styles.cardIconDark]}>
              <Text style={styles.cardIconEmoji}>📋</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Symptoms & mood</Text>
              <Text style={styles.cardDesc}>Quick 30-second check-in</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </AnimatedPressable>

        {/* Medications — routes to meds screen */}
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            router.push('/(app)/meds');
          }}
          scaleDown={0.97}
          style={[styles.card, styles.cardSecondary]}
        >
          <View style={styles.cardRow}>
            <View style={[styles.cardIcon, styles.cardIconAmber]}>
              <Text style={styles.cardIconEmoji}>💊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Medications & supplements</Text>
              <Text style={styles.cardDesc}>Mark today's doses as taken</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </AnimatedPressable>

        {/* Detailed log */}
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            router.push('/(app)/detailed-log');
          }}
          scaleDown={0.97}
          style={styles.card}
        >
          <View style={styles.cardRow}>
            <View style={[styles.cardIcon, styles.cardIconLight]}>
              <Text style={styles.cardIconEmoji}>📝</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Detailed log</Text>
              <Text style={styles.cardDesc}>Symptoms, sleep, cycle, context</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#a8a29e',
    marginBottom: 24,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardPrimary: {
    borderWidth: 2,
    borderColor: '#1c1917',
  },
  cardSecondary: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconDark: { backgroundColor: '#1c1917' },
  cardIconAmber: { backgroundColor: '#fffbeb' },
  cardIconLight: { backgroundColor: '#f5f5f4' },
  cardIconEmoji: { fontSize: 22 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#a8a29e',
  },
  cardArrow: {
    fontSize: 20,
    color: '#d6d3d1',
  },
});

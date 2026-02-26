import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticMedium, hapticSelection } from '@/lib/haptics';
import { useProfile } from '@/lib/useProfile';
import { apiRequest } from '@/lib/api';
import { getTrialDay, getCheckInDays } from '@/lib/trial';

const OUTCOMES = [
  'Continue daily check-ins & symptom tracking',
  'New patterns unlock as your data grows',
  'Doctor-ready reports whenever you need them',
  'Sleep, mood & hot flash insights',
  '"Am I Normal?" — see how you compare',
  'Wearable sync for smarter tracking',
];

export default function PaywallScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { profile } = useProfile();
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [stats, setStats] = useState({ days: 0, patterns: 0, lessons: 0 });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const token = await getToken();
          const [logs, correlations, progress] = await Promise.all([
            apiRequest('/api/logs?range=90d', token).catch(() => []),
            apiRequest('/api/correlations', token).catch(() => ({ correlations: [] })),
            apiRequest('/api/program/progress', token).catch(() => null),
          ]);
          const days = getCheckInDays(Array.isArray(logs) ? logs : []);
          const patterns = Array.isArray(correlations?.correlations) ? correlations.correlations.length : 0;
          const lessons = progress?.totalDone || 0;
          setStats({ days, patterns, lessons });
        } catch {}
      })();
    }, []),
  );

  const trialDay = getTrialDay(profile?.createdAt);
  const displayDays = stats.days || trialDay;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Close */}
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <Ionicons name="close" size={22} color="#a8a29e" />
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Text style={{ fontSize: 28 }}>✦</Text>
          </View>
          <Text style={s.heroTitle}>
            Your body told you{'\n'}a lot in {displayDays} days
          </Text>
          <Text style={s.heroSub}>Keep listening. Keep learning.</Text>
        </View>

        {/* Personal stats */}
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{displayDays}</Text>
            <Text style={s.statLabel}>days logged</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{stats.patterns}</Text>
            <Text style={s.statLabel}>patterns found</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{stats.lessons}</Text>
            <Text style={s.statLabel}>Pod lessons</Text>
          </View>
        </View>

        {/* Outcomes */}
        <Text style={s.sectionLabel}>WHAT YOU GET</Text>
        <View style={s.outcomeList}>
          {OUTCOMES.map((text) => (
            <View key={text} style={s.outcomeRow}>
              <View style={s.checkCircle}>
                <Text style={s.checkMark}>✓</Text>
              </View>
              <Text style={s.outcomeText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Plan toggle */}
        <View style={s.toggleRow}>
          <AnimatedPressable
            onPress={() => { hapticSelection(); setPlan('monthly'); }}
            scaleDown={0.97}
            style={[s.toggleItem, plan === 'monthly' && s.toggleActive]}
          >
            <Text style={[s.toggleTitle, plan === 'monthly' && s.toggleTitleActive]}>Monthly</Text>
            <Text style={[s.togglePrice, plan === 'monthly' && s.togglePriceActive]}>$7.99/mo</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { hapticSelection(); setPlan('annual'); }}
            scaleDown={0.97}
            style={[s.toggleItem, plan === 'annual' && s.toggleActive]}
          >
            <Text style={[s.toggleTitle, plan === 'annual' && s.toggleTitleActive]}>Annual</Text>
            <Text style={[s.togglePrice, plan === 'annual' && s.togglePriceActive]}>$5.99/mo</Text>
            <View style={s.saveBadge}>
              <Text style={s.saveBadgeText}>SAVE 25%</Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* Price display */}
        <View style={s.priceDisplay}>
          <Text style={s.priceAmount}>
            {plan === 'annual' ? '$5.99' : '$7.99'}
            <Text style={s.priceUnit}>/month</Text>
          </Text>
          <Text style={s.priceSub}>
            {plan === 'annual'
              ? '$71.88 billed once per year'
              : 'Billed monthly · No commitment'}
          </Text>
        </View>

        {/* CTA */}
        <AnimatedPressable
          onPress={() => {
            hapticMedium();
            // TODO: integrate with RevenueCat / Apple IAP
          }}
          scaleDown={0.97}
          style={s.ctaButton}
        >
          <Text style={s.ctaText}>Continue with Pause</Text>
        </AnimatedPressable>

        {/* Trust signals */}
        <View style={s.trustRow}>
          <Text style={s.trustText}>🔒 Cancel anytime</Text>
          <Text style={s.trustText}>💚 SOS always free</Text>
        </View>
        <Text style={s.dataNote}>Your data stays yours, always</Text>

        {/* Restore + terms */}
        <View style={s.linksRow}>
          <TouchableOpacity>
            <Text style={s.linkText}>Restore purchase</Text>
          </TouchableOpacity>
          <Text style={s.linkDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/terms')}>
            <Text style={s.linkText}>Terms</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffbeb' },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingTop: 12,
    paddingBottom: 4,
  },
  hero: { alignItems: 'center', marginBottom: 20 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1c1917',
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heroSub: { fontSize: 14, color: '#a8a29e', marginTop: 6 },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#f59e0b' },
  statLabel: { fontSize: 11, color: '#a8a29e', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#f5f5f4' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716c',
    letterSpacing: 1,
    marginBottom: 10,
  },
  outcomeList: { marginBottom: 20 },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkMark: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  outcomeText: { fontSize: 14, color: '#44403c', flex: 1, lineHeight: 20 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  toggleItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  toggleActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  toggleTitle: { fontSize: 13, fontWeight: '600', color: '#78716c' },
  toggleTitleActive: { color: '#1c1917' },
  togglePrice: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  togglePriceActive: { color: '#1c1917', fontWeight: '700' },
  saveBadge: {
    position: 'absolute',
    top: -6,
    right: 8,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  saveBadgeText: { fontSize: 9, fontWeight: '700', color: '#16a34a' },
  priceDisplay: { alignItems: 'center', marginBottom: 12 },
  priceAmount: { fontSize: 32, fontWeight: '800', color: '#1c1917' },
  priceUnit: { fontSize: 14, fontWeight: '500', color: '#78716c' },
  priceSub: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  ctaButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#1c1917' },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 6,
  },
  trustText: { fontSize: 12, color: '#a8a29e' },
  dataNote: { fontSize: 12, color: '#a8a29e', textAlign: 'center', marginBottom: 16 },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  linkText: {
    fontSize: 12,
    color: '#a8a29e',
    textDecorationLine: 'underline',
  },
  linkDot: { fontSize: 12, color: '#a8a29e' },
});

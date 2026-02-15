import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useUser, useClerk, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useProfile, formatStage, formatTrackingSince } from '@/lib/useProfile';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { apiRequest } from '@/lib/api';

const __DEV__ = process.env.NODE_ENV !== 'production';

const MENU_ITEMS = [
  { label: 'Edit profile', desc: 'Name, email, account', icon: '✏️', route: '/(app)/edit-profile' },
  { label: 'About me', desc: 'Weight, height, birthday, stage', icon: '👤', route: '/(app)/about-me' },
  { label: 'Medications', desc: 'Supplements, HRT, labs & tracking', icon: '💊', route: '/(app)/meds' },
  { label: 'Custom tracking', desc: 'Add your own symptoms or triggers', icon: '✦' },
  { label: 'Notifications', desc: 'Reminders, insights, SMS', icon: '🔔' },
  { label: 'Manage subscription', desc: 'Plan, billing, upgrade', icon: '⭐' },
  { label: 'Wearable devices', desc: 'Apple Watch, Oura Ring', icon: '⌚', badge: 'Premium' },
  { label: 'Export my data', desc: 'Download your full history', icon: '📤', route: '/(app)/export-data' },
  { label: 'Terms & Privacy', desc: 'Terms of service, privacy policy', icon: '📄', route: '/(app)/legal' },
  { label: 'Help & feedback', desc: 'Contact us or request a feature', icon: '💬', route: '/(app)/help-feedback' },
];

export default function ProfileScreen() {
  const { user } = useUser();
  const clerk = useClerk();
  const { getToken } = useAuth();
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [resettingOnboarding, setResettingOnboarding] = useState(false);

  const displayName = profile?.name?.split(' ')[0] || user?.firstName || 'You';
  const initial = displayName[0]?.toUpperCase() || '?';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const stage = formatStage(profile?.stage);
  const trackingSince = formatTrackingSince(profile?.createdAt);
  const joinedLabel = trackingSince || 'Recently joined';

  const handleReplayOnboarding = () => {
    Alert.alert(
      'Replay onboarding',
      'This will reset your onboarding status and take you through the full onboarding flow again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & replay',
          style: 'destructive',
          onPress: async () => {
            try {
              setResettingOnboarding(true);
              const token = await getToken();
              await apiRequest('/api/profile', token, {
                method: 'POST',
                body: JSON.stringify({ onboardingComplete: false }),
              });
              router.replace('/');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to reset onboarding');
              setResettingOnboarding(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clerk.signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1c1917" />
          </View>
        ) : (
          <>
            {/* Subscription Card — dark */}
            <View style={styles.subCard}>
              <Text style={styles.subLabel}>Your plan</Text>
              <Text style={styles.subTitle}>You're on the free plan</Text>
              <Text style={styles.subDesc}>Basic logging, SOS, limited insights</Text>
              <TouchableOpacity style={styles.subButtonPrimary} activeOpacity={0.8}>
                <Text style={styles.subButtonPrimaryText}>Get Pause Premium — $7.99/mo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.subButtonGold} activeOpacity={0.8}>
                <Text style={styles.subButtonGoldText}>Try Pause+ — from $39/mo</Text>
              </TouchableOpacity>
            </View>

            {/* Account Info Card */}
            <View style={styles.accountCard}>
              <View style={styles.accountRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{displayName}</Text>
                  <Text style={styles.accountEmail}>{email}</Text>
                </View>
              </View>
              <View style={styles.accountMeta}>
                {stage !== 'Not set' && <Text style={styles.accountMetaText}>{stage}</Text>}
                {stage !== 'Not set' && <Text style={styles.accountMetaDot}>·</Text>}
                <Text style={styles.accountMetaText}>{joinedLabel}</Text>
              </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menuContainer}>
              {MENU_ITEMS.map((item) => (
                <AnimatedPressable
                  key={item.label}
                  onPress={() => {
                    hapticLight();
                    if ((item as any).route) router.push((item as any).route);
                  }}
                  scaleDown={0.98}
                  style={styles.menuCard}
                >
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.menuLabelRow}>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      {item.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.menuDesc}>{item.desc}</Text>
                  </View>
                  <Text style={styles.menuChevron}>›</Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Dev tools */}
            {__DEV__ && (
              <View style={styles.devSection}>
                <Text style={styles.devSectionLabel}>Developer</Text>
                <AnimatedPressable
                  onPress={() => { hapticLight(); handleReplayOnboarding(); }}
                  scaleDown={0.97}
                  style={styles.devCard}
                  disabled={resettingOnboarding}
                >
                  <Text style={{ fontSize: 16 }}>🔄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devLabel}>Replay onboarding</Text>
                    <Text style={styles.devDesc}>Reset & go through the full flow</Text>
                  </View>
                  {resettingOnboarding ? (
                    <ActivityIndicator size="small" color="#f59e0b" />
                  ) : (
                    <Text style={styles.menuChevron}>›</Text>
                  )}
                </AnimatedPressable>
              </View>
            )}

            {/* Logout */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => { hapticMedium(); handleSignOut(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>

            {/* Delete account */}
            <TouchableOpacity style={styles.deleteButton} activeOpacity={0.7}>
              <Text style={styles.deleteText}>Delete my account</Text>
            </TouchableOpacity>

            {/* Version */}
            <Text style={styles.versionText}>pause v1.0.0</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  loadingContainer: { flex: 1, paddingTop: 80, alignItems: 'center' },

  // Header
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917' },

  // Subscription card
  subCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
  },
  subLabel: { fontSize: 12, color: '#78716c', marginBottom: 6 },
  subTitle: { fontSize: 14, fontWeight: '500', color: '#ffffff', marginBottom: 2 },
  subDesc: { fontSize: 12, color: '#78716c', marginBottom: 16 },
  subButtonPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 8,
  },
  subButtonPrimaryText: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
  subButtonGold: {
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  subButtonGoldText: { fontSize: 13, fontWeight: '600', color: '#1c1917' },

  // Account info
  accountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '500', color: '#ffffff' },
  accountName: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  accountEmail: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  accountMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountMetaText: { fontSize: 12, color: '#a8a29e' },
  accountMetaDot: { fontSize: 12, color: '#a8a29e' },

  // Menu items
  menuContainer: { gap: 6, marginBottom: 20 },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  menuIcon: { fontSize: 16 },
  menuLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuLabel: { fontSize: 14, fontWeight: '500', color: '#1c1917' },
  menuDesc: { fontSize: 12, color: '#a8a29e', marginTop: 1 },
  menuChevron: { fontSize: 18, color: '#d6d3d1' },
  badge: {
    backgroundColor: '#f5f5f4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#78716c' },

  // Dev section
  devSection: { marginBottom: 20 },
  devSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a8a29e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  devCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderStyle: 'dashed',
  },
  devLabel: { fontSize: 13, fontWeight: '600', color: '#1c1917' },
  devDesc: { fontSize: 11, color: '#a8a29e', marginTop: 1 },

  // Logout / delete
  logoutButton: {
    backgroundColor: '#f5f5f4',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  logoutText: { fontSize: 14, fontWeight: '500', color: '#78716c' },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  deleteText: { fontSize: 12, color: '#ef4444', textDecorationLine: 'underline' },

  // Version
  versionText: { fontSize: 11, color: '#d6d3d1', textAlign: 'center', marginBottom: 8 },
});

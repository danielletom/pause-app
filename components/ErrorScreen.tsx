import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedPressable from './AnimatedPressable';
import { hapticLight, hapticMedium } from '@/lib/haptics';

/* ────────────────────────────────────────────────────────
   Error types the app can display
   ──────────────────────────────────────────────────────── */
export type ErrorType =
  | 'generic'
  | 'no_connection'
  | 'timeout'
  | 'not_found'
  | 'server'
  | 'update_required'
  | 'maintenance';

interface ErrorScreenProps {
  type?: ErrorType;
  /** Override the retry callback (default: router.back) */
  onRetry?: () => void;
  /** Override the go-home callback */
  onGoHome?: () => void;
  /** Maintenance: estimated return time string */
  estimatedReturn?: string;
  /** Maintenance: minutes remaining */
  minutesRemaining?: number;
  /** Update: list of what's new */
  whatsNew?: string[];
}

/* ────────────────────────────────────────────────────────
   Config per error type
   ──────────────────────────────────────────────────────── */
const ERROR_CONFIG: Record<
  ErrorType,
  { icon: string; iconBg: string; title: string; body: string }
> = {
  generic: {
    icon: '⚠️',
    iconBg: '#fef3c7', // amber-50
    title: 'Something went wrong',
    body: "Not your fault — and usually temporary. Your data is safe.",
  },
  no_connection: {
    icon: '📡',
    iconBg: '#f5f5f4', // stone-100
    title: 'No internet connection',
    body: "Your check-in data is saved on your device. We will sync everything the moment you are back online.",
  },
  timeout: {
    icon: '⏱️',
    iconBg: '#fef3c7',
    title: 'Taking longer than usual',
    body: "Our servers are a bit slow right now. Your data is safe, nothing was lost.",
  },
  not_found: {
    icon: '🔍',
    iconBg: '#f5f5f4',
    title: 'Page not found',
    body: "This page might have moved or no longer exists. Let us take you somewhere useful.",
  },
  server: {
    icon: '🔧',
    iconBg: '#fff1f2', // rose-50
    title: 'Something broke on our end',
    body: "Our team has been notified and is on it. Your data is safe. Sorry about this.",
  },
  update_required: {
    icon: '✨',
    iconBg: '#fef3c7',
    title: 'Time for an update',
    body: "We have made Pause even better. Update to the latest version to keep things running smoothly.",
  },
  maintenance: {
    icon: '🌙',
    iconBg: '#eef2ff', // indigo-50
    title: 'Back shortly',
    body: "We are making some improvements behind the scenes. Usually takes less than 30 minutes.",
  },
};

/* ────────────────────────────────────────────────────────
   Offline features list (for no_connection + maintenance)
   ──────────────────────────────────────────────────────── */
const OFFLINE_FEATURES = [
  { label: 'SOS breathing tool', icon: '🫁', note: 'Works offline' },
  { label: 'Morning & evening check-in', icon: '📝', note: 'Saved on device' },
  { label: 'View recent journal entries', icon: '📖', note: 'Saved on device' },
];

/* ────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────── */
export default function ErrorScreen({
  type = 'generic',
  onRetry,
  onGoHome,
  estimatedReturn,
  minutesRemaining,
  whatsNew,
}: ErrorScreenProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const config = ERROR_CONFIG[type];

  const handleRetry = () => {
    hapticMedium();
    if (onRetry) {
      onRetry();
    } else {
      router.back();
    }
  };

  const handleGoHome = () => {
    hapticLight();
    if (onGoHome) {
      onGoHome();
    } else {
      router.replace('/(app)/(tabs)');
    }
  };

  const handleCheckConnection = async () => {
    hapticMedium();
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (onRetry) onRetry();
    }, 2000);
  };

  const handleUpdate = () => {
    hapticMedium();
    const storeUrl = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/pause' // TODO: replace with real ID
      : 'https://play.google.com/store/apps/details?id=com.pause';
    Linking.openURL(storeUrl);
  };

  const handleContact = () => {
    hapticLight();
    Linking.openURL('mailto:support@pauseapp.com');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
          <Text style={styles.icon}>{config.icon}</Text>
        </View>

        {/* Title + Body */}
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.body}>{config.body}</Text>

        {/* Buttons — vary by type */}
        <View style={styles.actions}>
          {type === 'no_connection' && (
            <>
              <AnimatedPressable style={styles.btnPrimary} onPress={handleCheckConnection}>
                {checking ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.btnPrimaryText}>Checking…</Text>
                  </View>
                ) : (
                  <Text style={styles.btnPrimaryText}>Try again</Text>
                )}
              </AnimatedPressable>
              <AnimatedPressable style={styles.btnSecondary} onPress={handleGoHome}>
                <Text style={styles.btnSecondaryText}>Continue offline</Text>
              </AnimatedPressable>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Available offline</Text>
                {OFFLINE_FEATURES.map((f) => (
                  <View key={f.label} style={styles.offlineRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                    <Text style={styles.offlineText}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {type === 'timeout' && (
            <>
              <AnimatedPressable style={styles.btnPrimary} onPress={handleRetry}>
                <Text style={styles.btnPrimaryText}>Try again</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.btnSecondary} onPress={handleGoHome}>
                <Text style={styles.btnSecondaryText}>Go home</Text>
              </AnimatedPressable>
            </>
          )}

          {type === 'not_found' && (
            <>
              <AnimatedPressable style={styles.btnPrimary} onPress={handleGoHome}>
                <Text style={styles.btnPrimaryText}>Go home</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.btnSecondary} onPress={handleRetry}>
                <Text style={styles.btnSecondaryText}>Go back</Text>
              </AnimatedPressable>
            </>
          )}

          {type === 'server' && (
            <>
              <AnimatedPressable style={styles.btnPrimary} onPress={handleRetry}>
                <Text style={styles.btnPrimaryText}>Try again</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.btnSecondary} onPress={handleGoHome}>
                <Text style={styles.btnSecondaryText}>Go home</Text>
              </AnimatedPressable>
              <View style={styles.infoCard}>
                <Text style={styles.infoCentered}>Still having trouble?</Text>
                <AnimatedPressable onPress={handleContact}>
                  <Text style={styles.linkText}>Contact support</Text>
                </AnimatedPressable>
              </View>
            </>
          )}

          {type === 'update_required' && (
            <>
              <AnimatedPressable style={styles.btnPrimary} onPress={handleUpdate}>
                <Text style={styles.btnPrimaryText}>Update now</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={handleGoHome}>
                <Text style={styles.ghostText}>Remind me later</Text>
              </AnimatedPressable>
              {whatsNew && whatsNew.length > 0 && (
                <View style={[styles.infoCard, styles.amberCard]}>
                  <Text style={styles.amberLabel}>What's new</Text>
                  {whatsNew.map((item) => (
                    <View key={item} style={styles.bulletRow}>
                      <Text style={styles.amberBullet}>•</Text>
                      <Text style={styles.amberText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {type === 'maintenance' && (
            <>
              {(estimatedReturn || minutesRemaining) && (
                <View style={[styles.infoCard, styles.indigoCard]}>
                  <Text style={styles.indigoLabel}>Estimated return</Text>
                  {estimatedReturn && (
                    <Text style={styles.indigoTime}>{estimatedReturn}</Text>
                  )}
                  {minutesRemaining != null && (
                    <Text style={styles.indigoSub}>
                      About {minutesRemaining} minutes
                    </Text>
                  )}
                </View>
              )}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>While you wait</Text>
                {OFFLINE_FEATURES.slice(0, 2).map((f) => (
                  <AnimatedPressable
                    key={f.label}
                    style={styles.offlineAction}
                    onPress={handleGoHome}
                  >
                    <Text style={styles.offlineIcon}>{f.icon}</Text>
                    <View>
                      <Text style={styles.offlineActionLabel}>{f.label}</Text>
                      <Text style={styles.offlineActionNote}>{f.note}</Text>
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
              <AnimatedPressable onPress={handleRetry}>
                <Text style={styles.ghostText}>Check again</Text>
              </AnimatedPressable>
            </>
          )}

          {type === 'generic' && (
            <>
              <AnimatedPressable style={styles.btnPrimary} onPress={handleRetry}>
                <Text style={styles.btnPrimaryText}>Try again</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.btnSecondary} onPress={handleGoHome}>
                <Text style={styles.btnSecondaryText}>Go home</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={handleContact}>
                <Text style={styles.ghostText}>Contact support</Text>
              </AnimatedPressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────────────
   Styles
   ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // Icon
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 32,
  },

  // Typography
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1917',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
    marginBottom: 32,
  },

  // Actions container
  actions: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
    alignItems: 'center',
  },

  // Primary button
  btnPrimary: {
    width: '100%',
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Secondary button
  btnSecondary: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#44403c',
  },

  // Ghost button
  ghostText: {
    fontSize: 14,
    color: '#a8a29e',
    textDecorationLine: 'underline',
    marginTop: 4,
  },

  // Link text
  linkText: {
    fontSize: 13,
    color: '#44403c',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 4,
  },

  // Info card (generic)
  infoCard: {
    width: '100%',
    backgroundColor: '#fafaf9',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a8a29e',
    marginBottom: 10,
  },
  infoCentered: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
  },

  // Offline features
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#d1fae5', // emerald-100
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 8,
    color: '#059669', // emerald-600
    fontWeight: '700',
  },
  offlineText: {
    fontSize: 13,
    color: '#44403c',
  },

  // Offline action rows (maintenance)
  offlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  offlineIcon: {
    fontSize: 20,
  },
  offlineActionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#44403c',
  },
  offlineActionNote: {
    fontSize: 12,
    color: '#a8a29e',
  },

  // Amber card (update)
  amberCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  amberLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  amberBullet: {
    fontSize: 12,
    color: '#d97706',
    marginTop: 1,
  },
  amberText: {
    fontSize: 13,
    color: '#92400e',
  },

  // Indigo card (maintenance)
  indigoCard: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    paddingVertical: 20,
  },
  indigoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818cf8',
    marginBottom: 4,
  },
  indigoTime: {
    fontSize: 28,
    fontWeight: '300',
    color: '#312e81',
  },
  indigoSub: {
    fontSize: 12,
    color: '#818cf8',
    marginTop: 4,
  },
});

import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppleAuth } from '@/lib/useAppleAuth';

export default function WelcomeScreen() {
  const router = useRouter();
  const { signInWithApple, loading, error } = useAppleAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoCircle}>
          <View style={styles.logoDot} />
        </View>
        <Text style={styles.logoText}>pause</Text>
        <Text style={styles.tagline}>
          Understand your body.{'\n'}On your terms.
        </Text>
      </View>

      <View style={styles.footer}>
        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Primary: Continue with Apple */}
        <TouchableOpacity
          style={[styles.appleButton, loading && styles.buttonDisabled]}
          onPress={signInWithApple}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={styles.appleButtonContent}>
              <Ionicons name="logo-apple" size={20} color="#ffffff" />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Secondary: I already purchased */}
        <TouchableOpacity
          style={[styles.purchasedButton, loading && styles.buttonDisabled]}
          onPress={signInWithApple}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.purchasedButtonText}>I already purchased</Text>
        </TouchableOpacity>

        {/* Fallback links */}
        <View style={styles.fallbackRow}>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text style={styles.fallbackLink}>Sign up with email</Text>
          </TouchableOpacity>
          <Text style={styles.fallbackDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={styles.fallbackLink}>I have an account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.privacy}>Your data stays yours. Always.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1c1917',
    letterSpacing: -1,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 15,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '300',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  appleButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  appleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  purchasedButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  purchasedButtonText: {
    color: '#1c1917',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  fallbackRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fallbackLink: {
    fontSize: 14,
    color: '#78716c',
    fontWeight: '500',
  },
  fallbackDot: {
    fontSize: 14,
    color: '#d6d3d1',
  },
  privacy: {
    fontSize: 12,
    color: '#d6d3d1',
    textAlign: 'center',
    marginTop: 20,
  },
});

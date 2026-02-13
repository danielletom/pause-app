import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppleAuth } from '@/lib/useAppleAuth';

const __DEV__ = process.env.NODE_ENV !== 'production';
const TEST_EMAIL = 'test@pauseapp.dev';
const TEST_PASSWORD = 'TestPause2025!';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const { signInWithApple, loading: appleLoading, error: appleError } = useAppleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const useTestAccount = useCallback(async () => {
    if (!isLoaded) return;
    setEmail(TEST_EMAIL);
    setPassword(TEST_PASSWORD);
    setError('');
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else {
        setError('Test sign-in incomplete. Create the test account in Clerk first.');
      }
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Test account not found. Create it in Clerk dashboard first (test@pauseapp.dev / TestPause2025!)';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signIn, setActive, router]);

  const onSignIn = useCallback(async () => {
    if (!isLoaded) return;

    setError('');
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else {
        setError('Sign in could not be completed. Please try again.');
      }
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'An error occurred during sign in.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, email, password, signIn, setActive, router]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>pause</Text>
          </View>

          {/* Heading */}
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Sign in to continue tracking</Text>

          {/* Errors */}
          {(error || appleError) ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error || appleError}</Text>
            </View>
          ) : null}

          {/* Apple Sign In — Primary */}
          <TouchableOpacity
            style={[styles.appleButton, appleLoading && styles.buttonDisabled]}
            onPress={signInWithApple}
            disabled={appleLoading}
            activeOpacity={0.8}
          >
            {appleLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.appleButtonContent}>
                <Ionicons name="logo-apple" size={18} color="#ffffff" />
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email/Password Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#a8a29e"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#a8a29e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
              />
            </View>

            <TouchableOpacity style={styles.forgotButton}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom pinned section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.signInButton, loading && styles.buttonDisabled]}
            onPress={onSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.signUpLink}>Sign up free</Text>
            </TouchableOpacity>
          </View>

          {/* Dev Test Account */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.testAccountButton}
              onPress={useTestAccount}
              activeOpacity={0.7}
            >
              <Ionicons name="flask-outline" size={14} color="#a8a29e" />
              <Text style={styles.testAccountText}>Use test account</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Back
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 13,
    color: '#a8a29e',
  },

  // Logo
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1c1917',
    marginRight: 6,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1c1917',
    letterSpacing: -0.5,
  },

  // Heading
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: '#a8a29e',
    marginBottom: 24,
  },

  // Error
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
  },

  // Apple button
  appleButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e7e5e4',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#d6d3d1',
  },

  // Form
  form: {
    gap: 14,
  },
  inputContainer: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#44403c',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1c1917',
    backgroundColor: '#ffffff',
  },
  forgotButton: {
    alignSelf: 'flex-start',
  },
  forgotLink: {
    fontSize: 12,
    color: '#a8a29e',
    textDecorationLine: 'underline',
  },

  // Bottom
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  signInButton: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Sign up
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 13,
    color: '#d6d3d1',
  },
  signUpLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c1917',
    textDecorationLine: 'underline',
  },

  // Dev test
  testAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  testAccountText: {
    fontSize: 12,
    color: '#a8a29e',
    fontWeight: '500',
  },
});

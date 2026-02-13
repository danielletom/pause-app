import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { apiRequest } from '@/lib/api';

export default function Index() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [checking, setChecking] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      checkOnboarding();
    } else if (isLoaded) {
      setChecking(false);
    }
  }, [isLoaded, isSignedIn]);

  const checkOnboarding = async () => {
    try {
      const token = await getToken();
      const profile = await apiRequest('/api/profile', token);
      setOnboardingComplete(profile?.onboardingComplete === true);
    } catch (err) {
      // Profile doesn't exist yet = new user, needs onboarding
      setOnboardingComplete(false);
    } finally {
      setChecking(false);
    }
  };

  if (!isLoaded || checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#1c1917" />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/(auth)/welcome" />;
  if (!onboardingComplete) return <Redirect href="/(onboarding)/about-you" />;
  return <Redirect href="/(app)" />;
}

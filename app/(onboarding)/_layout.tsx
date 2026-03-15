import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { OnboardingProvider } from '@/lib/onboarding-context';

export default function OnboardingLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Back',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#fafaf9' },
          headerTintColor: '#78716c',
          animation: 'slide_from_right',
        }}
      >
        {/* First screen has no back button */}
        <Stack.Screen name="about-you" options={{ headerShown: false }} />
      </Stack>
    </OnboardingProvider>
  );
}

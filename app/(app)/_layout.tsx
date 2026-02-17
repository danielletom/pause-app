import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import MiniPlayer from '@/components/MiniPlayer';

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tabs group — the main 5 tab screens */}
        <Stack.Screen name="(tabs)" />

        {/* All sub-screens — pushed onto the stack so router.back() works */}
        <Stack.Screen name="profile" />
        <Stack.Screen name="quick-log" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="meds" />
        <Stack.Screen name="learn" />
        <Stack.Screen name="article" />
        <Stack.Screen name="sos" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="symptom-detail" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="about-me" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="help-feedback" />
        <Stack.Screen name="export-data" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="journal-am" />
        <Stack.Screen name="journal-pm" />
        <Stack.Screen name="journal-done" />
        <Stack.Screen name="journal-week" />
        {/* Period tracker screens */}
        <Stack.Screen name="period-tracker" />
        <Stack.Screen name="period-log" />
        <Stack.Screen name="period-bleeding" />
        <Stack.Screen name="period-daily" />
        <Stack.Screen name="period-history" />
        <Stack.Screen name="period-insights" />
        <Stack.Screen name="period-settings" />
        {/* Gratitude journal screens */}
        <Stack.Screen name="gratitude-journal" />
        <Stack.Screen name="gratitude-garden" />
        <Stack.Screen name="gratitude-themes" />
        <Stack.Screen name="gratitude-reflect" />
        {/* Audio player (full screen) */}
        <Stack.Screen name="player" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <MiniPlayer />
    </View>
  );
}

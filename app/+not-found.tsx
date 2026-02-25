import { Stack } from 'expo-router';
import ErrorScreen from '@/components/ErrorScreen';

/**
 * Catch-all for unmatched routes — shows our branded 404 screen.
 */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ErrorScreen type="not_found" />
    </>
  );
}

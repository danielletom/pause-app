import { useState, useCallback } from 'react';
import { useSSO } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// Required: completes the OAuth session when the browser redirects back
WebBrowser.maybeCompleteAuthSession();

export function useAppleAuth() {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithApple = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_apple',
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Root index handles onboarding check → routes to onboarding or home
        router.replace('/');
      }
    } catch (err: any) {
      // Don't show error if user cancelled the flow
      if (err?.message?.includes('cancel') || err?.message?.includes('dismiss')) {
        // User cancelled — silently reset
      } else {
        const message =
          err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err?.message ||
          'Something went wrong. Please try again.';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow, router]);

  return { signInWithApple, loading, error };
}

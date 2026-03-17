import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { apiRequest } from '@/lib/api';

export type Tier = 'free' | 'premium' | 'premium_plus';

export interface Subscription {
  tier: Tier;
  status: string | null;
  expiresAt: string | null;
  features: string[];
}

export function useSubscription() {
  const { getToken } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const fetchSubscription = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true);
      const token = await getToken();
      const data = await apiRequest('/api/subscription', token);
      setSubscription(data);
      hasLoadedOnce.current = true;
    } catch {
      // Default to free if subscription check fails
      setSubscription({ tier: 'free', status: null, expiresAt: null, features: [] });
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isPaid = subscription?.tier === 'premium' || subscription?.tier === 'premium_plus';
  const hasFeature = (feature: string) => subscription?.features.includes(feature) ?? false;

  return { subscription, isPaid, hasFeature, loading, refetch: fetchSubscription };
}

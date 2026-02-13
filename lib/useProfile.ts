import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { apiRequest } from '@/lib/api';

export interface Profile {
  name: string | null;
  email: string | null;
  dateOfBirth: string | null;
  stage: string | null;
  symptoms: string[];
  goals: string[];
  onboardingComplete: boolean;
  createdAt: string;
}

export function useProfile() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const fetchProfile = useCallback(async () => {
    try {
      // Only show loading spinner on first fetch
      if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      setError(null);
      const token = await getToken();
      const data = await apiRequest('/api/profile', token);
      setProfile(data);
      hasLoadedOnce.current = true;
    } catch (err: any) {
      // 404 means profile doesn't exist yet — not a real error
      if (err.message?.includes('404')) {
        setProfile(null);
      } else {
        setError(err.message || 'Failed to load profile');
      }
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}

/** Format a stage ID into a human-readable label */
export function formatStage(stage: string | null | undefined): string {
  if (!stage) return 'Not set';
  const map: Record<string, string> = {
    peri: 'Perimenopause',
    meno: 'Menopause',
    post: 'Post-menopause',
    unsure: 'Exploring',
  };
  return map[stage] || stage;
}

/** Format a createdAt timestamp into "Tracking since Mon YYYY" */
export function formatTrackingSince(createdAt: string | undefined): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `Tracking since ${months[date.getMonth()]} ${date.getFullYear()}`;
}

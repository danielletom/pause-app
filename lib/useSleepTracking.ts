import { useState, useEffect, useCallback } from 'react';
import {
  isHealthDataAvailable,
  queryQuantitySamples,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

/**
 * Rise-style sleep tracking: infer sleep from gaps in step data.
 *
 * iOS continuously collects step count via the motion coprocessor.
 * When the phone is stationary overnight, there are no step samples.
 * We find the largest gap in step data between evening and morning —
 * that gap IS the sleep window.
 *
 * No background process needed. Just query HealthKit retrospectively.
 */

export interface SleepData {
  sleepStart: Date;
  sleepEnd: Date;
  hours: number; // rounded to nearest 0.5
}

export interface UseSleepTrackingReturn {
  sleep: SleepData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const MIN_SLEEP_HOURS = 3; // ignore gaps shorter than 3h
const STEP_TYPE = 'HKQuantityTypeIdentifierStepCount' as const;

/**
 * Find the longest gap in step samples overnight → that's the sleep window.
 */
async function inferSleepFromSteps(forDate: Date): Promise<SleepData | null> {
  // Query from 6 PM the evening before to noon the target day
  const eveningBefore = new Date(forDate);
  eveningBefore.setDate(eveningBefore.getDate() - 1);
  eveningBefore.setHours(18, 0, 0, 0);

  const noonToday = new Date(forDate);
  noonToday.setHours(12, 0, 0, 0);

  const samples = await queryQuantitySamples(STEP_TYPE, {
    limit: -1, // fetch all
    ascending: true,
    filter: {
      date: {
        startDate: eveningBefore,
        endDate: noonToday,
        strictStartDate: true,
        strictEndDate: true,
      },
    },
    unit: 'count',
  });

  if (samples.length < 2) return null;

  // Sort by end time (should already be ascending but be safe)
  const sorted = [...samples].sort(
    (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  );

  // Find the largest gap between consecutive samples
  let maxGapMs = 0;
  let sleepStart: Date | null = null;
  let sleepEnd: Date | null = null;

  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStartMs = new Date(sorted[i].endDate).getTime();
    const gapEndMs = new Date(sorted[i + 1].startDate).getTime();
    const gap = gapEndMs - gapStartMs;

    if (gap > maxGapMs) {
      maxGapMs = gap;
      sleepStart = new Date(gapStartMs);
      sleepEnd = new Date(gapEndMs);
    }
  }

  if (!sleepStart || !sleepEnd) return null;

  const hours = maxGapMs / (1000 * 60 * 60);
  if (hours < MIN_SLEEP_HOURS) return null;

  // Round to nearest 0.5 hour
  const rounded = Math.round(hours * 2) / 2;

  return { sleepStart, sleepEnd, hours: rounded };
}

/**
 * Hook: retrospectively infer last night's sleep from HealthKit step data.
 * Call this in the morning — it queries the previous night's data.
 */
export function useSleepTracking(date?: Date): UseSleepTrackingReturn {
  const [sleep, setSleep] = useState<SleepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetDate = date ?? new Date();

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setError('Sleep tracking requires iOS');
      setLoading(false);
      return;
    }

    if (!isHealthDataAvailable()) {
      setError('HealthKit not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await inferSleepFromSteps(targetDate);
      setSleep(result);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to read sleep data');
    } finally {
      setLoading(false);
    }
  }, [targetDate.toDateString()]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sleep, loading, error, refresh };
}

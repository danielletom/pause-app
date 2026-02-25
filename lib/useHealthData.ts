import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Real HealthKit integration for wearable / Apple Health data.
 *
 * Reads step count, heart rate, HRV, and resting heart rate from HealthKit.
 * Sleep hours are inferred via useSleepTracking (Rise-style approach).
 *
 * Falls back gracefully on Android or when HealthKit isn't available.
 */

// Lazy-import HealthKit so it doesn't crash on Android/web
let HK: typeof import('@kingstinct/react-native-healthkit') | null = null;
if (Platform.OS === 'ios') {
  try {
    HK = require('@kingstinct/react-native-healthkit');
  } catch {
    HK = null;
  }
}

const STORAGE_KEY = '@pause_health_connected';

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
] as const;

export interface HealthData {
  hrv: number | null;        // Heart rate variability (ms)
  rhr: number | null;        // Resting heart rate (bpm)
  steps: number | null;
  sleepHours: number | null;
}

export interface UseHealthDataReturn {
  connected: boolean;
  source: string | null;          // 'apple_health' | null
  lastSynced: Date | null;
  data: HealthData;
  connecting: boolean;
  connect: (source: string) => Promise<void>;
  disconnect: () => void;
  available: boolean;             // whether HealthKit is available on this device
}

const EMPTY_DATA: HealthData = {
  hrv: null,
  rhr: null,
  steps: null,
  sleepHours: null,
};

async function queryTodaySteps(): Promise<number | null> {
  if (!HK) return null;
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const samples = await HK.queryQuantitySamples(
      'HKQuantityTypeIdentifierStepCount' as any,
      {
        limit: -1,
        ascending: false,
        filter: {
          date: { startDate: startOfDay, endDate: now },
        },
        unit: 'count',
      }
    );
    if (samples.length === 0) return null;
    return samples.reduce((sum, s) => sum + s.quantity, 0);
  } catch {
    return null;
  }
}

async function queryLatestSample(
  type: string,
  unit: string
): Promise<number | null> {
  if (!HK) return null;
  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const samples = await HK.queryQuantitySamples(type as any, {
      limit: 1,
      ascending: false,
      filter: {
        date: { startDate: weekAgo, endDate: now },
      },
      unit,
    });
    return samples.length > 0 ? Math.round(samples[0].quantity) : null;
  } catch {
    return null;
  }
}

export function useHealthData(): UseHealthDataReturn {
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [data, setData] = useState<HealthData>(EMPTY_DATA);
  const [connecting, setConnecting] = useState(false);
  const available = Platform.OS === 'ios' && HK != null && HK.isHealthDataAvailable();

  // Restore connection state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'true' && available) {
        setConnected(true);
        setSource('apple_health');
      }
    });
  }, [available]);

  // Sync health data when connected
  useEffect(() => {
    if (!connected || !HK) return;

    let cancelled = false;
    (async () => {
      try {
        const [steps, hrv, rhr] = await Promise.all([
          queryTodaySteps(),
          queryLatestSample('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
          queryLatestSample('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
        ]);

        if (cancelled) return;
        setData({ steps, hrv, rhr, sleepHours: null }); // sleep comes from useSleepTracking
        setLastSynced(new Date());
      } catch {
        // Non-critical — keep stale data
      }
    })();

    return () => { cancelled = true; };
  }, [connected]);

  const connect = useCallback(async (_source: string) => {
    if (!HK || !available) return;

    setConnecting(true);
    try {
      // Request HealthKit authorization
      const authorized = await HK.requestAuthorization({
        toRead: [...READ_TYPES] as any[],
      });

      if (!authorized) {
        setConnecting(false);
        return;
      }

      setConnected(true);
      setSource('apple_health');
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Permission denied or unavailable
    } finally {
      setConnecting(false);
    }
  }, [available]);

  const disconnect = useCallback(() => {
    setConnected(false);
    setSource(null);
    setLastSynced(null);
    setData(EMPTY_DATA);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { connected, source, lastSynced, data, connecting, connect, disconnect, available };
}

import { useState, useCallback } from 'react';

/**
 * Mock hook for wearable / Apple Health data.
 *
 * Returns connection state and biometric readings.
 * Currently uses local useState with mock values — swap this
 * single file for real HealthKit integration later.
 */

export interface HealthData {
  hrv: number | null;       // Heart rate variability (ms)
  rhr: number | null;       // Resting heart rate (bpm)
  steps: number | null;
  sleepHours: number | null;
}

export interface UseHealthDataReturn {
  connected: boolean;
  source: string | null;          // 'apple_watch' | 'oura' | null
  lastSynced: Date | null;
  data: HealthData;
  connecting: boolean;
  connect: (source: string) => Promise<void>;
  disconnect: () => void;
}

const MOCK_DATA: HealthData = {
  hrv: 38,
  rhr: 62,
  steps: 4_820,
  sleepHours: 7.2,
};

const EMPTY_DATA: HealthData = {
  hrv: null,
  rhr: null,
  steps: null,
  sleepHours: null,
};

export function useHealthData(): UseHealthDataReturn {
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [data, setData] = useState<HealthData>(EMPTY_DATA);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async (src: string) => {
    setConnecting(true);
    // Simulate a 2-second sync delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setConnected(true);
    setSource(src);
    setLastSynced(new Date());
    setData(MOCK_DATA);
    setConnecting(false);
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setSource(null);
    setLastSynced(null);
    setData(EMPTY_DATA);
  }, []);

  return { connected, source, lastSynced, data, connecting, connect, disconnect };
}

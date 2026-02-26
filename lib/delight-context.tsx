import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pause_delight_state';

interface DelightState {
  /** Which moments the user has already seen (persisted) */
  seen: Record<string, boolean>;
  /** Mark a delight moment as seen */
  markSeen: (key: string) => void;
  /** Check if a moment has been seen */
  hasSeen: (key: string) => boolean;
}

const DelightContext = createContext<DelightState>({
  seen: {},
  markSeen: () => {},
  hasSeen: () => false,
});

export function DelightProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  // Load persisted state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setSeen(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const markSeen = useCallback((key: string) => {
    setSeen((prev) => {
      const next = { ...prev, [key]: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const hasSeen = useCallback(
    (key: string) => !!seen[key],
    [seen],
  );

  return (
    <DelightContext.Provider value={{ seen, markSeen, hasSeen }}>
      {children}
    </DelightContext.Provider>
  );
}

export function useDelight() {
  return useContext(DelightContext);
}

/** Delight moment keys — used throughout the app */
export const DELIGHT_KEYS = {
  WELCOME_BANNER: 'welcome_banner',
  QUIZ_DATA_CARD: 'quiz_data_card',
  FIRST_CHECKIN: 'first_checkin_celebration',
  DAY3_MILESTONE: 'day3_milestone',
  DAY3_EVENING_UNLOCK: 'day3_evening_unlock',
  FIRST_PATTERN: 'first_pattern',
  WEEK_CELEBRATION: 'week_celebration',
  CORRELATION_CARD: 'correlation_card',
  DAY10_BANNER: 'day10_banner',
  DAY14_NORMAL_UNLOCK: 'day14_normal_unlock',
  DAY17_BODY_MAP: 'day17_body_map',
} as const;

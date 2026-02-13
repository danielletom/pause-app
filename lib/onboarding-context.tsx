import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface OnboardingData {
  name: string;
  dateOfBirth: string;
  stage: string | null;
  symptoms: string[];
  goals: string[];
  quizAnswers: (string | null)[];
  notifPrefs: {
    log: boolean;
    hrt: boolean;
    insights: boolean;
    sms: boolean;
    wellness: boolean;
    time: string;
    phone: string;
  };
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const defaultData: OnboardingData = {
  name: '',
  dateOfBirth: '',
  stage: null,
  symptoms: [],
  goals: [],
  quizAnswers: [null, null, null],
  notifPrefs: {
    log: true,
    hrt: true,
    insights: true,
    sms: false,
    wellness: true,
    time: 'evening',
    phone: '',
  },
};

const OnboardingContext = createContext<OnboardingContextType>({
  data: defaultData,
  updateData: () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultData);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}

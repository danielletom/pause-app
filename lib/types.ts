/** Shared types used across multiple screens */

export interface LogEntry {
  id: number;
  date: string;
  loggedAt: string | null;
  symptomsJson: Record<string, number> | null;
  mood: number | null;
  energy: number | null;
  sleepHours: number | null;
  sleepQuality: string | null;
  disruptions: number | null;
  contextTags: string[] | null;
  logType: string | null;
  notes: string | null;
}

export interface CorrelationItem {
  factor: string;
  symptom: string;
  direction: 'positive' | 'negative';
  confidence: number;
  effectSizePct: number;
  occurrences: number;
  lagDays: number;
  humanLabel: string;
  explanation?: string;
  recommendation?: string;
  mechanism?: string;
  caveat?: string;
}

export interface SymptomGuidance {
  explanation: string;
  recommendations: string[];
  relatedFactors: string[];
}

/**
 * Trial & delight moment utilities
 *
 * The Pause app uses a 20-day reverse trial:
 * - Days 0-20: everything free
 * - Day 20+: soft paywall, SOS always free, past data accessible
 */

/** Calculate the trial day (0-indexed) from account creation date */
export function getTrialDay(createdAt: string | null | undefined): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/** Check if the 20-day trial has expired. Paid users are never expired. */
export function isTrialExpired(createdAt: string | null | undefined, isPaid?: boolean): boolean {
  if (isPaid) return false;
  return getTrialDay(createdAt) >= 20;
}

/** Get remaining trial days (0 = expired) */
export function getTrialDaysLeft(createdAt: string | null | undefined): number {
  return Math.max(0, 20 - getTrialDay(createdAt));
}

/** Count total check-ins from a logs array */
export function getCheckInCount(logs: any[]): number {
  if (!Array.isArray(logs)) return 0;
  return logs.filter((l) => l.logType === 'morning' || l.logType === 'evening').length;
}

/** Count unique days with at least one morning check-in */
export function getCheckInDays(logs: any[]): number {
  if (!Array.isArray(logs)) return 0;
  const days = new Set<string>();
  logs.forEach((l) => {
    if (l.logType === 'morning' && l.date) days.add(l.date);
  });
  return days.size;
}

/** Calculate consecutive-day streak from logs (backwards from today) */
export function getStreak(logs: any[]): number {
  if (!Array.isArray(logs) || logs.length === 0) return 0;
  const morningDates = new Set<string>();
  logs.forEach((l) => {
    if (l.logType === 'morning' && l.date) morningDates.add(l.date);
  });
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 90; i++) {
    const dateStr = d.toISOString().split('T')[0];
    if (morningDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break; // allow today to be missing (haven't logged yet)
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Get the streak message for a given streak count */
export function getStreakMessage(streak: number): string {
  if (streak <= 1) return '';
  if (streak === 2) return '2 in a row. That\u2019s how patterns start.';
  if (streak === 3) return '3 days \u2014 you\u2019re building a picture.';
  if (streak === 4) return '4 days. We can start to see the shape of your week.';
  if (streak === 5) return '5 days \u2014 halfway to your first insights.';
  if (streak === 6) return '6 days. Tomorrow we unlock your patterns.';
  if (streak === 7) return 'One full week! Your first insights are ready.';
  if (streak === 10) return '10 days of showing up for yourself.';
  if (streak === 14) return '2 weeks of data. Your insights are powerful now.';
  if (streak === 21) return '3 weeks. You know your body better than most.';
  if (streak < 20) return `${streak} day streak. Your picture gets clearer every day.`;
  return `${streak} day streak \u2014 incredible commitment.`;
}

/** Calculate days until insights unlock (day 7) */
export function getDaysUntilInsights(checkInDays: number): number {
  return Math.max(0, 7 - checkInDays);
}

/** Determine which delight phase the user is in */
export function getDelightPhase(trialDay: number): 'hook' | 'building' | 'investment' | 'conversion' | 'expired' {
  if (trialDay <= 3) return 'hook';
  if (trialDay <= 9) return 'building';
  if (trialDay <= 16) return 'investment';
  if (trialDay <= 20) return 'conversion';
  return 'expired';
}

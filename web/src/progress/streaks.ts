import { addDays, dayKey, parseDayKey } from './dates';

export interface StreakStats {
  /** Consecutive workout days ending today, or yesterday if today isn't done yet (still alive). */
  current: number;
  /** Whether today is already part of the current streak. */
  doneToday: boolean;
  longest: number;
}

/** Streaks over a set of "YYYY-MM-DD" days on which at least one workout was completed. */
export function streakStats(days: Iterable<string>, today: Date): StreakStats {
  const set = new Set(days);
  let longest = 0;
  for (const key of set) {
    const d = parseDayKey(key);
    if (!d || set.has(dayKey(addDays(d, -1)))) continue; // only count from the start of each run
    let length = 1;
    while (set.has(dayKey(addDays(d, length)))) length++;
    longest = Math.max(longest, length);
  }

  const doneToday = set.has(dayKey(today));
  let cursor = doneToday ? today : addDays(today, -1);
  let current = 0;
  while (set.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, doneToday, longest };
}

/** Where `day` falls in its streak: 1 for the first (or a lone) workout day, 2 for the next, … 0 if no workout. */
export function streakPosition(days: ReadonlySet<string>, day: Date): number {
  let position = 0;
  for (let d = day; days.has(dayKey(d)); d = addDays(d, -1)) position++;
  return position;
}

/** Full length of the streak containing `day` (0 if no workout that day). */
export function streakLength(days: ReadonlySet<string>, day: Date): number {
  const before = streakPosition(days, day);
  if (before === 0) return 0;
  let after = 0;
  for (let d = addDays(day, 1); days.has(dayKey(d)); d = addDays(d, 1)) after++;
  return before + after;
}

export type HeatLevel = 0 | 1 | 2 | 3;
/** Colour intensity for a day: none, day 1, day 2, day 3+ of a streak. */
export const heatLevel = (position: number): HeatLevel => (Math.min(position, 3) as HeatLevel);

import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayKey,
  formatDuration,
  groupByDay,
  localeWeekStart,
  monthKey,
  monthWeeks,
  parseDayKey,
  parseMonthKey,
  shiftMonthClamped,
  startOfWeek,
} from './dates';

describe('keys', () => {
  it('formats and parses day keys in local time', () => {
    const d = new Date(2026, 10, 5, 23, 59);
    expect(dayKey(d)).toBe('2026-11-05');
    expect(parseDayKey('2026-11-05')).toEqual(new Date(2026, 10, 5));
    expect(monthKey({ year: 2026, month: 0 })).toBe('2026-01');
    expect(parseMonthKey('2026-11')).toEqual({ year: 2026, month: 10 });
  });

  it.each(['', '2026-13-01', '2026-02-30', '2026-1-1', 'nope', null])('rejects bad day key %j', (s) => {
    expect(parseDayKey(s)).toBeNull();
  });

  it.each(['2026-00', '2026-13', '26-01', undefined])('rejects bad month key %j', (s) => {
    expect(parseMonthKey(s)).toBeNull();
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(dayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(dayKey(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
  });

  it('adds months across years', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('clamps day-of-month when shifting months', () => {
    expect(dayKey(shiftMonthClamped(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(dayKey(shiftMonthClamped(new Date(2028, 0, 31), 1))).toBe('2028-02-29');
    expect(dayKey(shiftMonthClamped(new Date(2026, 2, 15), -1))).toBe('2026-02-15');
  });

  it('finds the start of the week', () => {
    // 5 Nov 2026 is a Thursday
    expect(dayKey(startOfWeek(new Date(2026, 10, 5), 1))).toBe('2026-11-02'); // Monday
    expect(dayKey(startOfWeek(new Date(2026, 10, 5), 0))).toBe('2026-11-01'); // Sunday
    expect(dayKey(startOfWeek(new Date(2026, 10, 2), 1))).toBe('2026-11-02');
  });
});

describe('monthWeeks', () => {
  it('covers the month in whole weeks starting on Monday', () => {
    const weeks = monthWeeks({ year: 2026, month: 10 }, 1); // Nov 2026: 1st is a Sunday
    expect(weeks).toHaveLength(6);
    expect(dayKey(weeks[0]![0]!)).toBe('2026-10-26');
    expect(dayKey(weeks[0]![6]!)).toBe('2026-11-01');
    expect(dayKey(weeks.at(-1)!.at(-1)!)).toBe('2026-12-06');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('uses fewer weeks when the month fits', () => {
    const weeks = monthWeeks({ year: 2026, month: 1 }, 0); // Feb 2026 starts on a Sunday, 28 days
    expect(weeks).toHaveLength(4);
    expect(dayKey(weeks[0]![0]!)).toBe('2026-02-01');
    expect(dayKey(weeks[3]![6]!)).toBe('2026-02-28');
  });

  it('has unique consecutive days (no DST duplicates)', () => {
    for (let m = 0; m < 12; m++) {
      const days = monthWeeks({ year: 2026, month: m }, 1).flat().map(dayKey);
      expect(new Set(days).size).toBe(days.length);
    }
  });
});

describe('groupByDay', () => {
  it('groups by local day, keeping order', () => {
    const items = [
      { id: 1, t: new Date(2026, 10, 5, 7).getTime() },
      { id: 2, t: new Date(2026, 10, 6, 0, 1).getTime() },
      { id: 3, t: new Date(2026, 10, 5, 23, 59).getTime() },
    ];
    const g = groupByDay(items, (i) => i.t);
    expect(g.get('2026-11-05')?.map((i) => i.id)).toEqual([1, 3]);
    expect(g.get('2026-11-06')?.map((i) => i.id)).toEqual([2]);
  });
});

describe('formatDuration', () => {
  it.each([
    [45_000, '45 s'],
    [240_000, '4 min'],
    [3_900_000, '1 h 5 min'],
    [7_200_000, '2 h'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('localeWeekStart', () => {
  it('reads the locale, falling back to Monday', () => {
    expect(localeWeekStart('en-US')).toBe(0);
    expect(localeWeekStart('en-GB')).toBe(1);
    expect(localeWeekStart('not a locale!')).toBe(1);
  });
});

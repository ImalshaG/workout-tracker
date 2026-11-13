import { describe, expect, it } from 'vitest';
import { heatLevel, streakLength, streakPosition, streakStats } from './streaks';

const today = new Date(2026, 10, 6); // Fri 6 Nov 2026

describe('streakStats', () => {
  it('is all zero with no workouts', () => {
    expect(streakStats([], today)).toEqual({ current: 0, doneToday: false, longest: 0 });
  });

  it('counts a streak ending today', () => {
    expect(streakStats(['2026-11-04', '2026-11-05', '2026-11-06'], today)).toEqual({ current: 3, doneToday: true, longest: 3 });
  });

  it('keeps a streak alive through yesterday when today is not done yet', () => {
    expect(streakStats(['2026-11-04', '2026-11-05'], today)).toEqual({ current: 2, doneToday: false, longest: 2 });
  });

  it('breaks after a missed day', () => {
    expect(streakStats(['2026-11-03', '2026-11-04'], today)).toEqual({ current: 0, doneToday: false, longest: 2 });
  });

  it('finds the longest streak, across month and year boundaries', () => {
    const days = ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-10-31', '2026-11-01', '2026-11-06'];
    expect(streakStats(days, today)).toEqual({ current: 1, doneToday: true, longest: 4 });
  });

  it('ignores duplicates and bad keys', () => {
    expect(streakStats(['2026-11-06', '2026-11-06', 'nope'], today)).toEqual({ current: 1, doneToday: true, longest: 1 });
  });
});

describe('streakPosition / streakLength / heatLevel', () => {
  const days = new Set(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05']);
  const at = (m: number, d: number) => new Date(2026, m, d);

  it('counts position within the streak, across month ends', () => {
    expect(streakPosition(days, at(9, 31))).toBe(1);
    expect(streakPosition(days, at(10, 1))).toBe(2);
    expect(streakPosition(days, at(10, 3))).toBe(4);
    expect(streakPosition(days, at(10, 5))).toBe(1); // lone day
    expect(streakPosition(days, at(10, 4))).toBe(0); // no workout
  });

  it('gives the full streak length from any day in it', () => {
    expect(streakLength(days, at(9, 31))).toBe(4);
    expect(streakLength(days, at(10, 2))).toBe(4);
    expect(streakLength(days, at(10, 5))).toBe(1);
    expect(streakLength(days, at(10, 4))).toBe(0);
  });

  it('caps heat at 3', () => {
    expect([0, 1, 2, 3, 7].map(heatLevel)).toEqual([0, 1, 2, 3, 3]);
  });
});

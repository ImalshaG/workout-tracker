import { describe, expect, it } from 'vitest';
import { formatLastDone, lastRunByWorkout, startableWorkouts } from './lastRun';

describe('lastRunByWorkout', () => {
  it('keeps the latest completion per workout and skips deleted workouts', () => {
    const map = lastRunByWorkout([
      { workoutId: 1, completedAt: 100 },
      { workoutId: 2, completedAt: 50 },
      { workoutId: 1, completedAt: 300 },
      { workoutId: null, completedAt: 999 },
      { workoutId: 1, completedAt: 200 },
    ]);
    expect([...map]).toEqual([[1, 300], [2, 50]]);
  });
});

describe('formatLastDone', () => {
  const now = new Date(2026, 10, 13, 9, 0); // Fri 13 Nov 2026
  it('says Never without a run', () => expect(formatLastDone(undefined, now, 'en-GB')).toBe('Never'));
  it('says Today and Yesterday by calendar day', () => {
    expect(formatLastDone(new Date(2026, 10, 13, 0, 5).getTime(), now, 'en-GB')).toBe('Today');
    expect(formatLastDone(new Date(2026, 10, 12, 23, 59).getTime(), now, 'en-GB')).toBe('Yesterday');
  });
  it('uses a short date, with the year only when it differs', () => {
    expect(formatLastDone(new Date(2026, 10, 5).getTime(), now, 'en-GB')).toBe('5 Nov');
    expect(formatLastDone(new Date(2025, 10, 5).getTime(), now, 'en-GB')).toBe('5 Nov 2025');
  });
});

describe('startableWorkouts', () => {
  const w = (id: number, name: string, exerciseCount = 1) => ({ id, name, exerciseCount });
  it('drops empty workouts and orders by most recent run, then name', () => {
    const list = [w(1, 'Zed'), w(2, 'Arms'), w(3, 'Empty', 0), w(4, 'Core'), w(5, 'Back')];
    const last = new Map([[4, 500], [1, 900]]);
    expect(startableWorkouts(list, last).map((x) => x.id)).toEqual([1, 4, 2, 5]);
  });
  it('sorts by name when run history is unavailable', () => {
    expect(startableWorkouts([w(1, 'b'), w(2, 'A')], null).map((x) => x.id)).toEqual([2, 1]);
  });
});

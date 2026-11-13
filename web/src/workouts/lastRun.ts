import { addDays, sameDay } from '../progress/dates';

/** Latest `completedAt` per workout (runs of deleted workouts are skipped). */
export function lastRunByWorkout(runs: readonly { workoutId: number | null; completedAt: number }[]): Map<number, number> {
  const last = new Map<number, number>();
  for (const r of runs) {
    if (r.workoutId === null) continue;
    if (r.completedAt > (last.get(r.workoutId) ?? -Infinity)) last.set(r.workoutId, r.completedAt);
  }
  return last;
}

/** "Never", "Today", "Yesterday", "5 Nov", or "5 Nov 2025" for another year. */
export function formatLastDone(ms: number | undefined, now: Date, locale?: string): string {
  if (ms === undefined) return 'Never';
  const d = new Date(ms);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, addDays(now, -1))) return 'Yesterday';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Workouts that can be run, most recently done first, then by name. */
export function startableWorkouts<W extends { id: number; name: string; exerciseCount: number }>(
  workouts: readonly W[],
  last: Map<number, number> | null,
): W[] {
  return workouts
    .filter((w) => w.exerciseCount > 0)
    .sort(
      (a, b) =>
        (last?.get(b.id) ?? -1) - (last?.get(a.id) ?? -1) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

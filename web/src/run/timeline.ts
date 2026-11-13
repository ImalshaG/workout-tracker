/**
 * Pure timing logic for running a workout. Time is tracked as "active elapsed" milliseconds
 * (excluding pauses), derived from timestamps so it stays accurate even if ticks are delayed.
 */


export interface Phase {
  kind: 'work' | 'rest';
  /** For work: the entry being done. For rest: the entry coming up next. */
  entryIndex: number;
  /** Offset from the start of the run, in ms. */
  start: number;
  duration: number;
}

/**
 * A work phase per entry (using that entry's duration), with `restMs` between consecutive entries
 * (none before the first or after the last; no rest phases at all when `restMs` is 0).
 */
export function buildPhases(workMs: readonly number[], restMs: number): Phase[] {
  const phases: Phase[] = [];
  let t = 0;
  workMs.forEach((duration, i) => {
    if (i > 0 && restMs > 0) {
      phases.push({ kind: 'rest', entryIndex: i, start: t, duration: restMs });
      t += restMs;
    }
    phases.push({ kind: 'work', entryIndex: i, start: t, duration });
    t += duration;
  });
  return phases;
}

export function totalDuration(phases: Phase[]): number {
  const last = phases.at(-1);
  return last ? last.start + last.duration : 0;
}

/** A pausable stopwatch. `since` is the timestamp it was last (re)started, or null while paused. */
export interface Clock {
  elapsed: number;
  since: number | null;
}

export const startClock = (now: number): Clock => ({ elapsed: 0, since: now });
export const elapsedAt = (c: Clock, now: number) => c.elapsed + (c.since === null ? 0 : now - c.since);
export const isRunning = (c: Clock) => c.since !== null;
export const pauseClock = (c: Clock, now: number): Clock => (c.since === null ? c : { elapsed: elapsedAt(c, now), since: null });
export const resumeClock = (c: Clock, now: number): Clock => (c.since !== null ? c : { elapsed: c.elapsed, since: now });
/** Jump to an elapsed position, keeping the running/paused state. */
export const seekClock = (c: Clock, now: number, to: number): Clock => ({ elapsed: to, since: c.since === null ? null : now });

export type Position =
  | { done: false; phaseIndex: number; phase: Phase; remaining: number }
  | { done: true };

export function locate(phases: Phase[], elapsed: number): Position {
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!;
    if (elapsed < phase.start + phase.duration) {
      return { done: false, phaseIndex: i, phase, remaining: phase.start + phase.duration - Math.max(elapsed, phase.start) };
    }
  }
  return { done: true };
}

/** Where "skip" goes: the start of the next phase (or the end). */
export function skipTarget(phases: Phase[], phaseIndex: number): number {
  return phases[phaseIndex + 1]?.start ?? totalDuration(phases);
}

/** Within this many ms of a phase starting, "back" goes to the previous phase instead of restarting this one. */
export const BACK_GRACE_MS = 2_000;

/** Where "back" goes: restart the current phase, or the previous one if we're right at the start. */
export function backTarget(phases: Phase[], phaseIndex: number, elapsed: number): number {
  const phase = phases[phaseIndex];
  if (!phase) return 0;
  if (elapsed - phase.start > BACK_GRACE_MS) return phase.start;
  return phases[phaseIndex - 1]?.start ?? 0;
}

/** Whole seconds to display for a remaining duration (0.2s left shows as 1). */
export const displaySeconds = (remainingMs: number) => Math.max(0, Math.ceil(remainingMs / 1000));

export function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

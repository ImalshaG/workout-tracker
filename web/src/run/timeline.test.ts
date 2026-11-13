import { describe, expect, it } from 'vitest';
import {
  backTarget,
  buildPhases,
  displaySeconds,
  elapsedAt,
  formatSeconds,
  locate,
  pauseClock,
  resumeClock,
  seekClock,
  skipTarget,
  startClock,
  totalDuration,
} from './timeline';

const thirties = (n: number) => Array.from({ length: n }, () => 30_000);

describe('buildPhases', () => {
  it('alternates 30s work and 10s rest, with no rest before the first or after the last', () => {
    expect(buildPhases(thirties(3), 10_000)).toEqual([
      { kind: 'work', entryIndex: 0, start: 0, duration: 30_000 },
      { kind: 'rest', entryIndex: 1, start: 30_000, duration: 10_000 },
      { kind: 'work', entryIndex: 1, start: 40_000, duration: 30_000 },
      { kind: 'rest', entryIndex: 2, start: 70_000, duration: 10_000 },
      { kind: 'work', entryIndex: 2, start: 80_000, duration: 30_000 },
    ]);
    expect(totalDuration(buildPhases(thirties(3), 10_000))).toBe(110_000);
  });

  it('uses each entry its own duration and a custom rest', () => {
    expect(buildPhases([60_000, 20_000], 15_000)).toEqual([
      { kind: 'work', entryIndex: 0, start: 0, duration: 60_000 },
      { kind: 'rest', entryIndex: 1, start: 60_000, duration: 15_000 },
      { kind: 'work', entryIndex: 1, start: 75_000, duration: 20_000 },
    ]);
  });

  it('has no rest phases when rest is 0', () => {
    expect(buildPhases([5_000, 6_000], 0)).toEqual([
      { kind: 'work', entryIndex: 0, start: 0, duration: 5_000 },
      { kind: 'work', entryIndex: 1, start: 5_000, duration: 6_000 },
    ]);
  });

  it('handles one and zero entries', () => {
    expect(buildPhases(thirties(1), 10_000)).toEqual([{ kind: 'work', entryIndex: 0, start: 0, duration: 30_000 }]);
    expect(buildPhases([], 10_000)).toEqual([]);
    expect(totalDuration([])).toBe(0);
  });
});

describe('locate', () => {
  const phases = buildPhases(thirties(2), 10_000); // work 0-30s, rest 30-40s, work 40-70s

  it.each([
    [0, 0, 30_000],
    [29_999, 0, 1],
    [30_000, 1, 10_000],
    [39_500, 1, 500],
    [40_000, 2, 30_000],
    [69_000, 2, 1_000],
  ])('at %ims is in phase %i with %ims left', (elapsed, phaseIndex, remaining) => {
    expect(locate(phases, elapsed)).toMatchObject({ done: false, phaseIndex, remaining });
  });

  it('is done at or after the end', () => {
    expect(locate(phases, 70_000)).toEqual({ done: true });
    expect(locate(phases, 999_999)).toEqual({ done: true });
    expect(locate([], 0)).toEqual({ done: true });
  });
});

describe('clock', () => {
  it('measures running time and freezes while paused', () => {
    let c = startClock(1_000);
    expect(elapsedAt(c, 6_000)).toBe(5_000);
    c = pauseClock(c, 6_000);
    expect(elapsedAt(c, 60_000)).toBe(5_000);
    c = resumeClock(c, 60_000);
    expect(elapsedAt(c, 62_000)).toBe(7_000);
  });

  it('pause and resume are idempotent', () => {
    const c = startClock(0);
    expect(resumeClock(c, 500)).toBe(c);
    const p = pauseClock(c, 1_000);
    expect(pauseClock(p, 5_000)).toBe(p);
  });

  it('seek keeps running/paused state', () => {
    const running = seekClock(startClock(0), 10_000, 40_000);
    expect(elapsedAt(running, 11_000)).toBe(41_000);
    const paused = seekClock(pauseClock(startClock(0), 5_000), 10_000, 40_000);
    expect(elapsedAt(paused, 99_000)).toBe(40_000);
  });
});

describe('skip and back', () => {
  const phases = buildPhases(thirties(3), 10_000);

  it('skip goes to the next phase start, or the end from the last phase', () => {
    expect(skipTarget(phases, 0)).toBe(30_000); // work -> rest
    expect(skipTarget(phases, 1)).toBe(40_000); // rest -> next work
    expect(skipTarget(phases, 4)).toBe(110_000); // last -> done
  });

  it('back restarts the current phase once it is underway', () => {
    expect(backTarget(phases, 2, 45_000)).toBe(40_000);
  });

  it('back goes to the previous phase near the start of the current one', () => {
    expect(backTarget(phases, 2, 41_000)).toBe(30_000);
    expect(backTarget(phases, 1, 30_500)).toBe(0);
    expect(backTarget(phases, 0, 500)).toBe(0);
  });
});

describe('display', () => {
  it('rounds remaining time up to whole seconds', () => {
    expect(displaySeconds(30_000)).toBe(30);
    expect(displaySeconds(29_001)).toBe(30);
    expect(displaySeconds(200)).toBe(1);
    expect(displaySeconds(0)).toBe(0);
    expect(displaySeconds(-5)).toBe(0);
  });

  it('formats m:ss', () => {
    expect(formatSeconds(30)).toBe('0:30');
    expect(formatSeconds(5)).toBe('0:05');
    expect(formatSeconds(110)).toBe('1:50');
  });
});

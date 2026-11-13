import { beforeEach, describe, expect, it } from 'vitest';
import { expectError, setup, type Json } from './test/helpers.js';

interface Entry {
  id: number;
  exerciseId: number;
  name: string;
  durationSeconds: number;
  overrideSeconds: number | null;
}
interface Workout {
  id: number;
  name: string;
  restSeconds: number;
  exercises: Entry[];
}

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});

const createExercise = (body: Json) => t.sendOk<Json & { id: number; durationSeconds: number }>('POST', '/api/exercises', body, 201);
const createWorkout = (body: Json) => t.sendOk<Workout>('POST', '/api/workouts', body, 201);
const getWorkout = (id: number) => t.sendOk<Workout>('GET', `/api/workouts/${id}`, undefined, 200);
const durations = (w: Workout) => w.exercises.map((e) => [e.durationSeconds, e.overrideSeconds]);
const defaults = (w: Workout) => w.exercises.map((e) => (e as Entry & { defaultSeconds: number }).defaultSeconds);

describe('exercise default duration', () => {
  it('defaults to 30s and accepts a custom value', async () => {
    expect((await createExercise({ name: 'Squat' })).durationSeconds).toBe(30);
    expect((await createExercise({ name: 'Plank', durationSeconds: 60 })).durationSeconds).toBe(60);
  });

  it('PUT replaces it; omitted resets to 30s', async () => {
    const ex = await createExercise({ name: 'Plank', durationSeconds: 60 });
    expect((await t.sendOk<Json>('PUT', `/api/exercises/${ex.id}`, { name: 'Plank', durationSeconds: 90 }, 200)).durationSeconds).toBe(90);
    expect((await t.sendOk<Json>('PUT', `/api/exercises/${ex.id}`, { name: 'Plank' }, 200)).durationSeconds).toBe(30);
  });

  it.each([0, 3601, 1.5, '30'])('400 for duration %j', async (durationSeconds) => {
    await expectError(await t.send('POST', '/api/exercises', { name: 'X', durationSeconds }), 400, 'VALIDATION_ERROR', 'durationSeconds');
  });

  it('accepts the bounds 1s and 3600s', async () => {
    expect((await createExercise({ name: 'A', durationSeconds: 1 })).durationSeconds).toBe(1);
    expect((await createExercise({ name: 'B', durationSeconds: 3600 })).durationSeconds).toBe(3600);
  });
});

describe('workout rest', () => {
  it('defaults to 10s; custom and 0 allowed', async () => {
    expect((await createWorkout({ name: 'A' })).restSeconds).toBe(10);
    expect((await createWorkout({ name: 'B', restSeconds: 20 })).restSeconds).toBe(20);
    expect((await createWorkout({ name: 'C', restSeconds: 0 })).restSeconds).toBe(0);
  });

  it.each([-1, 601, 2.5])('400 for rest %j', async (restSeconds) => {
    await expectError(await t.send('POST', '/api/workouts', { name: 'A', restSeconds }), 400, 'VALIDATION_ERROR', 'restSeconds');
  });

  it('PUT updates rest with the name; omitted rest is kept', async () => {
    const w = await createWorkout({ name: 'A', restSeconds: 20 });
    expect((await t.sendOk<Workout>('PUT', `/api/workouts/${w.id}`, { name: 'A', restSeconds: 15 }, 200)).restSeconds).toBe(15);
    expect((await t.sendOk<Workout>('PUT', `/api/workouts/${w.id}`, { name: 'B' }, 200)).restSeconds).toBe(15);
    await expectError(await t.send('PUT', `/api/workouts/${w.id}`, { name: 'B', restSeconds: 999 }), 400, 'VALIDATION_ERROR', 'restSeconds');
  });
});

describe('per-entry duration overrides', () => {
  let plank: number;
  let squat: number;
  beforeEach(async () => {
    plank = (await createExercise({ name: 'Plank', durationSeconds: 60 })).id;
    squat = (await createExercise({ name: 'Squat' })).id;
  });

  it('create accepts ids or {exerciseId, durationSeconds}', async () => {
    const w = await createWorkout({ name: 'Core', exerciseIds: [plank, { exerciseId: plank, durationSeconds: 45 }, { exerciseId: squat }] });
    expect(durations(w)).toEqual([
      [60, null],
      [45, 45],
      [30, null],
    ]);
  });

  it('entries without an override follow the exercise default', async () => {
    const w = await createWorkout({ name: 'Core', exerciseIds: [plank, { exerciseId: plank, durationSeconds: 45 }] });
    await t.sendOk('PUT', `/api/exercises/${plank}`, { name: 'Plank', durationSeconds: 75 }, 200);
    const after = await getWorkout(w.id);
    expect(durations(after)).toEqual([
      [75, null],
      [45, 45],
    ]);
    expect(defaults(after)).toEqual([75, 75]);
  });

  it('append accepts overrides', async () => {
    const w = await createWorkout({ name: 'Core', exerciseIds: [squat] });
    const r = await t.sendOk<Workout>('POST', `/api/workouts/${w.id}/exercises`, { exerciseIds: [{ exerciseId: plank, durationSeconds: 20 }, squat] }, 200);
    expect(durations(r)).toEqual([
      [30, null],
      [20, 20],
      [30, null],
    ]);
  });

  it('PATCH sets and clears an entry override, bumping updatedAt', async () => {
    const w = await createWorkout({ name: 'Core', exerciseIds: [plank, squat] });
    const entry = w.exercises[0]!.id;
    t.ctx.clock += 1000;
    const set = await t.sendOk<Workout & { updatedAt: number }>('PATCH', `/api/workouts/${w.id}/exercises/${entry}`, { durationSeconds: 40 }, 200);
    expect(durations(set)).toEqual([
      [40, 40],
      [30, null],
    ]);
    expect(set.updatedAt).toBe(t.ctx.clock);
    const cleared = await t.sendOk<Workout>('PATCH', `/api/workouts/${w.id}/exercises/${entry}`, { durationSeconds: null }, 200);
    expect(durations(cleared)).toEqual([
      [60, null],
      [30, null],
    ]);
  });

  it('PATCH: 400 for bad duration or missing field, 404 for missing/foreign entry', async () => {
    const a = await createWorkout({ name: 'A', exerciseIds: [plank] });
    const b = await createWorkout({ name: 'B', exerciseIds: [plank] });
    const path = `/api/workouts/${a.id}/exercises/${a.exercises[0]!.id}`;
    await expectError(await t.send('PATCH', path, { durationSeconds: 0 }), 400, 'VALIDATION_ERROR', 'durationSeconds');
    await expectError(await t.send('PATCH', path, {}), 400, 'VALIDATION_ERROR', 'durationSeconds');
    await expectError(await t.send('PATCH', `/api/workouts/${a.id}/exercises/${b.exercises[0]!.id}`, { durationSeconds: 5 }), 404, 'NOT_FOUND');
    await expectError(await t.send('PATCH', `/api/workouts/${a.id}/exercises/999`, { durationSeconds: 5 }), 404, 'NOT_FOUND');
  });

  it('400 for a bad override on create', async () => {
    await expectError(
      await t.send('POST', '/api/workouts', { name: 'X', exerciseIds: [{ exerciseId: plank, durationSeconds: 0 }] }),
      400,
      'VALIDATION_ERROR',
      'exerciseIds',
    );
  });

  it('list shows rest and total run time (work + rests between)', async () => {
    await createWorkout({ name: 'Core', restSeconds: 15, exerciseIds: [plank, { exerciseId: squat, durationSeconds: 20 }, squat] });
    await createWorkout({ name: 'Empty' });
    const list = await t.sendOk<Json[]>('GET', '/api/workouts', undefined, 200);
    expect(list.map((w) => [w.name, w.restSeconds, w.totalSeconds])).toEqual([
      ['Core', 15, 60 + 20 + 30 + 2 * 15],
      ['Empty', 10, 0],
    ]);
  });

  it('run snapshots record the durations used', async () => {
    const w = await createWorkout({ name: 'Core', exerciseIds: [plank, { exerciseId: squat, durationSeconds: 20 }] });
    const run = await t.sendOk<Json>('POST', '/api/runs', { workoutId: w.id, startedAt: t.ctx.clock - 1000 }, 201);
    expect(run.exercises).toEqual([
      { exerciseId: plank, name: 'Plank', durationSeconds: 60 },
      { exerciseId: squat, name: 'Squat', durationSeconds: 20 },
    ]);
  });
});

describe('GET /api/runs/days', () => {
  it('returns distinct local days in the given time zone, sorted', async () => {
    const ex = await createExercise({ name: 'A' });
    const w = await createWorkout({ name: 'W', exerciseIds: [ex.id] });
    // 2026-11-05T13:30Z is 6 Nov 00:30 in Sydney (AEDT, UTC+11) but still 5 Nov in UTC.
    const times = [Date.UTC(2026, 10, 5, 13, 30), Date.UTC(2026, 10, 5, 12, 0), Date.UTC(2026, 10, 3, 1, 0), Date.UTC(2026, 10, 5, 14, 0)];
    for (const ts of times) {
      t.ctx.clock = ts;
      await t.sendOk('POST', '/api/runs', { workoutId: w.id, startedAt: ts - 60_000 }, 201);
    }
    expect(await t.sendOk('GET', '/api/runs/days?tz=Australia/Sydney', undefined, 200)).toEqual(['2026-11-03', '2026-11-05', '2026-11-06']);
    expect(await t.sendOk('GET', '/api/runs/days?tz=UTC', undefined, 200)).toEqual(['2026-11-03', '2026-11-05']);
  });

  it('400 for a missing or unknown time zone', async () => {
    await expectError(await t.send('GET', '/api/runs/days'), 400, 'VALIDATION_ERROR', 'tz');
    await expectError(await t.send('GET', '/api/runs/days?tz=Mars/Base'), 400, 'VALIDATION_ERROR', 'tz');
  });
});

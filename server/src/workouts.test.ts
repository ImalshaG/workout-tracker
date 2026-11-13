import { beforeEach, describe, expect, it } from 'vitest';
import { expectError, setup, type Json } from './test/helpers.js';

interface Entry {
  id: number;
  exerciseId: number;
  name: string;
  description: string | null;
}
interface Workout {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  exercises: Entry[];
}

let t: ReturnType<typeof setup>;
let ex: Record<'squat' | 'bench' | 'row', number>;

beforeEach(async () => {
  t = setup();
  const make = async (name: string, description?: string) =>
    (await t.sendOk<{ id: number }>('POST', '/api/exercises', { name, description }, 201)).id;
  ex = { squat: await make('Squat', 'Back squat'), bench: await make('Bench press'), row: await make('Barbell row') };
});

const createWorkout = (body: Json) => t.sendOk<Workout>('POST', '/api/workouts', body, 201);
const getWorkout = (id: number) => t.sendOk<Workout>('GET', `/api/workouts/${id}`, undefined, 200);
const exerciseIds = (w: Workout) => w.exercises.map((e) => e.exerciseId);

describe('POST /api/workouts', () => {
  it('creates a workout with exercises in the given order, repeats allowed', async () => {
    const w = await createWorkout({ name: '  Push day ', exerciseIds: [ex.bench, ex.squat, ex.bench] });
    expect(w).toMatchObject({ name: 'Push day', createdAt: t.ctx.clock, updatedAt: t.ctx.clock });
    expect(exerciseIds(w)).toEqual([ex.bench, ex.squat, ex.bench]);
    expect(w.exercises[1]).toEqual({
      id: expect.any(Number),
      exerciseId: ex.squat,
      name: 'Squat',
      description: 'Back squat',
      durationSeconds: 30,
      overrideSeconds: null,
      defaultSeconds: 30,
    });
    expect(new Set(w.exercises.map((e) => e.id)).size).toBe(3);
    expect(await getWorkout(w.id)).toEqual(w);
  });

  it('creates an empty workout when exerciseIds is omitted', async () => {
    const w = await createWorkout({ name: 'Empty' });
    expect(w.exercises).toEqual([]);
  });

  it.each([
    ['empty name', { name: ' ' }, 'name'],
    ['too-long name', { name: 'n'.repeat(101) }, 'name'],
    ['non-integer exercise id', { name: 'A', exerciseIds: [1.5] }, 'exerciseIds'],
    ['non-array exerciseIds', { name: 'A', exerciseIds: 'x' }, 'exerciseIds'],
  ])('400 for %s', async (_label, body, field) => {
    await expectError(await t.send('POST', '/api/workouts', body), 400, 'VALIDATION_ERROR', field);
  });

  it('400 for an unknown exercise id, and nothing is created', async () => {
    await expectError(
      await t.send('POST', '/api/workouts', { name: 'A', exerciseIds: [ex.squat, 999] }),
      400,
      'VALIDATION_ERROR',
      'exerciseIds',
    );
    expect(await t.sendOk('GET', '/api/workouts', undefined, 200)).toEqual([]);
  });

  it('409 for a duplicate name ignoring case', async () => {
    await createWorkout({ name: 'Push day' });
    await expectError(await t.send('POST', '/api/workouts', { name: 'PUSH DAY' }), 409, 'NAME_TAKEN', 'name');
  });
});

describe('GET /api/workouts', () => {
  it('lists summaries sorted by name ignoring case, with exercise counts', async () => {
    await createWorkout({ name: 'push', exerciseIds: [ex.bench, ex.bench] });
    await createWorkout({ name: 'Legs', exerciseIds: [ex.squat] });
    await createWorkout({ name: 'arms' });
    const list = await t.sendOk<Json[]>('GET', '/api/workouts', undefined, 200);
    expect(list.map((w) => [w.name, w.exerciseCount])).toEqual([
      ['arms', 0],
      ['Legs', 1],
      ['push', 2],
    ]);
    expect(list[0]).toEqual({
      id: expect.any(Number),
      name: 'arms',
      exerciseCount: 0,
      restSeconds: 10,
      totalSeconds: 0,
      createdAt: t.ctx.clock,
      updatedAt: t.ctx.clock,
    });
  });
});

describe('GET /api/workouts/:id', () => {
  it('404 for a missing workout, 400 for a bad id', async () => {
    await expectError(await t.send('GET', '/api/workouts/999'), 404, 'NOT_FOUND');
    await expectError(await t.send('GET', '/api/workouts/abc'), 400, 'VALIDATION_ERROR', 'id');
  });

  it('reflects later changes to exercise names', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat] });
    await t.sendOk('PUT', `/api/exercises/${ex.squat}`, { name: 'Front squat' }, 200);
    expect((await getWorkout(w.id)).exercises[0]?.name).toBe('Front squat');
  });
});

describe('PUT /api/workouts/:id (rename)', () => {
  it('renames, bumping updatedAt only', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat] });
    t.ctx.clock += 1000;
    const r = await t.sendOk<Workout>('PUT', `/api/workouts/${w.id}`, { name: ' B ' }, 200);
    expect(r).toEqual({ ...w, name: 'B', updatedAt: t.ctx.clock });
  });

  it('allows a case-only rename; 409 for another workout name; 404; 400', async () => {
    const a = await createWorkout({ name: 'legs' });
    await createWorkout({ name: 'Push' });
    expect((await t.sendOk<Workout>('PUT', `/api/workouts/${a.id}`, { name: 'Legs' }, 200)).name).toBe('Legs');
    await expectError(await t.send('PUT', `/api/workouts/${a.id}`, { name: 'push' }), 409, 'NAME_TAKEN', 'name');
    await expectError(await t.send('PUT', '/api/workouts/999', { name: 'X' }), 404, 'NOT_FOUND');
    await expectError(await t.send('PUT', `/api/workouts/${a.id}`, { name: '' }), 400, 'VALIDATION_ERROR', 'name');
  });
});

describe('DELETE /api/workouts/:id', () => {
  it('deletes the workout and its entries, freeing exercises for deletion', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat] });
    expect((await t.send('DELETE', `/api/workouts/${w.id}`)).status).toBe(204);
    await expectError(await t.send('GET', `/api/workouts/${w.id}`), 404, 'NOT_FOUND');
    expect((await t.send('DELETE', `/api/exercises/${ex.squat}`)).status).toBe(204);
  });

  it('404 for a missing workout', async () => {
    await expectError(await t.send('DELETE', '/api/workouts/999'), 404, 'NOT_FOUND');
  });
});

describe('POST /api/workouts/:id/exercises', () => {
  it('appends exercises in order (including repeats) and bumps updatedAt', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat] });
    t.ctx.clock += 1000;
    const r = await t.sendOk<Workout>('POST', `/api/workouts/${w.id}/exercises`, { exerciseIds: [ex.row, ex.squat] }, 200);
    expect(exerciseIds(r)).toEqual([ex.squat, ex.row, ex.squat]);
    expect(r.exercises[0]?.id).toBe(w.exercises[0]?.id);
    expect(r.updatedAt).toBe(t.ctx.clock);
  });

  it('400 for empty list or unknown exercise (nothing added); 404 for missing workout', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat] });
    const path = `/api/workouts/${w.id}/exercises`;
    await expectError(await t.send('POST', path, { exerciseIds: [] }), 400, 'VALIDATION_ERROR', 'exerciseIds');
    await expectError(await t.send('POST', path, { exerciseIds: [ex.row, 999] }), 400, 'VALIDATION_ERROR', 'exerciseIds');
    expect(exerciseIds(await getWorkout(w.id))).toEqual([ex.squat]);
    await expectError(await t.send('POST', '/api/workouts/999/exercises', { exerciseIds: [ex.row] }), 404, 'NOT_FOUND');
  });
});

describe('DELETE /api/workouts/:id/exercises/:entryId', () => {
  it('removes just that occurrence', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat, ex.bench, ex.squat] });
    t.ctx.clock += 1000;
    const r = await t.sendOk<Workout>('DELETE', `/api/workouts/${w.id}/exercises/${w.exercises[2]!.id}`, undefined, 200);
    expect(r.exercises).toEqual(w.exercises.slice(0, 2));
    expect(r.updatedAt).toBe(t.ctx.clock);
  });

  it('404 for a missing entry, an entry of another workout, or a missing workout', async () => {
    const a = await createWorkout({ name: 'A', exerciseIds: [ex.squat] });
    const b = await createWorkout({ name: 'B', exerciseIds: [ex.squat] });
    await expectError(await t.send('DELETE', `/api/workouts/${a.id}/exercises/999`), 404, 'NOT_FOUND');
    await expectError(await t.send('DELETE', `/api/workouts/${a.id}/exercises/${b.exercises[0]!.id}`), 404, 'NOT_FOUND');
    await expectError(await t.send('DELETE', `/api/workouts/999/exercises/${a.exercises[0]!.id}`), 404, 'NOT_FOUND');
    await expectError(await t.send('DELETE', `/api/workouts/${a.id}/exercises/x`), 400, 'VALIDATION_ERROR', 'entryId');
  });
});

describe('PUT /api/workouts/:id/exercises/order', () => {
  it('reorders entries and keeps their ids', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat, ex.bench, ex.row] });
    const [s, b, r] = w.exercises.map((e) => e.id);
    t.ctx.clock += 1000;
    const res = await t.sendOk<Workout>('PUT', `/api/workouts/${w.id}/exercises/order`, { entryIds: [r, s, b] }, 200);
    expect(res.exercises.map((e) => e.id)).toEqual([r, s, b]);
    expect(exerciseIds(res)).toEqual([ex.row, ex.squat, ex.bench]);
    expect(res.updatedAt).toBe(t.ctx.clock);
    expect(await getWorkout(w.id)).toEqual(res);
  });

  it('keeps order stable after removals and appends', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat, ex.bench, ex.row] });
    const [s, b, r] = w.exercises.map((e) => e.id);
    await t.sendOk('PUT', `/api/workouts/${w.id}/exercises/order`, { entryIds: [r, b, s] }, 200);
    await t.sendOk('DELETE', `/api/workouts/${w.id}/exercises/${b}`, undefined, 200);
    const after = await t.sendOk<Workout>('POST', `/api/workouts/${w.id}/exercises`, { exerciseIds: [ex.bench] }, 200);
    expect(exerciseIds(after)).toEqual([ex.row, ex.squat, ex.bench]);
  });

  it.each([
    ['a missing entry', (ids: number[]) => ids.slice(0, 2)],
    ['an extra entry', (ids: number[]) => [...ids, 999]],
    ['a repeated entry', (ids: number[]) => [ids[0]!, ids[0]!, ids[1]!]],
  ])('409 ORDER_MISMATCH for %s', async (_label, mutate) => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.squat, ex.bench, ex.row] });
    const ids = w.exercises.map((e) => e.id);
    await expectError(
      await t.send('PUT', `/api/workouts/${w.id}/exercises/order`, { entryIds: mutate(ids) }),
      409,
      'ORDER_MISMATCH',
    );
    expect(await getWorkout(w.id)).toEqual(w);
  });

  it('400 for a non-array body; 404 for a missing workout', async () => {
    const w = await createWorkout({ name: 'A' });
    await expectError(await t.send('PUT', `/api/workouts/${w.id}/exercises/order`, { entryIds: 'x' }), 400, 'VALIDATION_ERROR', 'entryIds');
    await expectError(await t.send('PUT', '/api/workouts/999/exercises/order', { entryIds: [] }), 404, 'NOT_FOUND');
  });
});

describe('deleting an exercise used in workouts', () => {
  it('409 EXERCISE_IN_USE naming the workouts; exercise is kept', async () => {
    await createWorkout({ name: 'Push day', exerciseIds: [ex.bench, ex.bench] });
    await createWorkout({ name: 'Arms', exerciseIds: [ex.bench] });
    const err = await expectError(await t.send('DELETE', `/api/exercises/${ex.bench}`), 409, 'EXERCISE_IN_USE');
    expect(err.message).toBe('Used in Arms and Push day. Remove it from those workouts first.');
    expect((await t.sendOk<Json[]>('GET', '/api/exercises', undefined, 200)).some((e) => e.id === ex.bench)).toBe(true);
  });

  it('can be deleted once removed from every workout', async () => {
    const w = await createWorkout({ name: 'A', exerciseIds: [ex.bench] });
    await t.sendOk('DELETE', `/api/workouts/${w.id}/exercises/${w.exercises[0]!.id}`, undefined, 200);
    expect((await t.send('DELETE', `/api/exercises/${ex.bench}`)).status).toBe(204);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { expectError, setup } from './test/helpers.js';

interface Run {
  id: number;
  workoutId: number | null;
  workoutName: string;
  exercises: { exerciseId: number; name: string }[];
  startedAt: number;
  completedAt: number;
}

let t: ReturnType<typeof setup>;
let squat: number;
let bench: number;
let workoutId: number;

beforeEach(async () => {
  t = setup();
  squat = (await t.sendOk<{ id: number }>('POST', '/api/exercises', { name: 'Squat' }, 201)).id;
  bench = (await t.sendOk<{ id: number }>('POST', '/api/exercises', { name: 'Bench press' }, 201)).id;
  workoutId = (await t.sendOk<{ id: number }>('POST', '/api/workouts', { name: 'Full body', exerciseIds: [bench, squat, bench] }, 201)).id;
});

const logRun = (startedAt: number, id = workoutId) => t.sendOk<Run>('POST', '/api/runs', { workoutId: id, startedAt }, 201);
const listRuns = (query = '') => t.sendOk<Run[]>('GET', `/api/runs${query}`, undefined, 200);

describe('POST /api/runs', () => {
  it('records a completed run with a snapshot of the workout', async () => {
    const run = await logRun(t.ctx.clock - 120_000);
    expect(run).toEqual({
      id: expect.any(Number),
      workoutId,
      workoutName: 'Full body',
      exercises: [
        { exerciseId: bench, name: 'Bench press', durationSeconds: 30 },
        { exerciseId: squat, name: 'Squat', durationSeconds: 30 },
        { exerciseId: bench, name: 'Bench press', durationSeconds: 30 },
      ],
      startedAt: t.ctx.clock - 120_000,
      completedAt: t.ctx.clock,
    });
    expect(await listRuns()).toEqual([run]);
  });

  it('404 for a missing workout', async () => {
    await expectError(await t.send('POST', '/api/runs', { workoutId: 999, startedAt: t.ctx.clock - 1000 }), 404, 'NOT_FOUND');
  });

  it('400 for a workout with no exercises', async () => {
    const empty = (await t.sendOk<{ id: number }>('POST', '/api/workouts', { name: 'Empty' }, 201)).id;
    await expectError(
      await t.send('POST', '/api/runs', { workoutId: empty, startedAt: t.ctx.clock - 1000 }),
      400,
      'VALIDATION_ERROR',
      'workoutId',
    );
  });

  it.each([
    ['missing workoutId', () => ({ startedAt: t.ctx.clock }), 'workoutId'],
    ['non-integer workoutId', () => ({ workoutId: 'x', startedAt: t.ctx.clock }), 'workoutId'],
    ['missing startedAt', () => ({ workoutId }), 'startedAt'],
    ['non-integer startedAt', () => ({ workoutId, startedAt: 1.5 }), 'startedAt'],
    ['startedAt in the future', () => ({ workoutId, startedAt: t.ctx.clock + 60_000 }), 'startedAt'],
    ['startedAt more than a day ago', () => ({ workoutId, startedAt: t.ctx.clock - 25 * 3_600_000 }), 'startedAt'],
  ])('400 for %s', async (_label, body, field) => {
    await expectError(await t.send('POST', '/api/runs', body()), 400, 'VALIDATION_ERROR', field);
  });
});

describe('GET /api/runs', () => {
  it('filters by completedAt in [from, to) and sorts oldest first', async () => {
    const base = t.ctx.clock;
    t.ctx.clock = base + 3000;
    const c = await logRun(base + 2000);
    t.ctx.clock = base + 1000;
    const a = await logRun(base);
    t.ctx.clock = base + 2000;
    const b = await logRun(base + 1000);

    expect((await listRuns()).map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    expect((await listRuns(`?from=${base + 1000}&to=${base + 3000}`)).map((r) => r.id)).toEqual([a.id, b.id]);
    expect((await listRuns(`?from=${base + 1001}`)).map((r) => r.id)).toEqual([b.id, c.id]);
    expect((await listRuns(`?to=${base + 1000}`)).map((r) => r.id)).toEqual([]);
  });

  it.each([
    ['?from=abc', 'from'],
    ['?to=1.5', 'to'],
    ['?from=2000&to=1000', 'to'],
  ])('400 for %s', async (query, field) => {
    await expectError(await t.send('GET', `/api/runs${query}`), 400, 'VALIDATION_ERROR', field);
  });
});

describe('history survives changes', () => {
  it('keeps the snapshot after renames and edits', async () => {
    const run = await logRun(t.ctx.clock - 1000);
    await t.sendOk('PUT', `/api/workouts/${workoutId}`, { name: 'Renamed' }, 200);
    await t.sendOk('PUT', `/api/exercises/${squat}`, { name: 'Front squat' }, 200);
    expect(await listRuns()).toEqual([run]);
  });

  it('deleting the workout keeps its runs, unlinked', async () => {
    const run = await logRun(t.ctx.clock - 1000);
    expect((await t.send('DELETE', `/api/workouts/${workoutId}`)).status).toBe(204);
    expect(await listRuns()).toEqual([{ ...run, workoutId: null }]);
  });
});

describe('DELETE /api/runs/:id', () => {
  it('removes a run', async () => {
    const run = await logRun(t.ctx.clock - 1000);
    expect((await t.send('DELETE', `/api/runs/${run.id}`)).status).toBe(204);
    expect(await listRuns()).toEqual([]);
  });

  it('404 for a missing run, 400 for a bad id', async () => {
    await expectError(await t.send('DELETE', '/api/runs/999'), 404, 'NOT_FOUND');
    await expectError(await t.send('DELETE', '/api/runs/abc'), 400, 'VALIDATION_ERROR', 'id');
  });
});

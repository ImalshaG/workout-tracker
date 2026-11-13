import { and, asc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { exercises, workoutExercises, workoutRuns, workouts } from '../db/schema.js';
import { apiError } from '../errors.js';
import { idSegment, idValue, validate } from '../validation.js';

/** Allow a little clock skew between "start" on the client and "now" on the server. */
const FUTURE_SKEW_MS = 5_000;
/** A run can't plausibly have started more than this long ago. */
const MAX_RUN_MS = 24 * 60 * 60 * 1000;

const timestamp = z.number({ error: 'startedAt must be a timestamp in ms' }).int('startedAt must be a timestamp in ms');
const createInput = z.object({
  workoutId: z.number({ error: 'workoutId is required' }).pipe(idValue),
  startedAt: timestamp.nonnegative('startedAt must be a timestamp in ms'),
});

const msParam = (name: string) =>
  z
    .string()
    .regex(/^\d{1,16}$/, `${name} must be a timestamp in ms`)
    .transform(Number)
    .optional();
const rangeQuery = z
  .object({ from: msParam('from'), to: msParam('to') })
  .refine((q) => q.from === undefined || q.to === undefined || q.to >= q.from, {
    message: 'to must not be before from',
    path: ['to'],
  });

const idParam = z.object({ id: idSegment });

function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const daysQuery = z.object({
  tz: z.string({ error: 'tz is required (an IANA time zone, e.g. Australia/Sydney)' }).refine(isTimeZone, 'Unknown time zone'),
});

/** "YYYY-MM-DD" for a timestamp in a time zone. */
function dayIn(formatter: Intl.DateTimeFormat, ts: number) {
  const parts = Object.fromEntries(formatter.formatToParts(ts).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function runRoutes(db: Db, now: () => number) {
  return new Hono()
    .get('/', validate('query', rangeQuery), (c) => {
      const { from, to } = c.req.valid('query');
      const conditions: SQL[] = [];
      if (from !== undefined) conditions.push(gte(workoutRuns.completedAt, from));
      if (to !== undefined) conditions.push(lt(workoutRuns.completedAt, to));
      const rows = db
        .select()
        .from(workoutRuns)
        .where(and(...conditions))
        .orderBy(asc(workoutRuns.completedAt), asc(workoutRuns.id))
        .all();
      return c.json(rows, 200);
    })
    /** Distinct days (in the caller's time zone) with at least one completed run: for streaks and day markers. */
    .get('/days', validate('query', daysQuery), (c) => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: c.req.valid('query').tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const rows = db.select({ completedAt: workoutRuns.completedAt }).from(workoutRuns).all();
      const days = [...new Set(rows.map((r) => dayIn(formatter, r.completedAt)))].sort();
      return c.json(days, 200);
    })
    .post('/', validate('json', createInput), (c) => {
      const { workoutId, startedAt } = c.req.valid('json');
      const completedAt = now();
      if (startedAt > completedAt + FUTURE_SKEW_MS) {
        return c.json(apiError('VALIDATION_ERROR', 'startedAt is in the future', 'startedAt'), 400);
      }
      if (completedAt - startedAt > MAX_RUN_MS) {
        return c.json(apiError('VALIDATION_ERROR', 'startedAt is more than a day ago', 'startedAt'), 400);
      }

      const result = db.transaction((tx) => {
        const workout = tx.select({ name: workouts.name }).from(workouts).where(eq(workouts.id, workoutId)).get();
        if (!workout) return 'not-found' as const;
        const done = tx
          .select({
            exerciseId: workoutExercises.exerciseId,
            name: exercises.name,
            durationSeconds: sql<number>`coalesce(${workoutExercises.durationSeconds}, ${exercises.durationSeconds})`,
          })
          .from(workoutExercises)
          .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
          .where(eq(workoutExercises.workoutId, workoutId))
          .orderBy(asc(workoutExercises.position), asc(workoutExercises.id))
          .all();
        if (done.length === 0) return 'empty' as const;
        return tx
          .insert(workoutRuns)
          .values({
            workoutId,
            workoutName: workout.name,
            exercises: done,
            startedAt: Math.min(startedAt, completedAt),
            completedAt,
          })
          .returning()
          .get();
      });

      if (result === 'not-found') return c.json(apiError('NOT_FOUND', 'Workout not found'), 404);
      if (result === 'empty') {
        return c.json(apiError('VALIDATION_ERROR', 'This workout has no exercises', 'workoutId'), 400);
      }
      return c.json(result, 201);
    })
    .delete('/:id', validate('param', idParam), (c) => {
      const { changes } = db.delete(workoutRuns).where(eq(workoutRuns.id, c.req.valid('param').id)).run();
      if (changes === 0) return c.json(apiError('NOT_FOUND', 'Run not found'), 404);
      return c.body(null, 204);
    });
}

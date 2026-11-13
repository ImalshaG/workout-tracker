import { and, asc, count, eq, max, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { DEFAULT_REST_SECONDS, exercises, workoutExercises, workouts } from '../db/schema.js';
import { apiError, isForeignKeyViolation, isUniqueViolation } from '../errors.js';
import { durationSchema, idSegment, idValue, nameSchema, restSchema, validate } from '../validation.js';

/** Upper bound on ids per request; generous for a workout, small enough to keep requests sane. */
const MAX_IDS = 200;

/** Each item is an exercise id, or `{ exerciseId, durationSeconds? }` to override that entry's duration. */
const exerciseItem = z.union(
  [
    idValue.transform((exerciseId) => ({ exerciseId, durationSeconds: null as number | null })),
    z.object({
      exerciseId: idValue,
      durationSeconds: durationSchema.nullish().transform((v) => v ?? null),
    }),
  ],
  { error: 'Each item must be an exercise id or { exerciseId, durationSeconds }' },
);
const exerciseIdList = z
  .array(exerciseItem, { error: 'exerciseIds must be a list of exercise ids' })
  .max(MAX_IDS, `At most ${MAX_IDS} exercises at a time`);

const createInput = z.object({
  name: nameSchema,
  restSeconds: restSchema.default(DEFAULT_REST_SECONDS),
  exerciseIds: exerciseIdList.default([]),
});
/** Name is required; restSeconds is left unchanged when omitted. */
const updateInput = z.object({ name: nameSchema, restSeconds: restSchema.optional() });
const overrideInput = z.object({ durationSeconds: durationSchema.nullable() });
const appendInput = z.object({ exerciseIds: exerciseIdList.min(1, 'Choose at least one exercise') });
const orderInput = z.object({
  entryIds: z.array(idValue, { error: 'entryIds must be a list of entry ids' }).max(1000),
});

const workoutParam = z.object({ id: idSegment });
const entryParam = z.object({ id: idSegment, entryId: idSegment });

const nameTaken = () => apiError('NAME_TAKEN', 'A workout with this name already exists', 'name');
const notFound = (what = 'Workout') => apiError('NOT_FOUND', `${what} not found`);
const unknownExercise = () =>
  apiError('VALIDATION_ERROR', 'One or more exercises no longer exist. Refresh and try again.', 'exerciseIds');

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function loadWorkout(db: Db | Tx, id: number) {
  const workout = db.select().from(workouts).where(eq(workouts.id, id)).get();
  if (!workout) return undefined;
  const entries = db
    .select({
      id: workoutExercises.id,
      exerciseId: workoutExercises.exerciseId,
      name: exercises.name,
      description: exercises.description,
      /** Effective work time: the entry's override, else the exercise default. */
      durationSeconds: sql<number>`coalesce(${workoutExercises.durationSeconds}, ${exercises.durationSeconds})`,
      overrideSeconds: workoutExercises.durationSeconds,
      defaultSeconds: exercises.durationSeconds,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(eq(workoutExercises.workoutId, id))
    .orderBy(asc(workoutExercises.position), asc(workoutExercises.id))
    .all();
  return { ...workout, exercises: entries };
}

export type WorkoutDetail = NonNullable<ReturnType<typeof loadWorkout>>;

/** Bumps updatedAt; false when the workout doesn't exist. */
function touch(tx: Tx, id: number, ts: number): boolean {
  return tx.update(workouts).set({ updatedAt: ts }).where(eq(workouts.id, id)).run().changes > 0;
}

export function workoutRoutes(db: Db, now: () => number) {
  return new Hono()
    .get('/', (c) => {
      const rows = db
        .select({
          id: workouts.id,
          name: workouts.name,
          exerciseCount: count(workoutExercises.id),
          restSeconds: workouts.restSeconds,
          /** Full run length: every exercise's work time plus a rest between each pair. */
          totalSeconds: sql<number>`coalesce(sum(coalesce(${workoutExercises.durationSeconds}, ${exercises.durationSeconds})), 0)
            + ${workouts.restSeconds} * max(count(${workoutExercises.id}) - 1, 0)`.mapWith(Number),
          createdAt: workouts.createdAt,
          updatedAt: workouts.updatedAt,
        })
        .from(workouts)
        .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
        .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
        .groupBy(workouts.id)
        .orderBy(asc(workouts.name), asc(workouts.id))
        .all();
      return c.json(rows, 200);
    })
    .post('/', validate('json', createInput), (c) => {
      const { name, restSeconds, exerciseIds } = c.req.valid('json');
      const ts = now();
      try {
        const id = db.transaction((tx) => {
          const { id } = tx
            .insert(workouts)
            .values({ name, restSeconds, createdAt: ts, updatedAt: ts })
            .returning({ id: workouts.id })
            .get();
          if (exerciseIds.length > 0) {
            tx.insert(workoutExercises)
              .values(exerciseIds.map((item, position) => ({ workoutId: id, ...item, position })))
              .run();
          }
          return id;
        });
        return c.json(loadWorkout(db, id)!, 201);
      } catch (err) {
        if (isUniqueViolation(err)) return c.json(nameTaken(), 409);
        if (isForeignKeyViolation(err)) return c.json(unknownExercise(), 400);
        throw err;
      }
    })
    .get('/:id', validate('param', workoutParam), (c) => {
      const workout = loadWorkout(db, c.req.valid('param').id);
      if (!workout) return c.json(notFound(), 404);
      return c.json(workout, 200);
    })
    .put('/:id', validate('param', workoutParam), validate('json', updateInput), (c) => {
      const { id } = c.req.valid('param');
      const { name, restSeconds } = c.req.valid('json');
      try {
        const { changes } = db
          .update(workouts)
          .set({ name, ...(restSeconds === undefined ? {} : { restSeconds }), updatedAt: now() })
          .where(eq(workouts.id, id))
          .run();
        if (changes === 0) return c.json(notFound(), 404);
        return c.json(loadWorkout(db, id)!, 200);
      } catch (err) {
        if (isUniqueViolation(err)) return c.json(nameTaken(), 409);
        throw err;
      }
    })
    .delete('/:id', validate('param', workoutParam), (c) => {
      const { changes } = db.delete(workouts).where(eq(workouts.id, c.req.valid('param').id)).run();
      if (changes === 0) return c.json(notFound(), 404);
      return c.body(null, 204);
    })
    .post('/:id/exercises', validate('param', workoutParam), validate('json', appendInput), (c) => {
      const { id } = c.req.valid('param');
      const { exerciseIds } = c.req.valid('json');
      try {
        const found = db.transaction((tx) => {
          if (!touch(tx, id, now())) return false;
          const last = tx
            .select({ position: max(workoutExercises.position) })
            .from(workoutExercises)
            .where(eq(workoutExercises.workoutId, id))
            .get();
          const start = (last?.position ?? -1) + 1;
          tx.insert(workoutExercises)
            .values(exerciseIds.map((item, i) => ({ workoutId: id, ...item, position: start + i })))
            .run();
          return true;
        });
        if (!found) return c.json(notFound(), 404);
        return c.json(loadWorkout(db, id)!, 200);
      } catch (err) {
        if (isForeignKeyViolation(err)) return c.json(unknownExercise(), 400);
        throw err;
      }
    })
    .patch('/:id/exercises/:entryId', validate('param', entryParam), validate('json', overrideInput), (c) => {
      const { id, entryId } = c.req.valid('param');
      const { durationSeconds } = c.req.valid('json');
      const found = db.transaction((tx) => {
        const { changes } = tx
          .update(workoutExercises)
          .set({ durationSeconds })
          .where(and(eq(workoutExercises.id, entryId), eq(workoutExercises.workoutId, id)))
          .run();
        return changes > 0 && touch(tx, id, now());
      });
      if (!found) return c.json(notFound('Exercise entry'), 404);
      return c.json(loadWorkout(db, id)!, 200);
    })
    .delete('/:id/exercises/:entryId', validate('param', entryParam), (c) => {
      const { id, entryId } = c.req.valid('param');
      const found = db.transaction((tx) => {
        const { changes } = tx
          .delete(workoutExercises)
          .where(and(eq(workoutExercises.id, entryId), eq(workoutExercises.workoutId, id)))
          .run();
        return changes > 0 && touch(tx, id, now());
      });
      if (!found) return c.json(notFound('Exercise entry'), 404);
      return c.json(loadWorkout(db, id)!, 200);
    })
    .put('/:id/exercises/order', validate('param', workoutParam), validate('json', orderInput), (c) => {
      const { id } = c.req.valid('param');
      const { entryIds } = c.req.valid('json');
      const outcome = db.transaction((tx) => {
        const exists = tx.select({ id: workouts.id }).from(workouts).where(eq(workouts.id, id)).get();
        if (!exists) return 'not-found' as const;
        const current = new Set(
          tx
            .select({ id: workoutExercises.id })
            .from(workoutExercises)
            .where(eq(workoutExercises.workoutId, id))
            .all()
            .map((r) => r.id),
        );
        // Must be exactly the current entries, each once; otherwise the client's view is stale.
        const isPermutation =
          entryIds.length === current.size && new Set(entryIds).size === entryIds.length && entryIds.every((e) => current.has(e));
        if (!isPermutation) return 'mismatch' as const;
        entryIds.forEach((entryId, position) => {
          tx.update(workoutExercises).set({ position }).where(eq(workoutExercises.id, entryId)).run();
        });
        touch(tx, id, now());
        return 'ok' as const;
      });
      if (outcome === 'not-found') return c.json(notFound(), 404);
      if (outcome === 'mismatch') {
        return c.json(
          apiError('ORDER_MISMATCH', 'This workout changed since it was loaded. Refresh and try again.'),
          409,
        );
      }
      return c.json(loadWorkout(db, id)!, 200);
    });
}

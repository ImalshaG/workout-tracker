import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { DEFAULT_DURATION_SECONDS, exercises, workoutExercises, workouts } from '../db/schema.js';
import { apiError, isForeignKeyViolation, isUniqueViolation, joinNames } from '../errors.js';
import { durationSchema, idSegment, nameSchema, validate } from '../validation.js';

export const DESCRIPTION_MAX = 1000;

const exerciseInput = z.object({
  name: nameSchema,
  description: z
    .string({ error: 'Description must be text' })
    .trim()
    .max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or fewer`)
    .nullish()
    .transform((v) => (v ? v : null)),
  durationSeconds: durationSchema.default(DEFAULT_DURATION_SECONDS),
});

const idParam = z.object({ id: idSegment });

const nameTaken = () => apiError('NAME_TAKEN', 'An exercise with this name already exists', 'name');
const notFound = () => apiError('NOT_FOUND', 'Exercise not found');

export function exerciseRoutes(db: Db, now: () => number) {
  return new Hono()
    .get('/', (c) => {
      const rows = db.select().from(exercises).orderBy(asc(exercises.name), asc(exercises.id)).all();
      return c.json(rows, 200);
    })
    .post('/', validate('json', exerciseInput), (c) => {
      const { name, description, durationSeconds } = c.req.valid('json');
      const ts = now();
      try {
        const row = db
          .insert(exercises)
          .values({ name, description, durationSeconds, createdAt: ts, updatedAt: ts })
          .returning()
          .get();
        return c.json(row, 201);
      } catch (err) {
        if (isUniqueViolation(err)) return c.json(nameTaken(), 409);
        throw err;
      }
    })
    .put('/:id', validate('param', idParam), validate('json', exerciseInput), (c) => {
      const { id } = c.req.valid('param');
      const { name, description, durationSeconds } = c.req.valid('json');
      try {
        const row = db
          .update(exercises)
          .set({ name, description, durationSeconds, updatedAt: now() })
          .where(eq(exercises.id, id))
          .returning()
          .get();
        if (!row) return c.json(notFound(), 404);
        return c.json(row, 200);
      } catch (err) {
        if (isUniqueViolation(err)) return c.json(nameTaken(), 409);
        throw err;
      }
    })
    .delete('/:id', validate('param', idParam), (c) => {
      const { id } = c.req.valid('param');
      try {
        const { changes } = db.delete(exercises).where(eq(exercises.id, id)).run();
        if (changes === 0) return c.json(notFound(), 404);
        return c.body(null, 204);
      } catch (err) {
        if (!isForeignKeyViolation(err)) throw err;
        const usedIn = db
          .selectDistinct({ name: workouts.name })
          .from(workoutExercises)
          .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
          .where(eq(workoutExercises.exerciseId, id))
          .orderBy(asc(workouts.name))
          .all()
          .map((w) => w.name);
        return c.json(
          apiError('EXERCISE_IN_USE', `Used in ${joinNames(usedIn)}. Remove it from ${usedIn.length === 1 ? 'that workout' : 'those workouts'} first.`),
          409,
        );
      }
    });
}

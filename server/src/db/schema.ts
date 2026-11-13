import { customType, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** TEXT column compared case-insensitively (affects unique indexes and ORDER BY). */
export const DEFAULT_DURATION_SECONDS = 30;
export const DEFAULT_REST_SECONDS = 10;

const textNoCase = customType<{ data: string }>({
  dataType: () => 'text COLLATE NOCASE',
});

export const exercises = sqliteTable(
  'exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: textNoCase('name').notNull(),
    description: text('description'),
    /** Default work time when this exercise is run; workouts can override it per entry. */
    durationSeconds: integer('duration_seconds').notNull().default(DEFAULT_DURATION_SECONDS),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('exercises_name_unique').on(t.name)],
);

export const workouts = sqliteTable(
  'workouts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: textNoCase('name').notNull(),
    /** Rest between consecutive exercises when running (0 = none). */
    restSeconds: integer('rest_seconds').notNull().default(DEFAULT_REST_SECONDS),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('workouts_name_unique').on(t.name)],
);

/**
 * One row per exercise occurrence in a workout. The same exercise may appear more than once;
 * each occurrence has its own id so it can be moved/removed independently (and carry sets/reps later).
 */
export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutId: integer('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      // Default NO ACTION: deleting an exercise that's in use fails (SQLITE_CONSTRAINT_FOREIGNKEY).
      // (RESTRICT would block it too, but SQLite reports that as SQLITE_CONSTRAINT_TRIGGER.)
      .references(() => exercises.id),
    position: integer('position').notNull(),
    /** Overrides the exercise's default duration for this entry; null = use the default. */
    durationSeconds: integer('duration_seconds'),
  },
  (t) => [
    index('workout_exercises_workout_position_idx').on(t.workoutId, t.position),
    index('workout_exercises_exercise_idx').on(t.exerciseId),
  ],
);

/** What was done in a run, captured at completion so history survives later edits/deletes. */
export interface RunExercise {
  exerciseId: number;
  name: string;
  /** Work time used for this exercise (absent on runs recorded before durations existed). */
  durationSeconds?: number;
}

/** A completed run of a workout. */
export const workoutRuns = sqliteTable(
  'workout_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Nullable: deleting the workout keeps its history (the link is cleared).
    workoutId: integer('workout_id').references(() => workouts.id, { onDelete: 'set null' }),
    workoutName: text('workout_name').notNull(),
    exercises: text('exercises', { mode: 'json' }).$type<RunExercise[]>().notNull(),
    startedAt: integer('started_at').notNull(),
    completedAt: integer('completed_at').notNull(),
  },
  (t) => [index('workout_runs_completed_at_idx').on(t.completedAt), index('workout_runs_workout_idx').on(t.workoutId)],
);

export type ExerciseRow = typeof exercises.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;

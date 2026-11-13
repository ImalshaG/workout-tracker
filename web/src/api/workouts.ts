import { client, throwApiError, unwrap, type InferResponseType } from './client';

const api = client.api.workouts;
const one = api[':id'];

export type WorkoutSummary = InferResponseType<typeof api.$get, 200>[number];
export type Workout = InferResponseType<typeof one.$get, 200>;
export type WorkoutEntry = Workout['exercises'][number];
export const WORKOUT_FIELDS = ['name', 'exerciseIds', 'restSeconds'] as const;

/** An exercise to add: just its id, or with a duration override for this workout. */
export type ExerciseItem = number | { exerciseId: number; durationSeconds: number };

export const workoutKeys = {
  all: ['workouts'] as const,
  list: () => ['workouts', 'list'] as const,
  detail: (id: number) => ['workouts', 'detail', id] as const,
};

const p = (id: number) => ({ id: String(id) });

export async function listWorkouts(): Promise<WorkoutSummary[]> {
  return unwrap(await api.$get());
}

export async function getWorkout(id: number): Promise<Workout> {
  return unwrap(await one.$get({ param: p(id) }));
}

export async function createWorkout(input: {
  name: string;
  restSeconds: number | null;
  exerciseIds: ExerciseItem[];
}): Promise<Workout> {
  // A null rest (empty/invalid field) is sent as-is so the server reports it under the field.
  return unwrap(await api.$post({ json: input as { name: string; restSeconds: number; exerciseIds: ExerciseItem[] } }));
}

/** Rename and/or change rest; omitted rest is left unchanged. */
export async function updateWorkout(id: number, input: { name: string; restSeconds?: number }): Promise<Workout> {
  return unwrap(await one.$put({ param: p(id), json: input }));
}

/** Set (or with null, clear) an entry's duration override. */
export async function setEntryDuration(id: number, entryId: number, durationSeconds: number | null): Promise<Workout> {
  return unwrap(
    await one.exercises[':entryId'].$patch({ param: { ...p(id), entryId: String(entryId) }, json: { durationSeconds } }),
  );
}

export async function deleteWorkout(id: number): Promise<void> {
  const res = await one.$delete({ param: p(id) });
  if (!res.ok) await throwApiError(res);
}

export async function addWorkoutExercises(id: number, exerciseIds: ExerciseItem[]): Promise<Workout> {
  return unwrap(await one.exercises.$post({ param: p(id), json: { exerciseIds } }));
}

export async function removeWorkoutExercise(id: number, entryId: number): Promise<Workout> {
  return unwrap(await one.exercises[':entryId'].$delete({ param: { ...p(id), entryId: String(entryId) } }));
}

export async function reorderWorkoutExercises(id: number, entryIds: number[]): Promise<Workout> {
  return unwrap(await one.exercises.order.$put({ param: p(id), json: { entryIds } }));
}

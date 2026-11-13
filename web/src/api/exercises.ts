import { client, throwApiError, unwrap, type InferResponseType } from './client';

const api = client.api.exercises;

export type Exercise = InferResponseType<typeof api.$get, 200>[number];
export interface ExerciseInput {
  name: string;
  description?: string;
  /** Whole seconds; null when the field is empty/invalid (the server reports it under the field). */
  durationSeconds: number | null;
}
export const EXERCISE_FIELDS = ['name', 'description', 'durationSeconds'] as const;

export const exerciseKeys = { all: ['exercises'] as const };

export async function listExercises(): Promise<Exercise[]> {
  return unwrap(await api.$get());
}

/** A null duration is sent as-is so the server reports it under the field (typed as the API expects). */
const toWire = (input: ExerciseInput) => input as Omit<ExerciseInput, 'durationSeconds'> & { durationSeconds: number };

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  return unwrap(await api.$post({ json: toWire(input) }));
}

export async function updateExercise(id: number, input: ExerciseInput): Promise<Exercise> {
  return unwrap(await api[':id'].$put({ param: { id: String(id) }, json: toWire(input) }));
}

export async function deleteExercise(id: number): Promise<void> {
  const res = await api[':id'].$delete({ param: { id: String(id) } });
  if (!res.ok) await throwApiError(res);
}
